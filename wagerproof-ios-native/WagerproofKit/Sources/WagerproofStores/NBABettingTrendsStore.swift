import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// NBA situational betting trends store. Mirrors RN
/// `hooks/useNBABettingTrends.ts` end-to-end plus the cached
/// `useNBABettingTrendsForGame` helper. Fetches from
/// `nba_game_situational_trends_today`; falls back to
/// `nba_game_situational_trends` when the today view is empty (matches RN).
/// After loading the rows it pairs them by `team_side`, joins tipoff times
/// from `nba_input_values_view`, and computes the O/U consensus + ATS
/// dominance scores used for sorting.
///
/// Backend queries are byte-identical to RN — the select clauses, table
/// names, and post-fetch joins must NOT diverge. Aligned with sibling
/// `NCAABBettingTrendsStore` (see ticket #070 for parity between sports).
@Observable
@MainActor
public final class NBABettingTrendsStore {
    public enum SortMode: String, Hashable, Sendable {
        case time, ouConsensus, atsDominance
    }

    public enum LoadState: Equatable, Sendable {
        case idle, loading, loaded, refreshing
        case failed(String)
    }

    public private(set) var games: [NBAGameTrendsData] = []
    public private(set) var loadState: LoadState = .idle
    /// Set on every successful refresh (including the DummyData branch).
    /// Drives both the TTL guard below and the game sheets' first-hydrate
    /// skeleton rule (`loading && lastFetched == nil`).
    public private(set) var lastFetched: Date?

    private let minGamesThreshold: Int = 5
    private let minPercentage: Double = 55
    private let minATSDifference: Double = 10

    public init() {}

    /// Lookup a single game by id. Mirrors RN's
    /// `useNBABettingTrendsForGame(gameId)` which reads from the same
    /// module-level cache.
    public func trends(for gameId: Int) -> NBAGameTrendsData? {
        games.first(where: { $0.gameId == gameId })
    }

    /// Idempotent hydrate for sheet-local stores — skips the network while a
    /// fetch is in flight or the slate is fresh, so swiping through the game
    /// carousel doesn't refetch the whole trends view per page. Mirrors
    /// `MLBBettingTrendsStore.refreshIfNeeded`.
    public func refreshIfNeeded(maxAge: TimeInterval = 600) async {
        if loadState == .loading || loadState == .refreshing { return }
        if let lastFetched, Date().timeIntervalSince(lastFetched) < maxAge { return }
        await refresh()
    }

