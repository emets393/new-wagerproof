import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// Loads + caches the MLB situational betting trends slate. Mirrors RN
/// `hooks/useMLBBettingTrends.ts`. Backend behavior is byte-identical:
///   1. `mlb_situational_trends_today` (sorted by date asc, game_pk asc)
///   2. Fallback to `mlb_situational_trends` when today's table is empty
///   3. Join `mlb_games_today.game_time_et` by `game_pk`
///
/// Sorting modes (`time | ou-consensus | ml-dominance`) compute
/// scores using the same percentages-pairs algorithm as the web app.
@Observable
@MainActor
public final class MLBBettingTrendsStore {
    public private(set) var games: [MLBGameTrends] = []
    public private(set) var loading: Bool = false
    public private(set) var errorMessage: String?
    public private(set) var lastFetched: Date?

    public var sortMode: MLBTrendsSortMode = .time {
        didSet {
            if oldValue != sortMode {
                games = Self.sortGames(games, mode: sortMode)
            }
        }
    }

    public var selectedGame: MLBGameTrends?

    public init() {}

    public func openTrendsSheet(_ game: MLBGameTrends) {
        selectedGame = game
    }

    public func closeTrendsSheet() {
        selectedGame = nil
    }

    public func refresh() async {
        loading = true
        errorMessage = nil
        defer { loading = false }
        do {
            let cfb = await CFBSupabase.shared.client
            // Primary: today's slate.
            var rows: [MLBSituationalTrendRow] = (try? await cfb
                .from("mlb_situational_trends_today")
                .select()
                .order("game_date_et", ascending: true)
                .order("game_pk", ascending: true)
                .execute()
                .value) ?? []

            if rows.isEmpty {
                rows = (try? await cfb
                    .from("mlb_situational_trends")
                    .select()
                    .order("game_date_et", ascending: true)
                    .order("game_pk", ascending: true)
                    .execute()
                    .value) ?? []
            }

            if rows.isEmpty {
                games = []
                lastFetched = Date()
                return
            }

            // Bucket by game_pk, picking the right side per row.
            var buckets: [Int: (gameDate: String, away: MLBSituationalTrendRow?, home: MLBSituationalTrendRow?)] = [:]
            for r in rows {
                if r.teamSide != "away" && r.teamSide != "home" { continue }
                var entry = buckets[r.gamePk] ?? (gameDate: r.gameDateEt, away: nil, home: nil)
                entry.gameDate = r.gameDateEt
                if r.teamSide == "away" { entry.away = r } else { entry.home = r }
                buckets[r.gamePk] = entry
            }

            var combined: [MLBGameTrends] = []
            for (pk, entry) in buckets {
                guard let away = entry.away, !away.teamName.isEmpty,
                      let home = entry.home, !home.teamName.isEmpty else { continue }
                combined.append(MLBGameTrends(
                    gamePk: pk,
                    gameDateEt: entry.gameDate,
                    gameTimeEt: nil,
                    awayTeam: away,
                    homeTeam: home
                ))
            }

            // Pull game_time_et from `mlb_games_today` for the trends slate.
            let pks = combined.map { $0.gamePk }
            if !pks.isEmpty {
                struct TimeRow: Decodable {
                    let gamePk: Int
                    let gameTimeEt: String?
                    enum CodingKeys: String, CodingKey {
                        case gamePk = "game_pk"
                        case gameTimeEt = "game_time_et"
                    }
                    init(from decoder: Decoder) throws {
                        let c = try decoder.container(keyedBy: CodingKeys.self)
                        if let i = try? c.decode(Int.self, forKey: .gamePk) {
                            gamePk = i
                        } else if let s = try? c.decode(String.self, forKey: .gamePk), let i = Int(s) {
                            gamePk = i
                        } else {
                            gamePk = 0
                        }
                        gameTimeEt = try? c.decodeIfPresent(String.self, forKey: .gameTimeEt)
                    }
                }
                let timeRows: [TimeRow] = (try? await cfb
                    .from("mlb_games_today")
                    .select("game_pk, game_time_et")
                    .in("game_pk", values: pks)
                    .execute()
                    .value) ?? []
                let timeByPk = Dictionary(uniqueKeysWithValues: timeRows.map { ($0.gamePk, $0.gameTimeEt) })
                combined = combined.map { var c = $0; c.gameTimeEt = timeByPk[$0.gamePk] ?? nil; return c }
            }

            // Compute consensus scores per game (same algorithm as RN).
            combined = combined.map { game in
                var c = game
                c.ouConsensusScore = Self.calculateOUConsensus(game: c)
                c.mlDominanceScore = Self.calculateMLDominance(game: c)
                return c
            }

            games = Self.sortGames(combined, mode: sortMode)
            lastFetched = Date()
        }
    }

