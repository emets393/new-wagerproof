package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.math.pow

/**
 * MLB game row. Port of iOS `MLBGame.swift` (mirrors RN `types/mlb.ts`).
 * Hydrated from a 4-way merge in the game-sheet store:
 *   - `mlb_games_today` (lines, schedule, status, weather, SP)
 *   - `mlb_predictions_current` (model probs / edges / signals — full + F5)
 *   - `mlb_team_mapping` (team abbreviation + logo url by `mlb_api_id`)
 *   - `mlb_game_signals` (per-game / home / away supplemental signal pills)
 */
@Serializable
data class MLBGame(
    val id: String,
    @SerialName("game_pk") val gamePk: Int,

    // Schedule
    @SerialName("official_date") val officialDate: String,
    @SerialName("game_time_et") val gameTimeEt: String? = null,

    // Teams
    @SerialName("away_team_name") val awayTeamName: String? = null,
    @SerialName("home_team_name") val homeTeamName: String? = null,
    @SerialName("away_team") val awayTeam: String? = null,
    @SerialName("home_team") val homeTeam: String? = null,
    @SerialName("away_team_full_name") val awayTeamFullName: String? = null,
    @SerialName("home_team_full_name") val homeTeamFullName: String? = null,
    @SerialName("away_team_id") val awayTeamId: Int? = null,
    @SerialName("home_team_id") val homeTeamId: Int? = null,

    // Resolved display fields (set after team mapping)
    @SerialName("away_abbr") var awayAbbr: String = "AWY",
    @SerialName("home_abbr") var homeAbbr: String = "HME",
    @SerialName("away_logo_url") var awayLogoUrl: String? = null,
    @SerialName("home_logo_url") var homeLogoUrl: String? = null,

    // Status
    val status: String? = null,
    @SerialName("is_postponed") val isPostponed: Boolean? = null,
    @SerialName("is_completed") val isCompleted: Boolean? = null,
    @SerialName("is_active") val isActive: Boolean? = null,

    // Market lines (full game)
    @SerialName("away_ml") val awayMl: Int? = null,
    @SerialName("home_ml") val homeMl: Int? = null,
    @SerialName("away_spread") val awaySpread: Double? = null,
    @SerialName("home_spread") val homeSpread: Double? = null,
    @SerialName("total_line") val totalLine: Double? = null,

    // Full-game model outputs
    @SerialName("ml_home_win_prob") val mlHomeWinProb: Double? = null,
    @SerialName("ml_away_win_prob") val mlAwayWinProb: Double? = null,
    @SerialName("home_implied_prob") val homeImpliedProb: Double? = null,
    @SerialName("away_implied_prob") val awayImpliedProb: Double? = null,
    @SerialName("home_ml_edge_pct") val homeMlEdgePct: Double? = null,
    @SerialName("away_ml_edge_pct") val awayMlEdgePct: Double? = null,
    @SerialName("home_ml_strong_signal") val homeMlStrongSignal: Boolean? = null,
    @SerialName("away_ml_strong_signal") val awayMlStrongSignal: Boolean? = null,
    @SerialName("ou_edge") val ouEdge: Double? = null,
    /** "OVER" | "UNDER" */
    @SerialName("ou_direction") val ouDirection: String? = null,
    @SerialName("ou_fair_total") val ouFairTotal: Double? = null,
    @SerialName("ou_strong_signal") val ouStrongSignal: Boolean? = null,
    @SerialName("ou_moderate_signal") val ouModerateSignal: Boolean? = null,

    // First five (F5)
    @SerialName("f5_home_ml") val f5HomeMl: Int? = null,
    @SerialName("f5_away_ml") val f5AwayMl: Int? = null,
    @SerialName("f5_fair_total") val f5FairTotal: Double? = null,
    @SerialName("f5_pred_margin") val f5PredMargin: Double? = null,
    @SerialName("f5_total_line") val f5TotalLine: Double? = null,
    @SerialName("f5_home_spread") val f5HomeSpread: Double? = null,
    @SerialName("f5_away_spread") val f5AwaySpread: Double? = null,
    @SerialName("f5_ou_edge") val f5OuEdge: Double? = null,
    @SerialName("f5_home_win_prob") val f5HomeWinProb: Double? = null,
    @SerialName("f5_away_win_prob") val f5AwayWinProb: Double? = null,
    @SerialName("f5_home_implied_prob") val f5HomeImpliedProb: Double? = null,
    @SerialName("f5_away_implied_prob") val f5AwayImpliedProb: Double? = null,
    @SerialName("f5_home_ml_edge_pct") val f5HomeMlEdgePct: Double? = null,
    @SerialName("f5_away_ml_edge_pct") val f5AwayMlEdgePct: Double? = null,
    @SerialName("f5_home_ml_strong_signal") val f5HomeMlStrongSignal: Boolean? = null,
    @SerialName("f5_away_ml_strong_signal") val f5AwayMlStrongSignal: Boolean? = null,

    // Starters
    @SerialName("home_sp_name") val homeSpName: String? = null,
    @SerialName("away_sp_name") val awaySpName: String? = null,
    @SerialName("home_sp_confirmed") val homeSpConfirmed: Boolean? = null,
    @SerialName("away_sp_confirmed") val awaySpConfirmed: Boolean? = null,

    // Prediction metadata
    @SerialName("is_final_prediction") val isFinalPrediction: Boolean? = null,
    @SerialName("projection_label") val projectionLabel: String? = null,

    // Weather
    @SerialName("weather_confirmed") val weatherConfirmed: Boolean? = null,
    @SerialName("weather_imputed") val weatherImputed: Boolean? = null,
    @SerialName("temperature_f") val temperatureF: Double? = null,
    @SerialName("wind_speed_mph") val windSpeedMph: Double? = null,
    @SerialName("wind_direction") val windDirection: String? = null,
    val sky: String? = null,
    @SerialName("venue_name") val venueName: String? = null,

    // Signals attached after fetch (not decoded from the games row).
    var signals: List<MLBSignalItem> = emptyList(),
) {
    data class FullGameRuns(val home: Double, val away: Double, val margin: Double)
    data class F5Runs(val home: Double, val away: Double)

    /**
     * Full-game projected runs using Pythagorean-style split (exponent 1.83).
     * Matches RN `getFullGameRuns` byte-for-byte.
     */
    val fullGameRuns: FullGameRuns?
        get() {
            val p = mlHomeWinProb ?: return null
            val total = ouFairTotal ?: return null
            if (p <= 0 || p >= 1) return null
            val exp = 1.83
            val ratio = (p / (1 - p)).pow(1 / exp)
            val home = total * ratio / (ratio + 1)
            val away = total / (ratio + 1)
            return FullGameRuns(home = home, away = away, margin = home - away)
        }

    /** First-five projected runs. Matches RN `getF5Runs`. */
    val f5Runs: F5Runs?
        get() {
            val total = f5FairTotal ?: return null
            val margin = f5PredMargin ?: return null
            return F5Runs(home = (total + margin) / 2, away = (total - margin) / 2)
        }
}

/** Per-game / per-team signal pill. Plain (camelCase-free) keys on the wire. */
@Serializable
data class MLBSignalItem(
    val category: String,
    val severity: String,
    val message: String,
)
