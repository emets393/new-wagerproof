package com.wagerproof.core.services

import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.models.AgentStatDatum
import com.wagerproof.core.models.BinAgent
import com.wagerproof.core.models.StatMetric
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Population-level analytics for the Agents "Platform Statistics" screen (Main
 * project) — kept separate from the per-agent/leaderboard reads in
 * [AgentPerformanceService]. Port of iOS `PlatformStatsService.swift`.
 */
object PlatformStatsService {

    /**
     * Every agent with at least [minDecided] settled picks (wins+losses).
     * Raw per-agent rows fetched once; all re-bucketing (threshold slider,
     * bin width, metric, sport) happens client-side with no refetch.
     */
    suspend fun fetchAgentDistribution(minDecided: Int = 1): List<AgentStatDatum> =
        SupabaseClients.main.postgrest.rpc(
            "get_agent_performance_distribution",
            buildJsonObject { put("p_min_decided", minDecided) },
        ).decodeList()

    /**
     * Top public agents whose [metric] falls in `[lower, upper]`, ranked by net
     * units, each with their currently-open picks — the tap-a-bar drill-down.
     * [sport] scopes the returned pending picks (null = all sports).
     */
    suspend fun fetchBinAgents(
        metric: StatMetric,
        sport: AgentSport? = null,
        lower: Double,
        upper: Double,
        minDecided: Int,
        limit: Int = 20,
    ): List<BinAgent> {
        val params = buildJsonObject {
            put("p_metric", metric.sqlValue)
            sport?.let { put("p_sport", it.raw) }
            put("p_lower", lower)
            put("p_upper", upper)
            put("p_min_decided", minDecided)
            put("p_limit", limit)
        }
        return SupabaseClients.main.postgrest
            .rpc("get_distribution_bin_agents", params)
            .decodeList()
    }
}

// The p_metric value the RPC expects (`avatar_performance_cache` column
// naming) — distinct from StatMetric.raw, which is the client-side key.
private val StatMetric.sqlValue: String
    get() = when (this) {
        StatMetric.WIN_RATE -> "win_rate"
        StatMetric.NET_UNITS -> "net_units"
    }
