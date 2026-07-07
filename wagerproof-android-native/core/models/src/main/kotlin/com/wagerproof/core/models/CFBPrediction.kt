package com.wagerproof.core.models

import java.util.Locale
import kotlin.math.floor
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Conviction ladder for the CFB dry-run portfolio. The sort order is a
 * product rule: conviction ranks the slate ahead of edge size.
 */
enum class CFBConvictionTier(val raw: String) {
    MAMMOTH("mammoth"),
    HIGH("high"),
    MED("med"),
    LOW("low"),
    LEAN("lean"),
    NONE("none");

    val sortRank: Int
        get() = when (this) {
            MAMMOTH -> 0
            HIGH -> 1
            MED -> 2
            LOW -> 3
            LEAN -> 4
            NONE -> 5
        }

    val label: String
        get() = when (this) {
            MAMMOTH -> "MAMMOTH"
            HIGH -> "High"
            MED -> "Medium"
            LOW -> "Low"
            LEAN -> "Lean"
            NONE -> "Score Only"
        }

    val badge: String
        get() = when (this) {
            MAMMOTH -> "MAMMOTH"
            HIGH -> "T1"
            MED -> "T2"
            LOW -> "T3"
            LEAN -> "Lean"
            NONE -> "None"
        }

    companion object {
        private val byRaw = entries.associateBy { it.raw }

        fun fromRaw(raw: String?): CFBConvictionTier =
            byRaw[raw?.lowercase(Locale.US) ?: ""] ?: NONE
    }
}

/** Per-flag conviction. ⚠️ Mixed-case raws: `mammoth, T1, T2, T3, track`. */
enum class CFBFlagConviction(val raw: String) {
    MAMMOTH("mammoth"),
    T1("T1"),
    T2("T2"),
    T3("T3"),
    TRACK("track");

    val sortRank: Int
        get() = when (this) {
            MAMMOTH -> 0
            T1 -> 1
            T2 -> 2
            T3 -> 3
            TRACK -> 4
        }

    val label: String
        get() = when (this) {
            MAMMOTH -> "Mammoth"
            T1 -> "T1"
            T2 -> "T2"
            T3 -> "T3"
            TRACK -> "Tracking"
        }

    companion object {
        private val byRaw = entries.associateBy { it.raw }

        // Try the raw as-is first, then uppercased (matches Swift: "t1" → T1 but "mammoth" stays exact).
        fun fromRaw(raw: String?): CFBFlagConviction {
            val value = raw ?: ""
            return byRaw[value] ?: byRaw[value.uppercase(Locale.US)] ?: TRACK
        }
    }
}

/** `cfb_teams` row. ⚠️ camelCase wire keys (synthesized on iOS) — no renames. */
@Serializable
data class CFBTeamReference(
    val teamName: String,
    val abbr: String? = null,
    val conference: String? = null,
    val classification: String? = null,
    val color: String? = null,
    val altColor: String? = null,
    val logo: String? = null,
    val logoDark: String? = null,
)

/** Dry-run bet flag, assembled client-side from `cfb_dryrun_flags`. ⚠️ camelCase wire keys. */
@Serializable
data class CFBDryRunFlag(
    val id: String,
    val gameId: String,
    val season: Int? = null,
    val week: Int? = null,
    val game: String? = null,
    val source: String,
    val market: String,
    val side: String,
    val line: Double? = null,
    val price: Int? = null,
    val edge: Double? = null,
    val conviction: String,
    val tier: String,
    val stakeUnits: Double? = null,
    val gradeLine: String? = null,
    val mammoth: Boolean? = null,
    val signalDefinition: CFBSignalDefinition? = null,
) {
    val convictionTier: CFBFlagConviction get() = CFBFlagConviction.fromRaw(conviction)
    val isActive: Boolean get() = tier.lowercase(Locale.US) == "active"

    fun withSignalDefinition(definition: CFBSignalDefinition?): CFBDryRunFlag =
        copy(signalDefinition = definition)
}

/** `cfb_signal_defs` row. ⚠️ camelCase wire keys. */
@Serializable
data class CFBSignalDefinition(
    // Join key for `signal_performance.signal_key`.
    val signalKey: String? = null,
    val sourceKey: String,
    val displayName: String,
    val oneLiner: String? = null,
    val definition: String? = null,
    val whyItWorks: String? = null,
    val betDirection: String? = null,
    val typicalHit: String? = null,
)

/** Model-predicted final score (Swift tuple `(home, away)`). */
data class CFBPredictedScore(val home: Double, val away: Double)

