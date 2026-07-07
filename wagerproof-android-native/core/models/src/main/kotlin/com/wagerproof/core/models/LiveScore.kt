package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient

/**
 * App-facing live game shape (`live_scores` Supabase table, RN parity).
 * `predictions` is computed client-side by the live-scores service
 * (mirrors RN `enrichGamesWithPredictions`) — it is a derived value, not a
 * wire field, hence @Transient.
 */
@Serializable
data class LiveGame(
    val id: String,
    @SerialName("game_id") val gameId: String? = null,
    val league: String,
    @SerialName("home_team") val homeTeam: String,
    @SerialName("away_team") val awayTeam: String,
    @SerialName("home_abbr") val homeAbbr: String,
    @SerialName("away_abbr") val awayAbbr: String,
    @SerialName("home_score") val homeScore: Int,
    @SerialName("away_score") val awayScore: Int,
    val quarter: String,
    val period: String? = null,
    @SerialName("time_remaining") val timeRemaining: String,
    @SerialName("is_live") val isLive: Boolean,
    @SerialName("game_status") val gameStatus: String,
    @SerialName("last_updated") val lastUpdated: String,
    @Transient var predictions: GamePredictions? = null,
)

/**
 * Wire-level row from the `live_scores` table. Some columns arrive with
 * slightly different names than [LiveGame] (`status` not `game_status`,
 * nullable `time_remaining`) — the service transforms this into [LiveGame].
 */
@Serializable
data class LiveScoreRow(
    val id: String,
    @SerialName("game_id") val gameId: String? = null,
    val league: String,
    @SerialName("home_team") val homeTeam: String,
    @SerialName("away_team") val awayTeam: String,
    @SerialName("home_abbr") val homeAbbr: String,
    @SerialName("away_abbr") val awayAbbr: String,
    @SerialName("home_score") val homeScore: Int,
    @SerialName("away_score") val awayScore: Int,
    val period: String? = null,
    @SerialName("time_remaining") val timeRemaining: String? = null,
    @SerialName("is_live") val isLive: Boolean,
    val status: String? = null,
    @SerialName("last_updated") val lastUpdated: String? = null,
)

/**
 * Per-bet prediction status. `predicted` carries one of four capitalized
 * constants instead of a bool so the picked side renders directly
 * ("Home"/"Away" for ML+spread, "Over"/"Under" for totals).
 */
@Serializable
data class PredictionStatus(
    val predicted: Pick,
    val isHitting: Boolean,
    val probability: Double,
    val line: Double? = null,
    val currentDifferential: Double,
) {
    @Serializable
    enum class Pick(val raw: String) {
        @SerialName("Home") HOME("Home"),
        @SerialName("Away") AWAY("Away"),
        @SerialName("Over") OVER("Over"),
        @SerialName("Under") UNDER("Under"),
    }
}

/**
 * Bundle of all three predictions for a single live game. `hasAnyHitting` is
 * a stored union-OR across the three prediction states (set by the service) —
 * drives the green pulsing scoreboard card.
 */
@Serializable
data class GamePredictions(
    var hasAnyHitting: Boolean = false,
    var moneyline: PredictionStatus? = null,
    var spread: PredictionStatus? = null,
    var overUnder: PredictionStatus? = null,
)
