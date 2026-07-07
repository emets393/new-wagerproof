package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FlexibleDoubleOrZeroSerializer
import com.wagerproof.core.models.serialization.FlexibleDoubleSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * One agent's aggregate performance as returned by the
 * `get_agent_performance_distribution` RPC — the whole-population row set the
 * Agents "Platform Statistics" histograms + normal fit are built from.
 *
 * Deliberately PII-free: no name / user_id (those only appear in the public
 * drill-down via [BinAgent]). `winRate` is the RPC's recomputed
 * wins/(wins+losses) in 0…1 (pushes excluded); `statsBySport` carries the same
 * per-sport `{wins,losses,pushes,total}` blob as `AgentPerformance` so the
 * client can slice per-sport distributions without a refetch.
 */
@Serializable
data class AgentStatDatum(
    @SerialName("avatar_id") val avatarId: String,
    val archetype: String? = null,
    @SerialName("is_public") val isPublic: Boolean = false,
    val wins: Int = 0,
    val losses: Int = 0,
    val pushes: Int = 0,
    // Backing field: some RPC versions omit `decided`; the resolved value falls
    // back to wins+losses (Swift `?? (wins + losses)` in init).
    @SerialName("decided") private val decidedRaw: Int? = null,
    @SerialName("win_rate")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val winRate: Double? = null,
    @SerialName("net_units")
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    val netUnits: Double = 0.0,
    @SerialName("stats_by_sport") val statsBySport: Map<String, AgentPerformance.SportStats> = emptyMap(),
    @SerialName("last_calculated_at") val lastCalculatedAt: String? = null,
) {
    val id: String get() = avatarId

    val decided: Int get() = decidedRaw ?: (wins + losses)

    /** Settled picks (wins + losses) for `sportKey` (lowercase, e.g. "mlb"). */
    fun decided(sportKey: String): Int {
        val s = statsBySport[sportKey] ?: return 0
        return s.wins + s.losses
    }

    /**
     * Win rate (0…1, pushes excluded) for `sportKey`, or null when that sport
     * has no settled picks for this agent.
     */
    fun winRate(sportKey: String): Double? {
        val s = statsBySport[sportKey] ?: return null
        val decidedForSport = s.wins + s.losses
        if (decidedForSport <= 0) return null
        return s.wins.toDouble() / decidedForSport
    }
}

/**
 * A public agent surfaced in the tap-a-bar drill-down, from the
 * `get_distribution_bin_agents` RPC: identity + record + this agent's
 * currently-open (pending) picks. Only public agents are ever returned; the
 * RPC enforces that server-side.
 */
@Serializable
data class BinAgent(
    @SerialName("avatar_id") val avatarId: String,
    val name: String = "Agent",
    @SerialName("avatar_emoji") val avatarEmoji: String = "🤖",
    @SerialName("avatar_color") val avatarColor: String = "#6366f1",
    val archetype: String? = null,
    val wins: Int = 0,
    val losses: Int = 0,
    val pushes: Int = 0,
    @SerialName("win_rate")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val winRate: Double? = null,
    @SerialName("net_units")
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    val netUnits: Double = 0.0,
    // Lossy — one malformed pick shouldn't blank the whole drill-down list.
    @SerialName("pending_picks")
    @Serializable(with = AgentPickLossyListSerializer::class)
    val pendingPicks: List<AgentPick> = emptyList(),
) {
    val id: String get() = avatarId

    /** "W-L" / "W-L-P" record string, mirroring `AgentPerformance.recordLabel`. */
    val recordLabel: String
        get() {
            val parts = mutableListOf(wins.toString(), losses.toString())
            if (pushes > 0) parts.add(pushes.toString())
            return parts.joinToString("-")
        }
}
