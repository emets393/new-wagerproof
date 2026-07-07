package com.wagerproof.core.services

import com.wagerproof.core.models.AgentLeaderboardEntry
import com.wagerproof.core.models.AgentPerformance
import com.wagerproof.core.models.AgentSport
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Per-agent performance reads + leaderboard (Main project). Port of iOS
 * `AgentPerformanceService.swift`; the leaderboard routes through the
 * server-side RPC `get_leaderboard_v2`.
 */
object AgentPerformanceService {

    enum class LeaderboardSortMode(val raw: String, val label: String) {
        OVERALL("overall", "Top 100"),
        RECENT_RUN("recent_run", "Recent Run"),
        LONGEST_STREAK("longest_streak", "Longest Streak"),
        BOTTOM_100("bottom_100", "Bottom 100"),
    }

    enum class LeaderboardTimeframe(val raw: String, val label: String) {
        ALL_TIME("all_time", "All time"),
        LAST_7_DAYS("last_7_days", "7 days"),
        LAST_30_DAYS("last_30_days", "30 days"),
    }

    /** Single agent's `avatar_performance_cache` row, or null when uncached. */
    suspend fun fetchPerformance(agentId: String): AgentPerformance? =
        SupabaseClients.main.from("avatar_performance_cache").select {
            filter { eq("avatar_id", agentId) }
            limit(1)
        }.decodeList<AgentPerformance>().firstOrNull()

    /** Server-side leaderboard via `get_leaderboard_v2`. Null params omitted (SQL defaults). */
    suspend fun fetchLeaderboard(
        limit: Int = 100,
        sport: AgentSport? = null,
        sortMode: LeaderboardSortMode = LeaderboardSortMode.OVERALL,
        excludeUnder10Picks: Boolean = false,
        timeframe: LeaderboardTimeframe = LeaderboardTimeframe.ALL_TIME,
        viewerUserId: String? = null,
    ): List<AgentLeaderboardEntry> {
        val params = buildJsonObject {
            put("p_limit", limit)
            sport?.let { put("p_sport", it.raw) }
            put("p_sort_mode", sortMode.raw)
            put("p_timeframe", timeframe.raw)
            put("p_exclude_under_10_picks", excludeUnder10Picks)
            viewerUserId?.let { put("p_viewer_user_id", it) }
        }
        return SupabaseClients.main.postgrest
            .rpc("get_leaderboard_v2", params)
            .decodeList()
    }

    /**
     * Force a server-side recompute of an agent's cached stats. Fire-and-forget:
     * a failed refresh just leaves the previous cache visible, so errors are
     * swallowed instead of surfacing to the caller.
     */
    suspend fun recalculate(agentId: String) {
        runCatching {
            SupabaseClients.main.postgrest.rpc(
                "recalculate_avatar_performance",
                buildJsonObject { put("p_avatar_id", agentId) },
            )
        }
    }
}
