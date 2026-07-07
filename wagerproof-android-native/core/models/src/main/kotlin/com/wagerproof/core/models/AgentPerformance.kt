package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FlexibleDoubleOrZeroSerializer
import java.util.Locale
import kotlin.math.abs
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Mirror of `avatar_performance_cache` rows in main Supabase (RN
 * `AgentPerformance`). Cache is refreshed by the `recalculate_avatar_performance`
 * RPC after picks are graded. The `stats_by_sport` / `stats_by_bet_type` JSONB
 * blobs decode loosely as maps so an unknown sport key doesn't blow up decoding.
 */
@Serializable
data class AgentPerformance(
    @SerialName("avatar_id") val avatarId: String,
    @SerialName("total_picks") var totalPicks: Int = 0,
    var wins: Int = 0,
    var losses: Int = 0,
    var pushes: Int = 0,
    var pending: Int = 0,
    @SerialName("win_rate") var winRate: Double? = null,
    // net_units may arrive as Number or String (Postgres NUMERIC).
    @SerialName("net_units")
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    var netUnits: Double = 0.0,
    @SerialName("current_streak") var currentStreak: Int = 0,
    @SerialName("best_streak") var bestStreak: Int = 0,
    @SerialName("worst_streak") var worstStreak: Int = 0,
    @SerialName("stats_by_sport") var statsBySport: Map<String, SportStats> = emptyMap(),
    @SerialName("stats_by_bet_type") var statsByBetType: Map<String, SportStats> = emptyMap(),
    @SerialName("last_calculated_at") var lastCalculatedAt: String? = null,
) {
    @Serializable
    data class SportStats(
        var wins: Int = 0,
        var losses: Int = 0,
        var pushes: Int = 0,
        var total: Int = 0,
    )

    // Formatting helpers — port of types/agent.ts:520-543 (shared with iOS/web).

    /** "W-L" or "W-L-P" record string. Mirrors `formatRecord`. */
    val recordLabel: String
        get() {
            val parts = mutableListOf(wins.toString(), losses.toString())
            if (pushes > 0) parts += pushes.toString()
            return parts.joinToString("-")
        }

    /** "+1.23u" / "-0.50u". Mirrors `formatNetUnits`. */
    val netUnitsLabel: String
        get() {
            val sign = if (netUnits >= 0) "+" else ""
            return String.format(Locale.US, "%s%.2fu", sign, netUnits)
        }

    /** "W3" / "L2" / "-". Mirrors `formatStreak`. */
    val currentStreakLabel: String
        get() = when {
            currentStreak == 0 -> "-"
            currentStreak > 0 -> "W$currentStreak"
            else -> "L${abs(currentStreak)}"
        }
}

/**
 * Leaderboard row as returned by the `get_leaderboard_v2` RPC (RN
 * `LeaderboardEntry`). Required: avatarId, name, userId.
 */
@Serializable
data class AgentLeaderboardEntry(
    @SerialName("avatar_id") val avatarId: String,
    val name: String,
    @SerialName("avatar_emoji") val avatarEmoji: String = "🤖",
    @SerialName("avatar_color") val avatarColor: String = "#6366f1",
    @SerialName("user_id") val userId: String,
    @SerialName("preferred_sports") val preferredSports: List<AgentSport> = emptyList(),
    @SerialName("total_picks") val totalPicks: Int = 0,
    val wins: Int = 0,
    val losses: Int = 0,
    val pushes: Int = 0,
    @SerialName("win_rate") val winRate: Double? = null,
    @SerialName("net_units")
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    val netUnits: Double = 0.0,
    @SerialName("current_streak") val currentStreak: Int = 0,
    @SerialName("best_streak") val bestStreak: Int = 0,
) {
    val id: String get() = avatarId

    /**
     * Stable pixel-office character index (0…7) — same derivation as
     * `Agent.spriteIndex` so a leaderboard row and the agent's own card show
     * the identical character.
     */
    val spriteIndex: Int get() = AgentSpriteIndex.forSeed(avatarId)
}