/**
 * CFB game prediction row. The active Games tab uses the dry-run contract
 * (`cfb_dryrun_games` + flags + `cfb_teams`), while legacy live-pipeline fields
 * remain optional so older fixtures/services keep working. Wire is snake_case.
 */
@Serializable
data class CFBPrediction(
    val id: String,
    @SerialName("away_team") val awayTeam: String,
    @SerialName("home_team") val homeTeam: String,
    @SerialName("home_ml") val homeMl: Int? = null,
    @SerialName("away_ml") val awayMl: Int? = null,
    @SerialName("home_spread") val homeSpread: Double? = null,
    @SerialName("away_spread") val awaySpread: Double? = null,
    @SerialName("over_line") val overLine: Double? = null,
    @SerialName("game_date") val gameDate: String,
    @SerialName("game_time") val gameTime: String,
    @SerialName("training_key") val trainingKey: String,
    @SerialName("unique_id") val uniqueId: String,
    @SerialName("home_away_ml_prob") val homeAwayMlProb: Double? = null,
    @SerialName("home_away_spread_cover_prob") val homeAwaySpreadCoverProb: Double? = null,
    @SerialName("ou_result_prob") val ouResultProb: Double? = null,
    @SerialName("run_id") val runId: String? = null,
    val temperature: Double? = null,
    val precipitation: Double? = null,
    @SerialName("wind_speed") val windSpeed: Double? = null,
    val icon: String? = null,
    @SerialName("wx_temp_f") val wxTempF: Double? = null,
    @SerialName("wx_wind_mph") val wxWindMph: Double? = null,
    @SerialName("wx_precip_mm") val wxPrecipMm: Double? = null,
    @SerialName("wx_indoors") val wxIndoors: Boolean? = null,
    @SerialName("wx_icon") val wxIcon: String? = null,
    @SerialName("wx_summary") val wxSummary: String? = null,
    @SerialName("spread_splits_label") val spreadSplitsLabel: String? = null,
    @SerialName("total_splits_label") val totalSplitsLabel: String? = null,
    @SerialName("ml_splits_label") val mlSplitsLabel: String? = null,
    val conference: String? = null,
    // CFB-specific prediction fields (from cfb_api_predictions join)
    @SerialName("pred_away_score") val predAwayScore: Double? = null,
    @SerialName("pred_home_score") val predHomeScore: Double? = null,
    @SerialName("pred_away_points") val predAwayPoints: Double? = null,
    @SerialName("pred_home_points") val predHomePoints: Double? = null,
    @SerialName("pred_spread") val predSpread: Double? = null,
    @SerialName("home_spread_diff") val homeSpreadDiff: Double? = null,
    @SerialName("pred_total") val predTotal: Double? = null,
    @SerialName("total_diff") val totalDiff: Double? = null,
    @SerialName("pred_over_line") val predOverLine: Double? = null,
    @SerialName("over_line_diff") val overLineDiff: Double? = null,
    // Opening line snapshot
    @SerialName("opening_spread") val openingSpread: Double? = null,
    @SerialName("opening_total") val openingTotal: Double? = null,
    // Dry-run identity / team metadata. Swift's memberwise init defaults gameId to id —
    // the wire always carries game_id; the default only matters for client construction.
    @SerialName("game_id") val gameId: String = id,
    val season: Int? = null,
    val week: Int? = null,
    val kickoff: String? = null,
    @SerialName("neutral_site") val neutralSite: Boolean? = null,
    @SerialName("home_conf") val homeConf: String? = null,
    @SerialName("away_conf") val awayConf: String? = null,
    @SerialName("home_rank") val homeRank: Int? = null,
    @SerialName("away_rank") val awayRank: Int? = null,
    @SerialName("home_classification") val homeClassification: String? = null,
    @SerialName("away_classification") val awayClassification: String? = null,
    @SerialName("home_team_ref") val homeTeamRef: CFBTeamReference? = null,
    @SerialName("away_team_ref") val awayTeamRef: CFBTeamReference? = null,
    // Dry-run market/model contract
    @SerialName("fg_spread_open") val fgSpreadOpen: Double? = null,
    @SerialName("fg_spread_close") val fgSpreadClose: Double? = null,
    @SerialName("fg_total_open") val fgTotalOpen: Double? = null,
    @SerialName("fg_total_close") val fgTotalClose: Double? = null,
    @SerialName("fg_ml_home_close") val fgMlHomeClose: Int? = null,
    @SerialName("fg_ml_away_close") val fgMlAwayClose: Int? = null,
    @SerialName("tt_home_close") val ttHomeClose: Double? = null,
    @SerialName("tt_away_close") val ttAwayClose: Double? = null,
    @SerialName("tt_home_best_under") val ttHomeBestUnder: Double? = null,
    @SerialName("tt_home_best_over") val ttHomeBestOver: Double? = null,
    @SerialName("tt_away_best_under") val ttAwayBestUnder: Double? = null,
    @SerialName("tt_away_best_over") val ttAwayBestOver: Double? = null,
    @SerialName("h1_spread_close") val h1SpreadClose: Double? = null,
    @SerialName("h1_total_close") val h1TotalClose: Double? = null,
    @SerialName("h1_ml_home_close") val h1MlHomeClose: Int? = null,
    @SerialName("h1_ml_away_close") val h1MlAwayClose: Int? = null,
    @SerialName("fg_pred_margin") val fgPredMargin: Double? = null,
    @SerialName("fg_pred_spread") val fgPredSpread: Double? = null,
    @SerialName("fg_spread_edge") val fgSpreadEdge: Double? = null,
    @SerialName("fg_spread_pick") val fgSpreadPick: String? = null,
    @SerialName("fg_spread_capped") val fgSpreadCapped: Boolean? = null,
    @SerialName("fg_pred_total") val fgPredTotal: Double? = null,
    @SerialName("fg_total_edge") val fgTotalEdge: Double? = null,
    @SerialName("fg_total_pick") val fgTotalPick: String? = null,
    @SerialName("tt_home_pred") val ttHomePred: Double? = null,
    @SerialName("tt_away_pred") val ttAwayPred: Double? = null,
    @SerialName("tt_home_pick") val ttHomePick: String? = null,
    @SerialName("tt_away_pick") val ttAwayPick: String? = null,
    @SerialName("h1_pred_margin") val h1PredMargin: Double? = null,
    @SerialName("h1_pred_total") val h1PredTotal: Double? = null,
    @SerialName("h1_spread_pick") val h1SpreadPick: String? = null,
    @SerialName("h1_total_pick") val h1TotalPick: String? = null,
    @SerialName("h1_ml_pick") val h1MlPick: String? = null,
    @SerialName("fg_home_cover_prob") val fgHomeCoverProb: Double? = null,
    @SerialName("fg_home_win_prob") val fgHomeWinProb: Double? = null,
    // Dry-run portfolio (required in JSON; Swift memberwise defaults are client-construction only)
    @SerialName("conviction_tier") val convictionTierRaw: String,
    @SerialName("stake_units") val stakeUnits: Double? = null,
    @SerialName("n_flags_active") val nFlagsActive: Int? = null,
    @SerialName("n_flags_tracking") val nFlagsTracking: Int? = null,
    val mammoth: Boolean,
    // var: the service merges flag rows in after the games fetch.
    var flags: List<CFBDryRunFlag>,
) {
    val convictionTier: CFBConvictionTier
        get() = if (mammoth) CFBConvictionTier.MAMMOTH else CFBConvictionTier.fromRaw(convictionTierRaw)

    val predictedScore: CFBPredictedScore?
        get() {
            val total = fgPredTotal ?: predTotal ?: predOverLine ?: return null
            val margin = fgPredMargin
                ?: if (predHomeScore != null && predAwayScore != null) predHomeScore - predAwayScore else null
            if (margin == null) return null
            return CFBPredictedScore(home = (total + margin) / 2, away = (total - margin) / 2)
        }

    val headlinePick: String?
        get() {
            if (fgSpreadCapped == true) return "Model off-market, no play"
            val pick = fgSpreadPick
            if (!pick.isNullOrEmpty()) {
                val isHome = pick.uppercase(Locale.US) == "HOME"
                val team = if (isHome) homeTeam else awayTeam
                val line = if (isHome) homeSpread else awaySpread
                return "$team ${formatSpread(line)}"
            }
            val topFlag = flags.filter { it.isActive }
                .sortedWith(
                    compareBy<CFBDryRunFlag> { it.convictionTier.sortRank }
                        .thenByDescending { it.stakeUnits ?: 0.0 }
                )
                .firstOrNull()
            if (topFlag != null) {
                return "${topFlag.side} ${topFlag.market.replace("_", " ")} ${formatLine(topFlag.line)}"
            }
            return null
        }

    val activeFlags: List<CFBDryRunFlag> get() = flags.filter { it.isActive }
    val trackingFlags: List<CFBDryRunFlag> get() = flags.filter { !it.isActive }

    companion object {
        private fun formatSpread(value: Double?): String {
            if (value == null) return ""
            return if (value > 0) "+${formatLine(value)}" else formatLine(value)
        }

        private fun formatLine(value: Double?): String {
            if (value == null) return ""
            return if (floor(value) == value) value.toInt().toString()
            else String.format(Locale.US, "%.1f", value)
        }
    }
}
