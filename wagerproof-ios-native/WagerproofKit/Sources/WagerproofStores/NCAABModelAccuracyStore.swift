import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// NCAAB model accuracy store. Mirrors RN `hooks/useNCAABModelAccuracy.ts`.
/// Joins today's games (`v_cbb_input_values` filtered by `game_date_et`),
/// the latest `ncaab_predictions` run, edge-bucket accuracy
/// (`ncaab_edge_accuracy_by_bucket`), and team logos
/// (`ncaab_team_mapping`) — then computes per-bucket lookups for spread
/// edge, moneyline probability, and O/U edge.
///
/// Backend queries are byte-identical to RN. The bucket keys use the same
/// rounding rules: spread/OU round to nearest 0.5; ML rounds to nearest
/// 0.05 (Math.round(max * 20) / 20).
@Observable
@MainActor
public final class NCAABModelAccuracyStore {
    public enum SortMode: String, Hashable, Sendable {
        case time, spread, moneyline, ou
    }

    public enum LoadState: Equatable, Sendable {
        case idle, loading, loaded
        case failed(String)
    }

    public private(set) var games: [NCAABModelAccuracyGame] = []
    public private(set) var loadState: LoadState = .idle
    public var sortMode: SortMode = .time {
        didSet { games = sortGames(games, mode: sortMode) }
    }

    public init() {}

    public func refresh() async {
        #if DEBUG
        // Dummy Data Mode: synthesized per-game accuracy keyed to the captured
        // NCAAB slate so the model-accuracy widget populates offseason.
        if DummyDataMode.isEnabled {
            games = sortGames(DummyData.ncaabAccuracy(), mode: sortMode)
            loadState = .loaded
            return
        }
        #endif
        loadState = .loading
        let cfb = await CFBSupabase.shared.client
        let today = Self.todayET()

        // Fire 4 queries in sequence (RN uses Promise.all but the Swift
        // client is sequential per-call; ordering matches RN exactly so
        // any error surfaces with the same precedence).
        let inputGames: [InputRow]
        do {
            inputGames = try await cfb
                .from("v_cbb_input_values")
                .select()
                .eq("game_date_et", value: today)
                .order("game_date_et", ascending: true)
                .order("tipoff_time_et", ascending: true)
                .execute()
                .value
        } catch {
            loadState = .failed("Games: \(error.localizedDescription)")
            return
        }

        let latestRun: LatestRunRow? = try? await cfb
            .from("ncaab_predictions")
            .select("run_id, as_of_ts_utc")
            .order("as_of_ts_utc", ascending: false)
            .limit(1)
            .single()
            .execute()
            .value

        let bucketRows: [BucketRow]
        do {
            bucketRows = try await cfb
                .from("ncaab_edge_accuracy_by_bucket")
                .select("edge_type, bucket, games, correct, accuracy_pct")
                .execute()
                .value
        } catch {
            loadState = .failed("Edge accuracy: \(error.localizedDescription)")
            return
        }

        let mappingRows: [MappingRow] = (try? await cfb
            .from("ncaab_team_mapping")
            .select("api_team_id, espn_team_id, team_abbrev")
            .execute()
            .value) ?? []

        // Build team map keyed by api_team_id.
        var teamMap: [Int: (logoUrl: String, abbrev: String?)] = [:]
        for row in mappingRows {
            let espnId: Int? = {
                if let n = row.espnTeamIdInt { return n }
                if let s = row.espnTeamIdString, let parsed = Int(s) { return parsed }
                return nil
            }()
            var logoUrl = ""
            if let espnId {
                logoUrl = "https://a.espncdn.com/i/teamlogos/ncaa/500/\(espnId).png"
            }
            teamMap[row.apiTeamId] = (logoUrl, row.teamAbbrev)
        }

        // Build bucket lookup table.
        var bucketMap: [String: NCAABAccuracyBucket] = [:]
        for row in bucketRows {
            let key = "\(row.edgeType)|\(row.bucket)"
            bucketMap[key] = NCAABAccuracyBucket(games: row.games, accuracyPct: row.accuracyPct)
        }

        if inputGames.isEmpty {
            games = []
            loadState = .loaded
            return
        }

        // Pull predictions for today's game ids using the latest run.
        var predictionMap: [Int: PredictionRow] = [:]
        if let latestRun {
            let gameIds = inputGames.map { $0.gameId }
            let preds: [PredictionRow] = (try? await cfb
                .from("ncaab_predictions")
                .select("game_id, home_win_prob, away_win_prob, pred_total_points, vegas_total, vegas_home_spread, model_fair_home_spread")
                .eq("run_id", value: latestRun.runId)
                .in("game_id", values: gameIds)
                .execute()
                .value) ?? []
            for p in preds {
                predictionMap[p.gameId] = p
            }
        }

        let merged: [NCAABModelAccuracyGame] = inputGames.map { game in
            let pred = predictionMap[game.gameId]
            let vegasHomeSpread = pred?.vegasHomeSpread ?? game.spread
            let modelFair = pred?.modelFairHomeSpread
            let homeSpreadDiff: Double? = {
                guard let vegasHomeSpread, let modelFair else { return nil }
                return vegasHomeSpread - modelFair
            }()
            let vegasTotal = pred?.vegasTotal ?? game.overUnder
            let predTotal = pred?.predTotalPoints
            let overLineDiff: Double? = {
                guard let vegasTotal, let predTotal else { return nil }
                return predTotal - vegasTotal
            }()
            let homeWinProb = pred?.homeWinProb
            let awayWinProb = pred?.awayWinProb
            let mlBucketKey = Self.mlBucketKey(home: homeWinProb, away: awayWinProb)
            let mlPickIsHome: Bool? = {
                guard let h = homeWinProb, let a = awayWinProb else { return nil }
                return h >= a
            }()
            let spreadBucketKey = Self.spreadBucketKey(homeSpreadDiff)
            let ouBucketKey = Self.ouBucketKey(overLineDiff)

            let awayMapping = teamMap[game.awayTeamId ?? -1]
            let homeMapping = teamMap[game.homeTeamId ?? -1]
            let awayAbbr = awayMapping?.abbrev ?? Self.initials(of: game.awayTeam ?? "")
            let homeAbbr = homeMapping?.abbrev ?? Self.initials(of: game.homeTeam ?? "")

            return NCAABModelAccuracyGame(
                gameId: game.gameId,
                awayTeam: game.awayTeam ?? "",
                homeTeam: game.homeTeam ?? "",
                awayAbbr: awayAbbr,
                homeAbbr: homeAbbr,
                gameDate: game.gameDateEt ?? "",
                tipoffTime: game.tipoffTimeEt,
                homeSpread: vegasHomeSpread,
                homeSpreadDiff: homeSpreadDiff,
                spreadAccuracy: Self.lookup(bucketMap, type: "SPREAD_EDGE", key: spreadBucketKey),
                homeWinProb: homeWinProb,
                awayWinProb: awayWinProb,
                mlPickIsHome: mlPickIsHome,
                mlPickProbRounded: mlBucketKey,
                mlAccuracy: Self.lookup(bucketMap, type: "MONEYLINE_PROB", key: mlBucketKey),
                overLine: vegasTotal,
                overLineDiff: overLineDiff,
                ouAccuracy: Self.lookup(bucketMap, type: "OU_EDGE", key: ouBucketKey),
                awayTeamLogo: awayMapping?.logoUrl,
                homeTeamLogo: homeMapping?.logoUrl
            )
        }

        games = sortGames(merged, mode: sortMode)
        loadState = .loaded
    }

