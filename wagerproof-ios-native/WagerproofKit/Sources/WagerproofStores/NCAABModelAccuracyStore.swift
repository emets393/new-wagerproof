import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// NCAAB model-accuracy store. Reads the single
/// `ncaab_todays_games_predictions_with_accuracy` view (same shape and
/// decoder as the NBA `nba_todays_games_predictions_with_accuracy` view),
/// replacing the old 4-table hand-join of `v_cbb_input_values` +
/// `ncaab_predictions` + `ncaab_edge_accuracy_by_bucket` +
/// `ncaab_team_mapping`. The view already resolves the latest run and the
/// per-game edge buckets server-side.
///
/// The view carries no team ids or logo columns, so ESPN logos and
/// abbreviations are still resolved via `v_cbb_input_values` (game_id →
/// team ids) + `ncaab_team_mapping` — both best-effort: a mapping failure
/// degrades to initials, never to a load error.
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

        let rows: [AccuracyRow]
        do {
            rows = try await cfb
                .from("ncaab_todays_games_predictions_with_accuracy")
                .select()
                .order("game_date", ascending: true)
                .order("tipoff_time_et", ascending: true)
                .execute()
                .value
        } catch {
            loadState = .failed("Failed to fetch NCAAB model accuracy")
            return
        }

        if rows.isEmpty {
            games = []
            loadState = .loaded
            return
        }

        let teamLookup = await fetchTeamLookup(gameIds: rows.map { $0.gameId })

        let merged: [NCAABModelAccuracyGame] = rows.map { row in
            let homeSpreadDiff: Double? = {
                guard let vegas = row.vegasHomeSpread, let fair = row.modelFairHomeSpread else { return nil }
                return vegas - fair
            }()
            let overLineDiff: Double? = {
                guard let vegas = row.vegasTotal, let pred = row.predTotalPoints else { return nil }
                return pred - vegas
            }()
            // Prefer the view's explicit winner; fall back to comparing probs
            // (the old hand-join's behavior) so the ML pick never blanks out.
            let mlPickIsHome: Bool? = {
                switch row.modelMlWinner {
                case "home": return true
                case "away": return false
                default:
                    guard let h = row.homeWinProb, let a = row.awayWinProb else { return nil }
                    return h >= a
                }
            }()

            let awayInfo = teamLookup[row.gameId]?.away
            let homeInfo = teamLookup[row.gameId]?.home
            return NCAABModelAccuracyGame(
                gameId: row.gameId,
                awayTeam: row.awayTeam ?? "",
                homeTeam: row.homeTeam ?? "",
                awayAbbr: awayInfo?.abbrev ?? Self.initials(of: row.awayTeam ?? ""),
                homeAbbr: homeInfo?.abbrev ?? Self.initials(of: row.homeTeam ?? ""),
                gameDate: row.gameDate ?? "",
                tipoffTime: row.tipoffTimeEt,
                homeSpread: row.vegasHomeSpread,
                homeSpreadDiff: homeSpreadDiff,
                spreadAccuracy: Self.bucket(pct: row.spreadAccuracyPct, games: row.spreadBucketGames),
                homeWinProb: row.homeWinProb,
                awayWinProb: row.awayWinProb,
                mlPickIsHome: mlPickIsHome,
                mlPickProbRounded: row.mlBucket,
                mlAccuracy: Self.bucket(pct: row.mlAccuracyPct, games: row.mlBucketGames),
                overLine: row.vegasTotal,
                overLineDiff: overLineDiff,
                ouAccuracy: Self.bucket(pct: row.ouAccuracyPct, games: row.ouBucketGames),
                awayTeamLogo: awayInfo?.logoUrl,
                homeTeamLogo: homeInfo?.logoUrl
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

    // MARK: - Team logo/abbrev resolution

    private struct TeamInfo: Sendable {
        let abbrev: String?
        let logoUrl: String?
    }

    /// Best-effort per-game team lookup: the accuracy view exposes only team
    /// NAMES, so we join `v_cbb_input_values` for the api team ids and
    /// `ncaab_team_mapping` for ESPN logo ids + abbreviations.
    private func fetchTeamLookup(gameIds: [Int]) async -> [Int: (away: TeamInfo?, home: TeamInfo?)] {
        let cfb = await CFBSupabase.shared.client

        let idRows: [InputIdRow] = (try? await cfb
            .from("v_cbb_input_values")
            .select("game_id, away_team_id, home_team_id")
            .in("game_id", values: gameIds)
            .execute()
            .value) ?? []
        if idRows.isEmpty { return [:] }

        let mappingRows: [MappingRow] = (try? await cfb
            .from("ncaab_team_mapping")
            .select("api_team_id, espn_team_id, team_abbrev")
            .execute()
            .value) ?? []

        var teamMap: [Int: TeamInfo] = [:]
        for row in mappingRows {
            let espnId: Int? = {
                if let n = row.espnTeamIdInt { return n }
                if let s = row.espnTeamIdString, let parsed = Int(s) { return parsed }
                return nil
            }()
            let logoUrl = espnId.map { "https://a.espncdn.com/i/teamlogos/ncaa/500/\($0).png" }
            teamMap[row.apiTeamId] = TeamInfo(abbrev: row.teamAbbrev, logoUrl: logoUrl)
        }

        var lookup: [Int: (away: TeamInfo?, home: TeamInfo?)] = [:]
        for row in idRows {
            lookup[row.gameId] = (
                away: row.awayTeamId.flatMap { teamMap[$0] },
                home: row.homeTeamId.flatMap { teamMap[$0] }
            )
        }
        return lookup
    }

    // MARK: - Helpers

    private static func bucket(pct: Double?, games: Int?) -> NCAABAccuracyBucket? {
        guard let pct, let games else { return nil }
        return NCAABAccuracyBucket(games: games, accuracyPct: pct)
    }

    private static func initials(of team: String) -> String {
        let cleaned = team.replacingOccurrences(of: "()", with: "").trimmingCharacters(in: .whitespaces)
        let words = cleaned.split(separator: " ")
        if words.count >= 2 {
            return String(words.prefix(2).map { $0.first ?? "?" })
        }
        return String(cleaned.prefix(3)).uppercased()
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

    /// One row of `ncaab_todays_games_predictions_with_accuracy` — column
    /// parity with the NBA view verified 2026-06-10 (no rank columns).
    private struct AccuracyRow: Decodable, Sendable {
        let gameId: Int
        let awayTeam: String?
        let homeTeam: String?
        let gameDate: String?
        let tipoffTimeEt: String?
        let vegasHomeSpread: Double?
        let vegasTotal: Double?
        let modelFairHomeSpread: Double?
        let predTotalPoints: Double?
        let homeWinProb: Double?
        let awayWinProb: Double?
        let modelMlWinner: String?
        let mlBucket: Double?
        let spreadAccuracyPct: Double?
        let spreadBucketGames: Int?
        let ouAccuracyPct: Double?
        let ouBucketGames: Int?
        let mlAccuracyPct: Double?
        let mlBucketGames: Int?

        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case awayTeam = "away_team"
            case homeTeam = "home_team"
            case gameDate = "game_date"
            case tipoffTimeEt = "tipoff_time_et"
            case vegasHomeSpread = "vegas_home_spread"
            case vegasTotal = "vegas_total"
            case modelFairHomeSpread = "model_fair_home_spread"
            case predTotalPoints = "pred_total_points"
            case homeWinProb = "home_win_prob"
            case awayWinProb = "away_win_prob"
            case modelMlWinner = "model_ml_winner"
            case mlBucket = "ml_bucket"
            case spreadAccuracyPct = "spread_accuracy_pct"
            case spreadBucketGames = "spread_bucket_games"
            case ouAccuracyPct = "ou_accuracy_pct"
            case ouBucketGames = "ou_bucket_games"
            case mlAccuracyPct = "ml_accuracy_pct"
            case mlBucketGames = "ml_bucket_games"
        }
    }

    private struct InputIdRow: Decodable, Sendable {
        let gameId: Int
        let awayTeamId: Int?
        let homeTeamId: Int?

        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case awayTeamId = "away_team_id"
            case homeTeamId = "home_team_id"
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
            // espn_team_id arrives as Int or String depending on the row.
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
