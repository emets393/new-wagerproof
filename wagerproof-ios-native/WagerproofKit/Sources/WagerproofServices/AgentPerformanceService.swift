import Foundation
import Supabase
import WagerproofModels

/// Port of `wagerproof-mobile/services/agentPerformanceService.ts`. All reads
/// hit the main Supabase project. The leaderboard fetch routes through the
/// server-side RPC `get_leaderboard_v2`; we keep the table-join fallback in
/// reserve (lands in B16 — for B13 the RPC always responds).
public enum AgentPerformanceService {
    public enum LeaderboardSortMode: String, Sendable, CaseIterable {
        case overall
        case recentRun = "recent_run"
        case longestStreak = "longest_streak"
        case bottom100 = "bottom_100"

        public var label: String {
            switch self {
            case .overall: return "Top 100"
            case .recentRun: return "Recent Run"
            case .longestStreak: return "Longest Streak"
            case .bottom100: return "Bottom 100"
            }
        }
    }

    public enum LeaderboardTimeframe: String, Sendable, CaseIterable {
        case allTime = "all_time"
        case last7Days = "last_7_days"
        case last30Days = "last_30_days"

        public var label: String {
            switch self {
            case .allTime: return "All time"
            case .last7Days: return "7 days"
            case .last30Days: return "30 days"
            }
        }
    }

    /// Fetch a single agent's performance cache row. Mirrors
    /// `fetchAgentPerformance`.
    public static func fetchPerformance(agentId: String) async throws -> AgentPerformance? {
        let main = await MainSupabase.shared.client
        let rows: [AgentPerformance] = try await main
            .from("avatar_performance_cache")
            .select()
            .eq("avatar_id", value: agentId)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    /// Server-side leaderboard via `get_leaderboard_v2` RPC. Mirrors
    /// `fetchLeaderboardV2`.
    public static func fetchLeaderboard(
        limit: Int = 100,
        sport: AgentSport? = nil,
        sortMode: LeaderboardSortMode = .overall,
        excludeUnder10Picks: Bool = false,
        timeframe: LeaderboardTimeframe = .allTime,
        viewerUserId: String? = nil
    ) async throws -> [AgentLeaderboardEntry] {
        let main = await MainSupabase.shared.client
        struct Params: Encodable {
            let p_limit: Int
            let p_sport: String?
            let p_sort_mode: String
            let p_timeframe: String
            let p_exclude_under_10_picks: Bool
            let p_viewer_user_id: String?
        }
        let params = Params(
            p_limit: limit,
            p_sport: sport?.rawValue,
            p_sort_mode: sortMode.rawValue,
            p_timeframe: timeframe.rawValue,
            p_exclude_under_10_picks: excludeUnder10Picks,
            p_viewer_user_id: viewerUserId
        )

        let entries: [AgentLeaderboardEntry] = try await main
            .rpc("get_leaderboard_v2", params: params)
            .execute()
            .value
        return entries
    }

    /// Force a server-side recompute. Used after the user grades picks locally
    /// (lands in B15) — exposed now so it's available for AgentDetailView when
    /// it ports.
    public static func recalculate(agentId: String) async throws {
        let main = await MainSupabase.shared.client
        struct Params: Encodable { let p_avatar_id: String }
        _ = try await main
            .rpc("recalculate_avatar_performance", params: Params(p_avatar_id: agentId))
            .execute()
    }
}
