package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FlexibleIntSerializer
import com.wagerproof.core.models.serialization.FlexibleStringSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * NBA game prediction row. Mirrors the RN `NBAGame` interface in
 * `wagerproof-mobile/types/nba.ts`. The shape comes from a 2-way merge in
 * the games store between `nba_input_values_view` and `nba_predictions`
 * (latest `as_of_ts_utc` per `game_id`).
 *
 * Probabilities `homeAwaySpreadCoverProb` and `ouResultProb` are derived
 * client-side from the model's fair spread / fair total (RN does the same
 * math in `index.tsx:457-479`):
 *   - spread: `0.5 ± min(|model_fair_home_spread - home_spread| * 0.05, 0.35)`
 *   - total : `0.5 ± min(|model_fair_total - over_line| * 0.02, 0.35)`
 */
// No CodingKeys on iOS — wire keys ARE the camelCase property names, so no @SerialName here.
@Serializable
data class NBAGame(
    val id: String,
    val gameId: Int,
    val awayTeam: String,
    val homeTeam: String,
    val awayAbbr: String,
    val homeAbbr: String,
    val homeMl: Int? = null,
    val awayMl: Int? = null,
    val homeSpread: Double? = null,
    val awaySpread: Double? = null,
    val overLine: Double? = null,
    val gameDate: String,
    val gameTime: String,
    val trainingKey: String,
    val uniqueId: String,
    // Team stats (from nba_input_values_view)
    val homeAdjOffense: Double? = null,
    val awayAdjOffense: Double? = null,
    val homeAdjDefense: Double? = null,
    val awayAdjDefense: Double? = null,
    val homeAdjPace: Double? = null,
    val awayAdjPace: Double? = null,
    // Trends
    val homeAtsPct: Double? = null,
    val awayAtsPct: Double? = null,
    val homeOverPct: Double? = null,
    val awayOverPct: Double? = null,
    // Model predictions (derived)
    val homeAwayMlProb: Double? = null,
    val homeAwaySpreadCoverProb: Double? = null,
    val ouResultProb: Double? = null,
    val runId: String? = null,
    // Predicted scores + fair lines (from nba_predictions)
    val homeScorePred: Double? = null,
    val awayScorePred: Double? = null,
    val modelFairHomeSpread: Double? = null,
    val modelFairTotal: Double? = null,
)

// MARK: - Injury / trends

/**
 * NBA injury report row. Mirrors RN `NBAInjuryReport` in `types/nba.ts`.
 * Sourced from the `nba_injury_report` table on the CFB Supabase project.
 */
@Serializable
data class NBAInjuryReport(
    @SerialName("player_name")
    val playerName: String,
    /**
     * `avg_pie_season` ships as either a Double, Int, or a stringified
     * decimal — normalized to String? and converted at the call site
     * (mirrors RN `useNBAMatchupOverview` which does `typeof === 'string'` casing).
     */
    @Serializable(with = FlexibleStringSerializer::class)
    @SerialName("avg_pie_season")
    val avgPieSeason: String? = null,
    val status: String = "",
    @Serializable(with = FlexibleIntSerializer::class)
    @SerialName("team_id")
    val teamId: Int? = null,
    @SerialName("team_name")
    val teamName: String = "",
    @SerialName("team_abbr")
    val teamAbbr: String = "",
) {
    val pieValue: Double?
        get() = avgPieSeason?.toDoubleOrNull()
}

/**
 * NBA recent-trends payload. Mirrors RN `NBAGameTrends` in `types/nba.ts`.
 * Sourced from `nba_input_values_view` (same row that produced [NBAGame],
 * but re-fetched to keep the dependency graph clean).
 */
