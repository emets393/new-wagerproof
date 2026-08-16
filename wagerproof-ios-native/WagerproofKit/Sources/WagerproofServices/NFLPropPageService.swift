import Foundation
import Supabase
import WagerproofModels

/// Everything the NFL player-analysis detail fetches beyond the props-feed
/// selection: the page row and the trends row, each degrading to nil alone.
public struct NFLPropPlayerDetailBundle: Sendable {
    /// Nil ⇒ fall back to the selection's markets (offseason / rookie week).
    public let page: NFLPropPlayerPage?
    public let trends: NFLPropTrendsDetail?

    public init(page: NFLPropPlayerPage?, trends: NFLPropTrendsDetail?) {
        self.page = page
        self.trends = trends
    }
}

/// Fetches the NFL player-analysis contract from the CFB (research) Supabase
/// project — the same three tables the web `/props` player drilldown reads
/// (`src/features/propBreakdown/hooks.ts`):
///
/// - `nfl_prop_player_pages` — one row per player per slate week: posted
///   markets, WagerProof projection, scheme compare, per-game splits.
/// - `nfl_player_prop_trends` — one row per player: recent game log,
///   career H2H matchups, situational splits.
/// - `nfl_player_game_logs` — real stat totals merged into the game log's
///   `actuals` (the served log carries grades; the chart needs quantities).
public actor NFLPropPageService {
    public static let shared = NFLPropPageService()
    public init() {}

    private let ttl: TimeInterval = 300
    private var cache: [String: (at: Date, bundle: NFLPropPlayerDetailBundle)] = [:]
    private var slate: (at: Date, season: Int, week: Int)?

    public func detail(playerId: String) async -> NFLPropPlayerDetailBundle {
        if let hit = cache[playerId], Date().timeIntervalSince(hit.at) < ttl {
            return hit.bundle
        }

        let cfb = await CFBSupabase.shared.client
        // Trends are keyed by player only; the page needs the latest slate.
        // Each leg degrades to nil independently — an offseason-empty pages
        // table must not blank the trends widgets.
        async let pageTask = fetchPage(client: cfb, playerId: playerId)
        async let trendsTask = fetchTrends(client: cfb, playerId: playerId)
        let bundle = NFLPropPlayerDetailBundle(page: await pageTask, trends: await trendsTask)
        cache[playerId] = (Date(), bundle)
        return bundle
    }

    // MARK: Page

    private func fetchPage(client: SupabaseClient, playerId: String) async -> NFLPropPlayerPage? {
        guard let slate = await resolveSlate(client: client) else { return nil }
        let rows: [NFLPropPlayerPage]? = try? await client
            .from("nfl_prop_player_pages")
            .select()
            .eq("season", value: slate.season)
            .eq("week", value: slate.week)
            .eq("player_id", value: playerId)
            .limit(1)
            .execute()
            .value
        return rows?.first
    }

    /// Latest (season, week) present in the pages table, mirroring the web's
    /// `resolveLatestSlate`. Cached; nil while the table is empty (offseason).
    private func resolveSlate(client: SupabaseClient) async -> (season: Int, week: Int)? {
        if let slate, Date().timeIntervalSince(slate.at) < ttl {
            return (slate.season, slate.week)
        }
        struct SlateRow: Decodable {
            let season: Int
            let week: Int
        }
        let rows: [SlateRow]? = try? await client
            .from("nfl_prop_player_pages")
            .select("season,week")
            .order("season", ascending: false)
            .order("week", ascending: false)
            .limit(1)
            .execute()
            .value
        guard let row = rows?.first else { return nil }
        slate = (Date(), row.season, row.week)
        return (row.season, row.week)
    }

    // MARK: Trends + game-log enrichment

    private func fetchTrends(client: SupabaseClient, playerId: String) async -> NFLPropTrendsDetail? {
        let rows: [NFLPropTrendsDetail]? = try? await client
            .from("nfl_player_prop_trends")
            .select("player_id,recent_game_log,matchups,splits")
            .eq("player_id", value: playerId)
            .limit(1)
            .execute()
            .value
        guard var trends = rows?.first else { return nil }
        guard !trends.recentGameLog.isEmpty else { return trends }

        let seasons = Array(Set(trends.recentGameLog.map(\.season)))
        let weeks = Array(Set(trends.recentGameLog.map(\.week)))
        // seasons × weeks is a cross-product superset (same as the web query);
        // the "\(season)-\(week)" keyed merge discards the extras.
        let logs: [NFLPlayerGameLogRow]? = try? await client
            .from("nfl_player_game_logs")
            .select("player_id,season,week,pass_yds,pass_tds,rush_yds,rush_tds,rec_yds,rec_tds,receptions,pass_attempts,carries,completions")
            .eq("player_id", value: playerId)
            .in("season", values: seasons)
            .in("week", values: weeks)
            .execute()
            .value
        if let logs, !logs.isEmpty {
            trends.recentGameLog = NFLPropTrendsEnrichment.enrich(trends.recentGameLog, gameLogs: logs)
        }
        return trends
    }
}
