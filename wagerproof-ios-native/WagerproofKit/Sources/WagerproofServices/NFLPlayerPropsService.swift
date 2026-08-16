import Foundation
import Supabase
import WagerproofModels

/// Fetches the NFL player-props board from the live 2026 tables on the
/// CFB (research) Supabase project:
///
/// - `nfl_prop_player_pages` — one row per player per slate week: identity,
///   posted/pending markets, kickoff.
/// - `nfl_player_prop_trends` — prior-season game log (grades + lines).
/// - `nfl_player_game_logs` — real stat totals merged into that log.
///
/// Dry-run staging tables are not read.
public actor NFLPlayerPropsService {
    public static let shared = NFLPlayerPropsService()
    public init() {}

    /// Latest slate's player pages, enriched with L10 game logs.
    public func fetchPlayers() async throws -> [NFLPropPlayer] {
        let cfb = await CFBSupabase.shared.client
        await NFLTeamsService.shared.ensureLoaded()

        guard let slate = try await resolveSlate(client: cfb) else { return [] }

        let pages: [NFLPropPlayerPage] = try await cfb
            .from("nfl_prop_player_pages")
            .select("player_id,season,week,player_name,position,team,opponent,is_home,game_label,kickoff,headshot_url,rookie,markets")
            .eq("season", value: slate.season)
            .eq("week", value: slate.week)
            .execute()
            .value

        let history = await fetchRecentGamesFallback(
            client: cfb,
            playerIds: pages.map(\.playerId)
        )
        return NFLPlayerProps.players(from: pages, recentGames: history)
    }

    // MARK: Slate

    private struct SlateRow: Decodable {
        let season: Int
        let week: Int
    }

    /// Latest (season, week) present in the pages table — same rule as
    /// `NFLPropPageService.resolveSlate` / the web `resolveLatestSlate`.
    private func resolveSlate(client: SupabaseClient) async throws -> (season: Int, week: Int)? {
        let rows: [SlateRow] = try await client
            .from("nfl_prop_player_pages")
            .select("season,week")
            .order("season", ascending: false)
            .order("week", ascending: false)
            .limit(1)
            .execute()
            .value
        guard let row = rows.first else { return nil }
        return (row.season, row.week)
    }

    // MARK: Trends + game-log enrichment

    /// Website parity for Week 1: trends are queried by player only (no
    /// current-season filter), so the card can show the last ten games from
    /// the prior season until the new season has results.
    private func fetchRecentGamesFallback(
        client: SupabaseClient,
        playerIds: [String]
    ) async -> [String: [NFLPropRecentGame]] {
        let uniqueIds = Array(Set(playerIds))
        guard !uniqueIds.isEmpty else { return [:] }

        var trends: [NFLPropTrendsDetail] = []
        for chunk in uniqueIds.chunked(into: 120) {
            let rows: [NFLPropTrendsDetail] = (try? await client
                .from("nfl_player_prop_trends")
                .select("player_id,recent_game_log,matchups,splits")
                .in("player_id", values: chunk)
                .execute()
                .value) ?? []
            trends.append(contentsOf: rows)
        }
        guard !trends.isEmpty else { return [:] }

        let seasons = Array(Set(trends.flatMap { $0.recentGameLog.map(\.season) }))
        let weeks = Array(Set(trends.flatMap { $0.recentGameLog.map(\.week) }))
        guard !seasons.isEmpty, !weeks.isEmpty else { return [:] }

        var logs: [NFLPlayerGameLogRow] = []
        for chunk in uniqueIds.chunked(into: 120) {
            let rows: [NFLPlayerGameLogRow] = (try? await client
                .from("nfl_player_game_logs")
                .select("player_id,season,week,pass_yds,pass_tds,rush_yds,rush_tds,rec_yds,rec_tds,receptions,pass_attempts,carries,completions")
                .in("player_id", values: chunk)
                .in("season", values: seasons)
                .in("week", values: weeks)
                .execute()
                .value) ?? []
            logs.append(contentsOf: rows)
        }
        let logsByPlayer = Dictionary(grouping: logs, by: \.playerId)
        var result: [String: [NFLPropRecentGame]] = [:]
        for trend in trends {
            let enriched = NFLPropTrendsEnrichment.enrich(
                trend.recentGameLog,
                gameLogs: logsByPlayer[trend.playerId] ?? []
            )
            let markets = Set(enriched.flatMap { game in
                Array(game.actuals.keys) + Array(game.markets.keys)
            })
            for market in markets {
                let games = enriched.prefix(10).reversed().compactMap { game -> NFLPropRecentGame? in
                    guard let actual = game.actuals[market] else { return nil }
                    // Don't bake last year's O/U letter in as `cleared` —
                    // the widget grades actuals against THIS week's line.
                    return NFLPropRecentGame(
                        opp: game.opp, week: game.week, actual: actual, cleared: nil
                    )
                }
                if !games.isEmpty { result["\(trend.playerId)|\(market)"] = games }
            }
        }
        return result
    }
}

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0, !isEmpty else { return isEmpty ? [] : [self] }
        return stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}
