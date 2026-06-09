import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// NCAAB situational betting trends store. Mirrors RN
/// `hooks/useNCAABBettingTrends.ts` end-to-end. Fetches from
/// `ncaab_game_situational_trends_today`; falls back to
/// `ncaab_game_situational_trends` when the today view is empty (matches
/// RN). After loading the rows it pairs them by `team_side`, joins logos
/// from `ncaab_team_mapping`, pulls tipoff times from `v_cbb_input_values`,
/// and computes the O/U consensus + ATS dominance scores used for sorting.
///
/// Backend queries are byte-identical to RN — the select clauses, table
/// names, and post-fetch joins must NOT diverge.
@Observable
@MainActor
public final class NCAABBettingTrendsStore {
    public enum SortMode: String, Hashable, Sendable {
        case time, ouConsensus, atsDominance
    }

    public enum LoadState: Equatable, Sendable {
        case idle, loading, loaded, refreshing
        case failed(String)
    }

    public private(set) var games: [NCAABGameTrendsData] = []
    public private(set) var loadState: LoadState = .idle
    public var sortMode: SortMode = .time {
        didSet { games = sortGames(games, mode: sortMode) }
    }
    /// Sheet-presentation state for the per-game trends detail.
    public var selectedGame: NCAABGameTrendsData?

    private let minGamesThreshold: Int = 5
    private let minPercentage: Double = 55
    private let minATSDifference: Double = 10

    public init() {}

    public func openTrendsSheet(_ game: NCAABGameTrendsData) {
        selectedGame = game
    }

    public func closeTrendsSheet() {
        selectedGame = nil
    }

    /// Lookup a single game by id. Mirrors RN's
    /// `useNCAABBettingTrendsForGame(gameId)` which reads from the same
    /// module-level cache. Returns nil if the store hasn't been refreshed or
    /// the game isn't in today's trends slate.
    public func trends(for gameId: Int) -> NCAABGameTrendsData? {
        games.first(where: { $0.gameId == gameId })
    }

    public func refresh() async {
        #if DEBUG
        // Dummy Data Mode: synthesized situational trends keyed to the captured
        // NCAAB slate so the per-game betting-trends widget populates offseason.
        if DummyDataMode.isEnabled {
            games = sortGames(DummyData.ncaabTrendsData(), mode: sortMode)
            loadState = .loaded
            return
        }
        #endif
        loadState = .loading
        let cfb = await CFBSupabase.shared.client

        // Step 1: situational trends (today's table → fallback).
        var trendsRows: [NCAABSituationalTrendRow] = []
        do {
            let primary: [NCAABSituationalTrendRow] = (try? await cfb
                .from("ncaab_game_situational_trends_today")
                .select()
                .order("game_date", ascending: true)
                .order("game_id", ascending: true)
                .execute()
                .value) ?? []
            if !primary.isEmpty {
                trendsRows = primary
            } else {
                // Fallback path mirrors RN.
                let fallback: [NCAABSituationalTrendRow] = try await cfb
                    .from("ncaab_game_situational_trends")
                    .select()
                    .order("game_date", ascending: true)
                    .order("game_id", ascending: true)
                    .execute()
                    .value
                trendsRows = fallback
            }
        } catch {
            loadState = .failed("Failed to fetch NCAAB trends: \(error.localizedDescription)")
            return
        }
        if trendsRows.isEmpty {
            games = []
            loadState = .loaded
            return
        }

        // Step 2: team logos.
        let mappingRows: [MappingRow] = (try? await cfb
            .from("ncaab_team_mapping")
            .select("api_team_id, espn_team_id")
            .execute()
            .value) ?? []
        var teamLogoMap: [Int: String?] = [:]
        for row in mappingRows {
            let espnId: Int? = {
                if let n = row.espnTeamIdInt { return n }
                if let s = row.espnTeamIdString, let parsed = Int(s) { return parsed }
                return nil
            }()
            let logo: String? = {
                guard let espnId else { return nil }
                return "https://a.espncdn.com/i/teamlogos/ncaa/500/\(espnId).png"
            }()
            teamLogoMap[row.apiTeamId] = logo
        }

        // Step 3: group rows by game_id using team_side.
        var partial: [Int: (away: NCAABSituationalTrendRow?, home: NCAABSituationalTrendRow?, awayLogo: String?, homeLogo: String?, gameDate: String)] = [:]
        for row in trendsRows {
            let side = row.teamSide.lowercased()
            guard side == "away" || side == "home" else { continue }
            let logo = teamLogoMap[row.apiTeamId] ?? nil
            var existing = partial[row.gameId] ?? (nil, nil, nil, nil, row.gameDate)
            if side == "away" {
                existing.away = row
                existing.awayLogo = logo
            } else {
                existing.home = row
                existing.homeLogo = logo
            }
            partial[row.gameId] = existing
        }

        var built: [NCAABGameTrendsData] = []
        for (gameId, slots) in partial {
            guard let away = slots.away, let home = slots.home else { continue }
            built.append(
                NCAABGameTrendsData(
                    gameId: gameId,
                    gameDate: slots.gameDate,
                    tipoffTime: nil,
                    awayTeam: away,
                    homeTeam: home,
                    awayTeamLogo: slots.awayLogo,
                    homeTeamLogo: slots.homeLogo
                )
            )
        }

        // Step 4: tipoff times from v_cbb_input_values for today's game ids.
        if !built.isEmpty {
            let gameIds = built.map { $0.gameId }
            let timeRows: [TimeRow] = (try? await cfb
                .from("v_cbb_input_values")
                .select("game_id, start_utc, tipoff_time_et")
                .in("game_id", values: gameIds)
                .execute()
                .value) ?? []
            var timesMap: [Int: String?] = [:]
            for row in timeRows {
                timesMap[row.gameId] = row.startUtc ?? row.tipoffTimeEt
            }
            built = built.map { game in
                NCAABGameTrendsData(
                    gameId: game.gameId,
                    gameDate: game.gameDate,
                    tipoffTime: timesMap[game.gameId] ?? nil,
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    awayTeamLogo: game.awayTeamLogo,
                    homeTeamLogo: game.homeTeamLogo
                )
            }
        }

        // Step 5: pre-compute sort scores per game.
        built = built.map { game in
            var copy = game
            copy.ouConsensusScore = ouConsensusStrength(for: game)
            copy.atsDominanceScore = atsDominance(for: game)
            return copy
        }

        games = sortGames(built, mode: sortMode)
        loadState = .loaded
    }