    // MARK: - Scoring + sorting (byte-identical to RN)

    private static func toPct(_ value: Double?) -> Double? {
        guard let v = value else { return nil }
        if v > 0, v < 1 { return v * 100 }
        return v
    }

    private static let minDiff: Double = 10

    private static func winPctPairs(_ g: MLBGameTrends) -> [(Double?, Double?)] {
        [
            (toPct(g.awayTeam.winPctLastGame), toPct(g.homeTeam.winPctLastGame)),
            (toPct(g.awayTeam.winPctHomeAway), toPct(g.homeTeam.winPctHomeAway)),
            (toPct(g.awayTeam.winPctFavDog), toPct(g.homeTeam.winPctFavDog)),
            (toPct(g.awayTeam.winPctRestBucket), toPct(g.homeTeam.winPctRestBucket)),
            (toPct(g.awayTeam.winPctRestComp), toPct(g.homeTeam.winPctRestComp)),
            (toPct(g.awayTeam.winPctLeague), toPct(g.homeTeam.winPctLeague)),
            (toPct(g.awayTeam.winPctDivision), toPct(g.homeTeam.winPctDivision)),
        ]
    }

    private static func overPctPairs(_ g: MLBGameTrends) -> [(Double?, Double?)] {
        [
            (toPct(g.awayTeam.overPctLastGame), toPct(g.homeTeam.overPctLastGame)),
            (toPct(g.awayTeam.overPctHomeAway), toPct(g.homeTeam.overPctHomeAway)),
            (toPct(g.awayTeam.overPctFavDog), toPct(g.homeTeam.overPctFavDog)),
            (toPct(g.awayTeam.overPctRestBucket), toPct(g.homeTeam.overPctRestBucket)),
            (toPct(g.awayTeam.overPctRestComp), toPct(g.homeTeam.overPctRestComp)),
            (toPct(g.awayTeam.overPctLeague), toPct(g.homeTeam.overPctLeague)),
            (toPct(g.awayTeam.overPctDivision), toPct(g.homeTeam.overPctDivision)),
        ]
    }

    public static func calculateOUConsensus(game: MLBGameTrends) -> Double {
        var total: Double = 0
        for (a, h) in overPctPairs(game) {
            if let a, let h {
                if a > 55, h > 55 { total += a + h }
                if a < 45, h < 45 { total += 200 - a - h }
            }
        }
        return total
    }

    public static func calculateMLDominance(game: MLBGameTrends) -> Double {
        var total: Double = 0
        for (a, h) in winPctPairs(game) {
            if let a, let h, abs(a - h) >= minDiff {
                total += abs(a - h)
            }
        }
        return total
    }

    public static func sortGames(_ list: [MLBGameTrends], mode: MLBTrendsSortMode) -> [MLBGameTrends] {
        switch mode {
        case .ouConsensus:
            return list.sorted { $0.ouConsensusScore > $1.ouConsensusScore }
        case .mlDominance:
            return list.sorted { $0.mlDominanceScore > $1.mlDominanceScore }
        case .time:
            return list.sorted { a, b in
                switch (a.gameTimeEt, b.gameTimeEt) {
                case let (.some(la), .some(lb)):
                    return MLBBettingTrendsStore.parseDate(la) < MLBBettingTrendsStore.parseDate(lb)
                case (.some, .none): return true
                case (.none, .some): return false
                case (.none, .none):
                    return a.gameDateEt < b.gameDateEt
                }
            }
        }
    }

    private static func parseDate(_ s: String) -> Double {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: s) { return d.timeIntervalSince1970 }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: s) { return d.timeIntervalSince1970 }
        return .greatestFiniteMagnitude
    }

    #if DEBUG
    public func debugSet(games: [MLBGameTrends], selected: MLBGameTrends? = nil) {
        self.games = games
        self.selectedGame = selected
        self.lastFetched = Date()
    }
    #endif
}
