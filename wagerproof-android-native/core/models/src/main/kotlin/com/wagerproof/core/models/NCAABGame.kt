package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * NCAAB game prediction row. Mirrors the RN `NCAABGame` interface in
 * `wagerproof-mobile/types/ncaab.ts`. Built from a 3-way join of
 * `v_cbb_input_values` + `ncaab_predictions` + `ncaab_team_mapping`.
 *
 * Like NBA but lighter: NCAAB carries team adjusted-offense/defense/pace
 * numbers and AP rankings (top-25 only) along with the standard model
 * probability triplet (`home_away_ml_prob`, `home_away_spread_cover_prob`,
 * `ou_result_prob`). The model also exposes `model_fair_home_spread` so
 * the UI can compute spread edges directly.
 */
// No CodingKeys on iOS — wire keys ARE the camelCase property names, so no @SerialName here.
@Serializable
data class NCAABGame(
    val id: String,
    val gameId: Int,
    val awayTeam: String,
    val homeTeam: String,
    val homeMl: Int? = null,
    val awayMl: Int? = null,
    val homeSpread: Double? = null,
    val awaySpread: Double? = null,
    val overLine: Double? = null,
    val gameDate: String,
    val gameTime: String,
    val trainingKey: String,
    val uniqueId: String,
    // Team stats
    val homeAdjOffense: Double? = null,
    val awayAdjOffense: Double? = null,
    val homeAdjDefense: Double? = null,
    val awayAdjDefense: Double? = null,
    val homeAdjPace: Double? = null,
    val awayAdjPace: Double? = null,
    // Rankings (AP top-25 only)
    val homeRanking: Int? = null,
    val awayRanking: Int? = null,
    // Context
    val conferenceGame: Boolean? = null,
    val neutralSite: Boolean? = null,
    // Model predictions
    val homeAwayMlProb: Double? = null,
    val homeAwaySpreadCoverProb: Double? = null,
    val ouResultProb: Double? = null,
    val predHomeMargin: Double? = null,
    val predTotalPoints: Double? = null,
    val runId: String? = null,
    // Predicted scores
    val homeScorePred: Double? = null,
    val awayScorePred: Double? = null,
    val modelFairHomeSpread: Double? = null,
    // Team logos and abbreviations from ncaab_team_mapping
    val homeTeamLogo: String? = null,
    val awayTeamLogo: String? = null,
    val homeTeamAbbrev: String? = null,
    val awayTeamAbbrev: String? = null,
)

// MARK: - Situational trends

/**
 * Raw row from `ncaab_game_situational_trends_today` (with fallback to
 * `ncaab_game_situational_trends`). Mirrors RN `NCAABSituationalTrendRow`.
 * Each game has two rows (home + away keyed by `team_side`). The team's
 * situation labels carry the same encoded values as RN
 * (`is_after_loss`, `is_fav`, `is_home_fav`, `one_day_off`, etc.).
 */
@Serializable
data class NCAABSituationalTrendRow(
    @SerialName("game_id") val gameId: Int,
    @SerialName("game_date") val gameDate: String,
    @SerialName("api_team_id") val apiTeamId: Int,
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
    // ATS records (format: "W-L-P")
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
    // O/U records (format: "O-U-P")
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
) {
    val id: String get() = "$gameId-$teamSide"
}

/**
 * Combined home + away trends payload for one NCAAB game. Mirrors RN
 * `NCAABGameTrendsData`. Includes the two team rows, optional logos,
 * and the two pre-computed sort scores (O/U consensus + ATS dominance).
 * Client-built, never serialized.
 */
data class NCAABGameTrendsData(
    val gameId: Int,
    val gameDate: String,
    val tipoffTime: String? = null,
    val awayTeam: NCAABSituationalTrendRow,
    val homeTeam: NCAABSituationalTrendRow,
    val awayTeamLogo: String? = null,
    val homeTeamLogo: String? = null,
    var ouConsensusScore: Double? = null,
    var atsDominanceScore: Double? = null,
) {
    val id: Int get() = gameId
}

// MARK: - Record parsing helpers

/**
 * Parse a `"W-L-P"` (or `"O-U-P"`) record string into its component parts.
 * Mirrors RN `parseNCAABRecord`.
 */
data class NCAABParsedRecord(
    val wins: Int,
    val losses: Int,
    val pushes: Int,
) {
    val total: Int get() = wins + losses + pushes
}

fun parseNCAABRecord(record: String?): NCAABParsedRecord {
    if (record == null) return NCAABParsedRecord(wins = 0, losses = 0, pushes = 0)
    // filter(empty) matches Swift split(separator:) which omits empty subsequences.
    val parts = record.split("-").filter { it.isNotEmpty() }.map { it.toIntOrNull() ?: 0 }
    return NCAABParsedRecord(
        wins = parts.getOrElse(0) { 0 },
        losses = parts.getOrElse(1) { 0 },
        pushes = parts.getOrElse(2) { 0 },
    )
}

/**
 * Convert encoded situation tag into the human-readable label shown in the
 * trends sheet. Mirrors RN `formatNCAABSituation`.
 */
fun formatNCAABSituation(situation: String?): String {
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

// MARK: - Model accuracy bucket

/**
 * Edge-bucket accuracy pair (sample size + hit rate). Decoded from the
 * `*_accuracy_pct` / `*_bucket_games` columns of
 * `ncaab_todays_games_predictions_with_accuracy`. Used by the in-sheet
 * "Model Accuracy" widget. Mirrors RN `AccuracyBucket` shape.
 */
@Serializable
data class NCAABAccuracyBucket(
    val games: Int,
    val accuracyPct: Double,
)

/**
 * Per-game accuracy payload for the in-sheet model accuracy widget.
 * Mirrors RN `GameAccuracyData` from `types/modelAccuracy.ts`. Built from
 * the `ncaab_todays_games_predictions_with_accuracy` view (logos joined
 * separately via `ncaab_team_mapping`). Client-built, never serialized.
 */
data class NCAABModelAccuracyGame(
    val gameId: Int,
    val awayTeam: String,
    val homeTeam: String,
    val awayAbbr: String,
    val homeAbbr: String,
    val gameDate: String,
    val tipoffTime: String? = null,
    // Spread
    val homeSpread: Double? = null,
    val homeSpreadDiff: Double? = null,
    val spreadAccuracy: NCAABAccuracyBucket? = null,
    // Moneyline
    val homeWinProb: Double? = null,
    val awayWinProb: Double? = null,
    val mlPickIsHome: Boolean? = null,
    val mlPickProbRounded: Double? = null,
    val mlAccuracy: NCAABAccuracyBucket? = null,
    // Over/Under
    val overLine: Double? = null,
    val overLineDiff: Double? = null,
    val ouAccuracy: NCAABAccuracyBucket? = null,
    // Logos
    val awayTeamLogo: String? = null,
    val homeTeamLogo: String? = null,
) {
    val id: Int get() = gameId
}

// MARK: - Team mapping cache entry

/**
 * Single row in the `ncaab_team_mapping` cache. Built once per session and
 * consumed by both the NCAAB games fetch and the model-accuracy / trends
 * merges. Synthesized camelCase wire keys (hydrated client-side).
 */
@Serializable
data class NCAABTeamMappingEntry(
    val apiTeamId: Int,
    val abbrev: String? = null,
    val logoUrl: String? = null,
    val teamRankingName: String? = null,
)