    public func refresh() async {
        #if DEBUG
        // Dummy Data Mode: synthesized situational trends keyed to the captured
        // NBA slate so the per-game betting-trends widget populates offseason.
        if DummyDataMode.isEnabled {
            games = sortGames(DummyData.nbaTrendsData(), mode: .time)
            loadState = .loaded
            lastFetched = Date()
            return
        }
        #endif
        loadState = .loading
        let cfb = await CFBSupabase.shared.client

        // Step 1: situational trends (today's table → fallback).
        var trendsRows: [NBASituationalTrendRow] = []
        do {
            let primary: [NBASituationalTrendRow] = (try? await cfb
                .from("nba_game_situational_trends_today")
                .select()
                .order("game_date", ascending: true)
                .order("game_id", ascending: true)
                .execute()
                .value) ?? []
            if !primary.isEmpty {
                trendsRows = primary
            } else {
                // Fallback path mirrors RN.
                let fallback: [NBASituationalTrendRow] = try await cfb
                    .from("nba_game_situational_trends")
                    .select()
                    .order("game_date", ascending: true)
                    .order("game_id", ascending: true)
                    .execute()
                    .value
                trendsRows = fallback
            }
        } catch {
            loadState = .failed("Failed to fetch NBA trends: \(error.localizedDescription)")
            return
        }
        if trendsRows.isEmpty {
            games = []
            loadState = .loaded
            lastFetched = Date()
            return
        }

        // Step 2: group rows by game_id using team_side.
        var partial: [Int: (away: NBASituationalTrendRow?, home: NBASituationalTrendRow?, gameDate: String)] = [:]
        for row in trendsRows {
            let side = row.teamSide.lowercased()
            guard side == "away" || side == "home" else { continue }
            var existing = partial[row.gameId] ?? (nil, nil, row.gameDate)
            if side == "away" {
                existing.away = row
            } else {
                existing.home = row
            }
            partial[row.gameId] = existing
        }

        var built: [NBAGameTrendsData] = []
        for (gameId, slots) in partial {
            guard let away = slots.away, let home = slots.home else { continue }
            built.append(
                NBAGameTrendsData(
                    gameId: gameId,
                    gameDate: slots.gameDate,
                    tipoffTime: nil,
                    awayTeam: away,
                    homeTeam: home
                )
            )
        }

        // Step 3: tipoff times from nba_input_values_view for today's game ids.
        if !built.isEmpty {
            let gameIds = built.map { $0.gameId }
            let timeRows: [TipoffRow] = (try? await cfb
                .from("nba_input_values_view")
                .select("game_id, tipoff_time_et")
                .in("game_id", values: gameIds)
                .execute()
                .value) ?? []
            var timesMap: [Int: String] = [:]
            for row in timeRows {
                if let t = row.tipoffTimeEt { timesMap[row.gameId] = t }
            }
            built = built.map { game in
                var copy = game
                copy.tipoffTime = timesMap[game.gameId]
                return copy
            }
        }

        games = sortGames(built, mode: .time)
        loadState = .loaded
        lastFetched = Date()
    }

    // MARK: - Sort scoring (mirrors RN logic byte-for-byte)

    private func ouConsensusStrength(for game: NBAGameTrendsData) -> Double {
        var total: Double = 0
        let buckets: [(awayOver: Double?, awayUnder: Double?, awayRec: String?,
                       homeOver: Double?, homeUnder: Double?, homeRec: String?)] = [
            (game.awayTeam.ouLastGameOverPct, game.awayTeam.ouLastGameUnderPct, game.awayTeam.ouLastGameRecord,
             game.homeTeam.ouLastGameOverPct, game.homeTeam.ouLastGameUnderPct, game.homeTeam.ouLastGameRecord),
            (game.awayTeam.ouFavDogOverPct, game.awayTeam.ouFavDogUnderPct, game.awayTeam.ouFavDogRecord,
             game.homeTeam.ouFavDogOverPct, game.homeTeam.ouFavDogUnderPct, game.homeTeam.ouFavDogRecord),
            (game.awayTeam.ouSideFavDogOverPct, game.awayTeam.ouSideFavDogUnderPct, game.awayTeam.ouSideFavDogRecord,
             game.homeTeam.ouSideFavDogOverPct, game.homeTeam.ouSideFavDogUnderPct, game.homeTeam.ouSideFavDogRecord),
            (game.awayTeam.ouRestBucketOverPct, game.awayTeam.ouRestBucketUnderPct, game.awayTeam.ouRestBucketRecord,
             game.homeTeam.ouRestBucketOverPct, game.homeTeam.ouRestBucketUnderPct, game.homeTeam.ouRestBucketRecord),
            (game.awayTeam.ouRestCompOverPct, game.awayTeam.ouRestCompUnderPct, game.awayTeam.ouRestCompRecord,
             game.homeTeam.ouRestCompOverPct, game.homeTeam.ouRestCompUnderPct, game.homeTeam.ouRestCompRecord)
        ]
        for b in buckets {
            let bothOver = (b.awayOver ?? 0) > minPercentage && (b.homeOver ?? 0) > minPercentage
            let bothUnder = (b.awayUnder ?? 0) > minPercentage && (b.homeUnder ?? 0) > minPercentage
            if bothOver {
                let aGames = parseNBARecord(b.awayRec).total
                let hGames = parseNBARecord(b.homeRec).total
                if aGames >= minGamesThreshold && hGames >= minGamesThreshold {
                    let totalGames = Double(aGames + hGames)
                    let avgPct = ((b.awayOver ?? 0) * Double(aGames) + (b.homeOver ?? 0) * Double(hGames)) / totalGames
                    total += avgPct * Double(min(aGames, hGames))
                }
            }
            if bothUnder {
                let aGames = parseNBARecord(b.awayRec).total
                let hGames = parseNBARecord(b.homeRec).total
                if aGames >= minGamesThreshold && hGames >= minGamesThreshold {
                    let totalGames = Double(aGames + hGames)
                    let avgPct = ((b.awayUnder ?? 0) * Double(aGames) + (b.homeUnder ?? 0) * Double(hGames)) / totalGames
                    total += avgPct * Double(min(aGames, hGames))
                }
            }
        }
        return total
    }