    // MARK: - Sort scoring (mirrors RN logic byte-for-byte)

    private func ouConsensusStrength(for game: NCAABGameTrendsData) -> Double {
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
                let aGames = parseNCAABRecord(b.awayRec).total
                let hGames = parseNCAABRecord(b.homeRec).total
                if aGames >= minGamesThreshold && hGames >= minGamesThreshold {
                    let totalGames = Double(aGames + hGames)
                    let avgPct = ((b.awayOver ?? 0) * Double(aGames) + (b.homeOver ?? 0) * Double(hGames)) / totalGames
                    total += avgPct * Double(min(aGames, hGames))
                }
            }
            if bothUnder {
                let aGames = parseNCAABRecord(b.awayRec).total
                let hGames = parseNCAABRecord(b.homeRec).total
                if aGames >= minGamesThreshold && hGames >= minGamesThreshold {
                    let totalGames = Double(aGames + hGames)
                    let avgPct = ((b.awayUnder ?? 0) * Double(aGames) + (b.homeUnder ?? 0) * Double(hGames)) / totalGames
                    total += avgPct * Double(min(aGames, hGames))
                }
            }
        }
        return total
    }

    private func atsDominance(for game: NCAABGameTrendsData) -> Double {
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
            let aGames = parseNCAABRecord(b.awayRec).total
            let hGames = parseNCAABRecord(b.homeRec).total
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

    private func sortGames(_ list: [NCAABGameTrendsData], mode: SortMode) -> [NCAABGameTrendsData] {
        switch mode {
        case .ouConsensus:
            return list.sorted { ($0.ouConsensusScore ?? 0) > ($1.ouConsensusScore ?? 0) }
        case .atsDominance:
            return list.sorted { ($0.atsDominanceScore ?? 0) > ($1.atsDominanceScore ?? 0) }
        case .time:
            return list.sorted { a, b in
                if let aT = a.tipoffTime, let bT = b.tipoffTime { return aT < bT }
                if a.tipoffTime != nil && b.tipoffTime == nil { return true }
                if a.tipoffTime == nil && b.tipoffTime != nil { return false }
                return a.gameDate < b.gameDate
            }
        }
    }

    private struct MappingRow: Decodable, Sendable {
        let apiTeamId: Int
        let espnTeamIdInt: Int?
        let espnTeamIdString: String?

        enum CodingKeys: String, CodingKey {
            case apiTeamId = "api_team_id"
            case espnTeamId = "espn_team_id"
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
        }
    }

    private struct TimeRow: Decodable, Sendable {
        let gameId: Int
        let startUtc: String?
        let tipoffTimeEt: String?
        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case startUtc = "start_utc"
            case tipoffTimeEt = "tipoff_time_et"
        }
    }
}