    /// Find the per-game accuracy payload for a specific `game_id`. Mirrors
    /// RN `useNCAABModelAccuracyForGame` (single-row lookup driven by the
    /// in-sheet widget).
    public func accuracy(forGameId gameId: Int) -> NCAABModelAccuracyGame? {
        games.first(where: { $0.gameId == gameId })
    }

    // MARK: - Bucket helpers

    /// Round to nearest 0.5 (matches RN `roundToNearestHalf`).
    private static func roundHalf(_ value: Double) -> Double {
        (value * 2).rounded() / 2
    }

    private static func spreadBucketKey(_ diff: Double?) -> Double? {
        guard let diff, !diff.isNaN else { return nil }
        return roundHalf(abs(diff))
    }

    private static func ouBucketKey(_ diff: Double?) -> Double? {
        guard let diff, !diff.isNaN else { return nil }
        return roundHalf(diff)
    }

    private static func mlBucketKey(home: Double?, away: Double?) -> Double? {
        let h = (home?.isNaN == false ? home : 0) ?? 0
        let a = (away?.isNaN == false ? away : 0) ?? 0
        let m = max(h, a)
        if m <= 0 { return nil }
        return (m * 20).rounded() / 20
    }

    private static func lookup(_ map: [String: NCAABAccuracyBucket], type: String, key: Double?) -> NCAABAccuracyBucket? {
        guard let key else { return nil }
        // Key formatting matches RN — number → JS string coercion would
        // produce "1.5" or "1" depending on trailing zero. Bucket values in
        // the DB are stored as the raw decimal string, so we mirror that.
        let formatted: String = {
            if key == key.rounded() { return String(format: "%g", key) }
            return String(format: "%g", key)
        }()
        return map["\(type)|\(formatted)"]
    }

    private static func initials(of team: String) -> String {
        let cleaned = team.replacingOccurrences(of: "()", with: "").trimmingCharacters(in: .whitespaces)
        let words = cleaned.split(separator: " ")
        if words.count >= 2 {
            return String(words.prefix(2).map { $0.first ?? "?" })
        }
        return String(cleaned.prefix(3)).uppercased()
    }

