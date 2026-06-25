import Foundation
import Supabase
import WagerproofModels

/// Port of `wagerproof-mobile/services/agentPicksService.ts`. Reads from
/// `avatar_picks` on the main Supabase project. Generation (the RPC `request-
/// avatar-picks-generation-v2` + polling) lands in B14 — this file only
/// surfaces the read paths the B13 hub needs.
public enum AgentPicksService {
    /// Fetch recent picks for an agent, newest first. Mirrors `fetchAgentPicks`.
    /// Pass `limit` to cap rows (pick-history preview); omit for the full set.
    public static func fetchPicks(agentId: String, limit: Int? = nil) async throws -> [AgentPick] {
        let main = await MainSupabase.shared.client
        var query = main
            .from("avatar_picks")
            .select()
            .eq("avatar_id", value: agentId)
            .order("game_date", ascending: false)
            .order("created_at", ascending: false)
        if let limit {
            query = query.limit(limit)
        }
        let response = try await query.execute()
        return AgentPick.decodeLossyArray(from: response.data)
    }

    /// Graded picks from prior game dates — used by the pick-history preview
    /// (excludes today's slate and any pending/ungraded rows).
    public static func fetchGradedPickHistory(agentId: String, limit: Int) async throws -> [AgentPick] {
        let main = await MainSupabase.shared.client
        let todayStr = localDateString(Date())
        let response = try await main
            .from("avatar_picks")
            .select()
            .eq("avatar_id", value: agentId)
            .lt("game_date", value: todayStr)
            .in("result", values: ["won", "lost", "push"])
            .order("game_date", ascending: false)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
        return AgentPick.decodeLossyArray(from: response.data)
    }

    /// Today's picks for an agent. Used by the AgentTimeline section (B14).
    public static func fetchTodaysPicks(agentId: String) async throws -> [AgentPick] {
        let main = await MainSupabase.shared.client
        let todayStr = Self.localDateString(Date())
        let picks: [AgentPick] = try await main
            .from("avatar_picks")
            .select()
            .eq("avatar_id", value: agentId)
            .eq("game_date", value: todayStr)
            .order("created_at", ascending: false)
            .limit(25)
            .execute()
            .value
        return picks
    }

    /// Flat feed of upcoming picks (today + next 3 days) from a set of agents.
    /// Mirrors `fetchTopAgentPicksFeed`.
    public static func fetchUpcomingFeed(
        agentIds: [String],
        limit: Int = 50
    ) async throws -> [AgentPick] {
        guard !agentIds.isEmpty else { return [] }
        let main = await MainSupabase.shared.client
        let today = Date()
        let todayStr = Self.localDateString(today)
        let endDate = Calendar(identifier: .gregorian).date(byAdding: .day, value: 3, to: today) ?? today
        let endStr = Self.localDateString(endDate)
        let picks: [AgentPick] = try await main
            .from("avatar_picks")
            .select()
            .in("avatar_id", values: agentIds)
            .gte("game_date", value: todayStr)
            .lte("game_date", value: endStr)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
        return picks
    }

    /// Top picks feed across all public agents (RPC `get_top_agent_picks_feed_v2`).
    /// Used by the Top Agent Picks inner tab on the agents hub. Mirrors
    /// `fetchTopAgentPicksFeedV2` in `services/agentPicksService.ts:315-343` —
    /// supports filter mode, optional search text, cursor pagination, and an
    /// optional viewer-user-id for the `following` / `favorites` modes.
    ///
    /// `searchText` and `cursor` are forwarded directly to the RPC; pass `nil`
    /// to fetch the first page without a server-side filter.
    public static func fetchTopAgentPicksFeed(
        filterMode: String = "top10",
        viewerUserId: String? = nil,
        searchText: String? = nil,
        limit: Int = 50,
        cursor: String? = nil
    ) async throws -> [TopAgentPickFeedRow] {
        let main = await MainSupabase.shared.client
        struct Params: Encodable {
            let p_filter_mode: String
            let p_viewer_user_id: String?
            let p_search_text: String?
            let p_limit: Int
            let p_cursor: String?
        }
        let params = Params(
            p_filter_mode: filterMode,
            p_viewer_user_id: viewerUserId,
            p_search_text: searchText,
            p_limit: limit,
            p_cursor: cursor
        )
        let rows: [TopAgentPickFeedRow] = try await main
            .rpc("get_top_agent_picks_feed_v2", params: params)
            .execute()
            .value
        return rows
    }

    /// Authenticated snapshot fetch for AgentDetailView. Routes through the
    /// `agent-authorized-action-v1` edge function with `detail_snapshot`.
    /// Mirrors `fetchAgentDetailSnapshotV2`.
    public static func fetchDetailSnapshot(agentId: String) async throws -> AgentDetailSnapshot {
        try await AgentAuthorizedActionsService.detailSnapshot(agentId: agentId)
    }

    /// Authenticated paginated pick history. Mirrors `fetchAgentPicksPageV2`.
    /// Returns `AgentPicksPage` so the caller can wire infinite scroll.
    public static func fetchPicksPage(
        agentId: String,
        filter: String = "all",
        pageSize: Int = 20,
        cursor: String? = nil,
        includeOverlap: Bool = false,
        gameDate: String? = nil
    ) async throws -> AgentPicksPage {
        try await AgentAuthorizedActionsService.picksPage(
            agentId: agentId,
            filter: filter,
            pageSize: pageSize,
            cursor: cursor,
            includeOverlap: includeOverlap,
            gameDate: gameDate
        )
    }

    /// Request a fresh generation run. Returns the result; the caller refreshes
    /// the snapshot afterwards. Mirrors `generatePicks`.
    ///
    /// V3 opt-in params default to nil → omitted on the wire → V2 path unchanged.
    public static func requestGeneration(
        agentId: String,
        idempotencyKey: String? = nil,
        engineVersion: String? = nil,
        dryRun: Bool? = nil,
        modelName: String? = nil
    ) async throws -> GenerationRequestResult {
        try await AgentAuthorizedActionsService.requestGeneration(
            agentId: agentId,
            idempotencyKey: idempotencyKey,
            engineVersion: engineVersion,
            dryRun: dryRun,
            modelName: modelName
        )
    }

    /// Local YYYY-MM-DD (matches RN's `getLocalDateString`).
    private static func localDateString(_ date: Date) -> String {
        let cal = Calendar(identifier: .gregorian)
        let comps = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", comps.year ?? 1970, comps.month ?? 1, comps.day ?? 1)
    }
}