    private func atsDominance(for game: NBAGameTrendsData) -> Double {
        var total: Double = 0
        let buckets: [(awayPct: Double?, awayRec: String?, homePct: Double?, homeRec: String?)] = [
            (game.awayTeam.atsLastGameCoverPct, game.awayTeam.atsLastGameRecord,
             game.homeTeam.atsLastGameCoverPct, game.homeTeam.atsLastGameRecord),
            (game.awayTeam.atsFavDogCoverPct, game.awayTeam.atsFavDogRecord,
             game.homeTeam.atsFavDogCoverPct, game.homeTeam.atsFavDogRecord),
            (game.awayTeam.atsSideFavDogCoverPct, game.awayTeam.atsSideFavDogRecord,
             game.homeTeam.atsSideFavDogCoverPct, game.homeTeam.atsSideFavDogRecord),
            (game.awayTeam.atsRestBucketCoverPct, game.awayTeam.atsRestBucketRecord,
             game.homeTeam.atsRestBucketCoverPct, game.homeTeam.atsRestBucketRecord),
            (game.awayTeam.atsRestCompCoverPct, game.awayTeam.atsRestCompRecord,
             game.homeTeam.atsRestCompCoverPct, game.homeTeam.atsRestCompRecord)
        ]
        for b in buckets {
            guard let aPct = b.awayPct, let hPct = b.homePct else { continue }
            let aGames = parseNBARecord(b.awayRec).total
            let hGames = parseNBARecord(b.homeRec).total
            let minGames = min(aGames, hGames)
            if minGames >= minGamesThreshold {
                let diff = abs(aPct - hPct)
                if diff > minATSDifference {
                    total += diff * Double(minGames)
                }
            }
        }
        return total
    }

    private func sortGames(_ list: [NBAGameTrendsData], mode: SortMode) -> [NBAGameTrendsData] {
        switch mode {
        case .ouConsensus:
            return list.sorted { ouConsensusStrength(for: $0) > ouConsensusStrength(for: $1) }
        case .atsDominance:
            return list.sorted { atsDominance(for: $0) > atsDominance(for: $1) }
        case .time:
            return list.sorted { a, b in
                if let aT = a.tipoffTime, let bT = b.tipoffTime { return aT < bT }
                if a.tipoffTime != nil && b.tipoffTime == nil { return true }
                if a.tipoffTime == nil && b.tipoffTime != nil { return false }
                return a.gameDate < b.gameDate
            }
        }
    }

    private struct TipoffRow: Decodable, Sendable {
        let gameId: Int
        let tipoffTimeEt: String?
        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case tipoffTimeEt = "tipoff_time_et"
        }
    }

    // MARK: - Debug helpers

    #if DEBUG
    public func debugSet(_ list: [NBAGameTrendsData], state: LoadState = .loaded) {
        self.games = list
        self.loadState = state
        self.lastFetched = Date()
    }
    #endif
}