    private static func todayET() -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_CA")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: Date())
    }

    private func sortGames(_ list: [NCAABModelAccuracyGame], mode: SortMode) -> [NCAABModelAccuracyGame] {
        let byTime: (NCAABModelAccuracyGame, NCAABModelAccuracyGame) -> Bool = { a, b in
            if a.gameDate != b.gameDate { return a.gameDate < b.gameDate }
            return (a.tipoffTime ?? "") < (b.tipoffTime ?? "")
        }
        switch mode {
        case .time: return list.sorted(by: byTime)
        case .spread:
            return list.sorted { a, b in
                let aA = a.spreadAccuracy?.accuracyPct ?? -1
                let bA = b.spreadAccuracy?.accuracyPct ?? -1
                if aA != bA { return aA > bA }
                return byTime(a, b)
            }
        case .moneyline:
            return list.sorted { a, b in
                let aA = a.mlAccuracy?.accuracyPct ?? -1
                let bA = b.mlAccuracy?.accuracyPct ?? -1
                if aA != bA { return aA > bA }
                return byTime(a, b)
            }
        case .ou:
            return list.sorted { a, b in
                let aA = a.ouAccuracy?.accuracyPct ?? -1
                let bA = b.ouAccuracy?.accuracyPct ?? -1
                if aA != bA { return aA > bA }
                return byTime(a, b)
            }
        }
    }

    // MARK: - Decoder structs

    private struct InputRow: Decodable, Sendable {
        let gameId: Int
        let awayTeam: String?
        let homeTeam: String?
        let awayTeamId: Int?
        let homeTeamId: Int?
        let gameDateEt: String?
        let tipoffTimeEt: String?
        let spread: Double?
        let overUnder: Double?

        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case awayTeam = "away_team"
            case homeTeam = "home_team"
            case awayTeamId = "away_team_id"
            case homeTeamId = "home_team_id"
            case gameDateEt = "game_date_et"
            case tipoffTimeEt = "tipoff_time_et"
            case spread
            case overUnder = "over_under"
        }
    }

    private struct PredictionRow: Decodable, Sendable {
        let gameId: Int
        let homeWinProb: Double?
        let awayWinProb: Double?
        let predTotalPoints: Double?
        let vegasTotal: Double?
        let vegasHomeSpread: Double?
        let modelFairHomeSpread: Double?

        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case homeWinProb = "home_win_prob"
            case awayWinProb = "away_win_prob"
            case predTotalPoints = "pred_total_points"
            case vegasTotal = "vegas_total"
            case vegasHomeSpread = "vegas_home_spread"
            case modelFairHomeSpread = "model_fair_home_spread"
        }
    }

    private struct LatestRunRow: Decodable, Sendable {
        let runId: String
        let asOfTsUtc: String?
        enum CodingKeys: String, CodingKey {
            case runId = "run_id"
            case asOfTsUtc = "as_of_ts_utc"
        }
    }

    private struct BucketRow: Decodable, Sendable {
        let edgeType: String
        let bucket: String // stored as numeric but the lookup key is a string
        let games: Int
        let correct: Int?
        let accuracyPct: Double

        enum CodingKeys: String, CodingKey {
            case edgeType = "edge_type"
            case bucket
            case games
            case correct
            case accuracyPct = "accuracy_pct"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            edgeType = try c.decode(String.self, forKey: .edgeType)
            // bucket may be Number or String — coerce to canonical %g string.
            if let n = try? c.decode(Double.self, forKey: .bucket) {
                if n == n.rounded() {
                    bucket = String(format: "%g", n)
                } else {
                    bucket = String(format: "%g", n)
                }
            } else if let s = try? c.decode(String.self, forKey: .bucket) {
                bucket = s
            } else {
                bucket = ""
            }
            games = try c.decode(Int.self, forKey: .games)
            correct = try? c.decode(Int.self, forKey: .correct)
            accuracyPct = try c.decode(Double.self, forKey: .accuracyPct)
        }
    }

    private struct MappingRow: Decodable, Sendable {
        let apiTeamId: Int
        let espnTeamIdInt: Int?
        let espnTeamIdString: String?
        let teamAbbrev: String?

        enum CodingKeys: String, CodingKey {
            case apiTeamId = "api_team_id"
            case espnTeamId = "espn_team_id"
            case teamAbbrev = "team_abbrev"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            apiTeamId = try c.decode(Int.self, forKey: .apiTeamId)
            if let n = try? c.decode(Int.self, forKey: .espnTeamId) {
                espnTeamIdInt = n
                espnTeamIdString = nil
            } else if let s = try? c.decode(String.self, forKey: .espnTeamId) {
                espnTeamIdInt = nil
                espnTeamIdString = s
            } else {
                espnTeamIdInt = nil
                espnTeamIdString = nil
            }
            teamAbbrev = try? c.decode(String.self, forKey: .teamAbbrev)
        }
    }
}