@Serializable
data class NBAGameTrends(
    @SerialName("home_ovr_rtg") val homeOvrRtg: Double? = null,
    @SerialName("away_ovr_rtg") val awayOvrRtg: Double? = null,
    @SerialName("home_consistency") val homeConsistency: Double? = null,
    @SerialName("away_consistency") val awayConsistency: Double? = null,
    @SerialName("home_win_streak") val homeWinStreak: Double? = null,
    @SerialName("away_win_streak") val awayWinStreak: Double? = null,
    @SerialName("home_ats_pct") val homeAtsPct: Double? = null,
    @SerialName("away_ats_pct") val awayAtsPct: Double? = null,
    @SerialName("home_ats_streak") val homeAtsStreak: Double? = null,
    @SerialName("away_ats_streak") val awayAtsStreak: Double? = null,
    @SerialName("home_last_margin") val homeLastMargin: Double? = null,
    @SerialName("away_last_margin") val awayLastMargin: Double? = null,
    @SerialName("home_over_pct") val homeOverPct: Double? = null,
    @SerialName("away_over_pct") val awayOverPct: Double? = null,
    @SerialName("home_adj_pace_pregame_l3_trend") val homeAdjPacePregameL3Trend: Double? = null,
    @SerialName("away_adj_pace_pregame_l3_trend") val awayAdjPacePregameL3Trend: Double? = null,
    @SerialName("home_adj_off_rtg_pregame_l3_trend") val homeAdjOffRtgPregameL3Trend: Double? = null,
    @SerialName("away_adj_off_rtg_pregame_l3_trend") val awayAdjOffRtgPregameL3Trend: Double? = null,
    @SerialName("home_adj_def_rtg_pregame_l3_trend") val homeAdjDefRtgPregameL3Trend: Double? = null,
    @SerialName("away_adj_def_rtg_pregame_l3_trend") val awayAdjDefRtgPregameL3Trend: Double? = null,
)

// MARK: - Situational betting trends

/**
 * Single row from `nba_game_situational_trends_today` (or the fallback
 * `nba_game_situational_trends`). Mirrors RN `SituationalTrendRow` in
 * `types/nbaBettingTrends.ts`.
 *
 * Records are stringified as `"W-L-P"` (ATS) or `"O-U-P"` (O/U).
 */
@Serializable
data class NBASituationalTrendRow(
    @SerialName("game_id") val gameId: Int,
    @SerialName("game_date") val gameDate: String,
    @SerialName("team_id") val teamId: Int,
    @SerialName("team_abbr") val teamAbbr: String,
    @SerialName("team_name") val teamName: String,
    /** `"home"` or `"away"`. */
    @SerialName("team_side") val teamSide: String,
    // Situation labels
    @SerialName("last_game_situation") val lastGameSituation: String? = null,
    @SerialName("fav_dog_situation") val favDogSituation: String? = null,
    @SerialName("side_spread_situation") val sideSpreadSituation: String? = null,
    @SerialName("home_away_situation") val homeAwaySituation: String? = null,
    @SerialName("rest_bucket") val restBucket: String? = null,
    @SerialName("rest_comp") val restComp: String? = null,
    // ATS records
    @SerialName("ats_last_game_record") val atsLastGameRecord: String? = null,
    @SerialName("ats_last_game_cover_pct") val atsLastGameCoverPct: Double? = null,
    @SerialName("ats_fav_dog_record") val atsFavDogRecord: String? = null,
    @SerialName("ats_fav_dog_cover_pct") val atsFavDogCoverPct: Double? = null,
    @SerialName("ats_side_fav_dog_record") val atsSideFavDogRecord: String? = null,
    @SerialName("ats_side_fav_dog_cover_pct") val atsSideFavDogCoverPct: Double? = null,
    @SerialName("ats_home_away_record") val atsHomeAwayRecord: String? = null,
    @SerialName("ats_home_away_cover_pct") val atsHomeAwayCoverPct: Double? = null,
    @SerialName("ats_rest_bucket_record") val atsRestBucketRecord: String? = null,
    @SerialName("ats_rest_bucket_cover_pct") val atsRestBucketCoverPct: Double? = null,
    @SerialName("ats_rest_comp_record") val atsRestCompRecord: String? = null,
    @SerialName("ats_rest_comp_cover_pct") val atsRestCompCoverPct: Double? = null,
    // OU records
    @SerialName("ou_last_game_record") val ouLastGameRecord: String? = null,
    @SerialName("ou_last_game_over_pct") val ouLastGameOverPct: Double? = null,
    @SerialName("ou_last_game_under_pct") val ouLastGameUnderPct: Double? = null,
    @SerialName("ou_fav_dog_record") val ouFavDogRecord: String? = null,
    @SerialName("ou_fav_dog_over_pct") val ouFavDogOverPct: Double? = null,
    @SerialName("ou_fav_dog_under_pct") val ouFavDogUnderPct: Double? = null,
    @SerialName("ou_side_fav_dog_record") val ouSideFavDogRecord: String? = null,
    @SerialName("ou_side_fav_dog_over_pct") val ouSideFavDogOverPct: Double? = null,
    @SerialName("ou_side_fav_dog_under_pct") val ouSideFavDogUnderPct: Double? = null,
    @SerialName("ou_home_away_record") val ouHomeAwayRecord: String? = null,
    @SerialName("ou_home_away_over_pct") val ouHomeAwayOverPct: Double? = null,
    @SerialName("ou_home_away_under_pct") val ouHomeAwayUnderPct: Double? = null,
    @SerialName("ou_rest_bucket_record") val ouRestBucketRecord: String? = null,
    @SerialName("ou_rest_bucket_over_pct") val ouRestBucketOverPct: Double? = null,
    @SerialName("ou_rest_bucket_under_pct") val ouRestBucketUnderPct: Double? = null,
    @SerialName("ou_rest_comp_record") val ouRestCompRecord: String? = null,
    @SerialName("ou_rest_comp_over_pct") val ouRestCompOverPct: Double? = null,
    @SerialName("ou_rest_comp_under_pct") val ouRestCompUnderPct: Double? = null,
)

