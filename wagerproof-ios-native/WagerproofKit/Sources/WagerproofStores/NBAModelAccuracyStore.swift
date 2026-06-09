import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// NBA model-accuracy store. Mirrors RN
/// `hooks/useNBAModelAccuracy.ts` + `hooks/useModelAccuracyForGame.ts`.
/// Pulls `nba_todays_games_predictions_with_accuracy` once and caches the
/// resulting `[Int: NBAModelAccuracyData]` map keyed by `game_id`.
///
/// Like the trends store, this consolidates the RN module-level promise
/// cache + the hook's local state into one observable store.
@Observable
@MainActor
public final class NBAModelAccuracyStore {
    public enum SortMode: String, Hashable, Sendable {
        case time, spread, moneyline, ou
    }

    public enum LoadState: Equatable, Sendable {
        case idle, loading, loaded
        case failed(String)
    }

    public private(set) var accuracyById: [Int: NBAModelAccuracyData] = [:]
    public private(set) var loadState: LoadState = .idle
    public var sortMode: SortMode = .time

    public init() {}

    public var games: [NBAModelAccuracyData] {
        sorted(Array(accuracyById.values), mode: sortMode)
    }

    public func accuracy(for gameId: Int) -> NBAModelAccuracyData? {
        accuracyById[gameId]
    }

    public func refresh(force: Bool = false) async {
        if case .loading = loadState { return }
        if case .loaded = loadState, !force, !accuracyById.isEmpty { return }
        #if DEBUG
        // Dummy Data Mode: synthesized per-game accuracy keyed to the captured
        // NBA slate so the model-accuracy widget populates offseason.
        if DummyDataMode.isEnabled {
            accuracyById = Dictionary(
                DummyData.nbaAccuracy().map { ($0.gameId, $0) },
                uniquingKeysWith: { a, _ in a }
            )
            loadState = .loaded
            return
        }
        #endif
        loadState = .loading
        do {
            let cfb = await CFBSupabase.shared.client
            let rows: [AccuracyRow] = try await cfb
                .from("nba_todays_games_predictions_with_accuracy")
                .select()
                .order("game_date", ascending: true)
                .order("tipoff_time_et", ascending: true)
                .execute()
                .value

            var map: [Int: NBAModelAccuracyData] = [:]
            for row in rows {
                let vegasHomeSpread = row.vegasHomeSpread
                let vegasTotal = row.vegasTotal
                let modelFair = row.modelFairHomeSpread
                let predTotal = row.predTotalPoints
                let homeSpreadDiff: Double? = (vegasHomeSpread != nil && modelFair != nil)
                    ? (vegasHomeSpread! - modelFair!) : nil
                let overLineDiff: Double? = (vegasTotal != nil && predTotal != nil)
                    ? (predTotal! - vegasTotal!) : nil
                let mlPickIsHome: Bool? = {
                    switch row.modelMlWinner {
                    case "home": return true
                    case "away": return false
                    default: return nil
                    }
                }()
                let spreadAcc: NBAAccuracyBucket? = {
                    if let pct = row.spreadAccuracyPct, let g = row.spreadBucketGames {
                        return NBAAccuracyBucket(games: g, accuracyPct: pct)
                    }
                    return nil
                }()
                let ouAcc: NBAAccuracyBucket? = {
                    if let pct = row.ouAccuracyPct, let g = row.ouBucketGames {
                        return NBAAccuracyBucket(games: g, accuracyPct: pct)
                    }
                    return nil
                }()
                let mlAcc: NBAAccuracyBucket? = {
                    if let pct = row.mlAccuracyPct, let g = row.mlBucketGames {
                        return NBAAccuracyBucket(games: g, accuracyPct: pct)
                    }
                    return nil
                }()

                let data = NBAModelAccuracyData(
                    gameId: row.gameId,
                    awayTeam: row.awayTeam ?? "",
                    homeTeam: row.homeTeam ?? "",
                    awayAbbr: row.awayTeam.flatMap { Self.initials(for: $0) } ?? "",
                    homeAbbr: row.homeTeam.flatMap { Self.initials(for: $0) } ?? "",
                    gameDate: row.gameDate ?? "",
                    tipoffTime: row.tipoffTimeEt,
                    homeSpread: vegasHomeSpread,
                    homeSpreadDiff: homeSpreadDiff,
                    spreadAccuracy: spreadAcc,
                    homeWinProb: row.homeWinProb,
                    awayWinProb: row.awayWinProb,
                    mlPickIsHome: mlPickIsHome,
                    mlPickProbRounded: row.mlBucket,
                    mlAccuracy: mlAcc,
                    overLine: vegasTotal,
                    overLineDiff: overLineDiff,
                    ouAccuracy: ouAcc
                )
                map[row.gameId] = data
            }
            self.accuracyById = map
            self.loadState = .loaded
        } catch {
            self.loadState = .failed("Failed to fetch NBA model accuracy")
        }
    }

    private func sorted(_ list: [NBAModelAccuracyData], mode: SortMode) -> [NBAModelAccuracyData] {
        let byTime: (NBAModelAccuracyData, NBAModelAccuracyData) -> Bool = { a, b in
            if a.gameDate != b.gameDate { return a.gameDate < b.gameDate }
            return (a.tipoffTime ?? "") < (b.tipoffTime ?? "")
        }
        switch mode {
        case .time:
            return list.sorted(by: byTime)
        case .spread:
            return list.sorted { ($0.spreadAccuracy?.accuracyPct ?? -1) > ($1.spreadAccuracy?.accuracyPct ?? -1) }
        case .moneyline:
            return list.sorted { ($0.mlAccuracy?.accuracyPct ?? -1) > ($1.mlAccuracy?.accuracyPct ?? -1) }
        case .ou:
            return list.sorted { ($0.ouAccuracy?.accuracyPct ?? -1) > ($1.ouAccuracy?.accuracyPct ?? -1) }
        }
    }

    /// Initials helper used purely for display rendering. Mirrors RN's
    /// `getNBATeamInitials(name)` — first letter of the last word, or the
    /// first 3 letters if the name is a single word.
    private static func initials(for team: String) -> String {
        let words = team.split(separator: " ")
        if words.count >= 2 { return String(words.last!).uppercased() }
        return String(team.prefix(3)).uppercased()
    }

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

    #if DEBUG
    public func debugSet(_ list: [NBAModelAccuracyData], state: LoadState = .loaded) {
        self.accuracyById = Dictionary(uniqueKeysWithValues: list.map { ($0.gameId, $0) })
        self.loadState = state
    }
    #endif
}