/**
 * Combined home + away trends data for a single matchup. Mirrors RN
 * `NBAGameTrendsData` in `types/nbaBettingTrends.ts`. Client-built bundle,
 * never serialized.
 */
data class NBAGameTrendsData(
    val gameId: Int,
    val gameDate: String,
    var tipoffTime: String?,
    val awayTeam: NBASituationalTrendRow,
    val homeTeam: NBASituationalTrendRow,
) {
    val id: Int get() = gameId
}

/**
 * Parse a record string like "15-3-0" into wins/losses/pushes/total.
 * Mirrors RN `parseRecord` helper.
 */
data class NBARecord(
    val wins: Int,
    val losses: Int,
    val pushes: Int,
) {
    val total: Int get() = wins + losses + pushes
}

fun parseNBARecord(raw: String?): NBARecord {
    if (raw.isNullOrEmpty()) return NBARecord(wins = 0, losses = 0, pushes = 0)
    // filter(empty) matches Swift split(separator:) which omits empty subsequences.
    val parts = raw.split("-").filter { it.isNotEmpty() }.map { it.toIntOrNull() ?: 0 }
    return NBARecord(
        wins = parts.getOrElse(0) { 0 },
        losses = parts.getOrElse(1) { 0 },
        pushes = parts.getOrElse(2) { 0 },
    )
}

/**
 * Convert encoded situation tag into the human-readable label shown in the
 * trends sheet. Mirrors RN `formatSituation` in `types/nbaBettingTrends.ts`.
 */
fun formatNBASituation(situation: String?): String {
    if (situation.isNullOrEmpty()) return "-"
    val map = mapOf(
        "is_after_loss" to "After Loss",
        "is_after_win" to "After Win",
        "is_fav" to "Favorite",
        "is_dog" to "Underdog",
        "is_home_fav" to "Home Favorite",
        "is_away_fav" to "Away Favorite",
        "is_home_dog" to "Home Underdog",
        "is_away_dog" to "Away Underdog",
        "one_day_off" to "1 Day Off",
        "two_three_days_off" to "2-3 Days Off",
        "four_plus_days_off" to "4+ Days Off",
        "rest_advantage" to "Rest Advantage",
        "rest_disadvantage" to "Rest Disadvantage",
        "rest_equal" to "Rest Equal",
    )
    map[situation]?.let { return it }
    return situation.replace("_", " ")
        .split(" ")
        .filter { it.isNotEmpty() }
        .joinToString(" ") { it.take(1).uppercase() + it.drop(1) }
}

// MARK: - Model accuracy

/**
 * Single accuracy bucket (count of historical games + accuracy %). Mirrors
 * RN `AccuracyBucket` in `types/modelAccuracy.ts`.
 */
@Serializable
data class NBAAccuracyBucket(
    val games: Int,
    val accuracyPct: Double,
)

/**
 * Per-game accuracy snapshot. Mirrors RN `GameAccuracyData` in
 * `types/modelAccuracy.ts`. Built from a single row of the
 * `nba_todays_games_predictions_with_accuracy` view. Client-built, never
 * serialized.
 */
data class NBAModelAccuracyData(
    val gameId: Int,
    val awayTeam: String,
    val homeTeam: String,
    val awayAbbr: String,
    val homeAbbr: String,
    val gameDate: String,
    val tipoffTime: String?,
    // Spread
    val homeSpread: Double?,
    val homeSpreadDiff: Double?,
    val spreadAccuracy: NBAAccuracyBucket?,
    // Moneyline
    val homeWinProb: Double?,
    val awayWinProb: Double?,
    val mlPickIsHome: Boolean?,
    val mlPickProbRounded: Double?,
    val mlAccuracy: NBAAccuracyBucket?,
    // Over/Under
    val overLine: Double?,
    val overLineDiff: Double?,
    val ouAccuracy: NBAAccuracyBucket?,
) {
    val id: Int get() = gameId
}
