package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FlexibleDoubleSerializer
import com.wagerproof.core.models.serialization.FlexibleIntSerializer
import com.wagerproof.core.models.serialization.FlexibleStringSerializer
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.nullable
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull

/**
 * NFL game prediction row. Mirrors the iOS `NFLPrediction` — the shape comes
 * from a 4-way join between `v_input_values_with_epa`, `nfl_predictions_epa`,
 * `nfl_betting_lines`, and `production_weather` (legacy) OR the dry-run
 * contract (`nfl_dryrun_games`).
 *
 * Fully tolerant decode: the Swift init wraps every field in `try?`, so
 * nothing here may ever throw. Every field is nullable-or-defaulted and
 * numerics go through the Flexible* serializers. Cross-field id fallbacks
 * (`id ?? game_id ?? training_key ?? ""` etc.) live in computed vals over
 * private backing fields — kotlinx can't express them in a data class.
 */
@Serializable
data class NFLPrediction(
    @SerialName("id")
    @Serializable(with = FlexibleStringSerializer::class)
    private val idRaw: String? = null,
    @SerialName("away_team")
    @Serializable(with = FlexibleStringSerializer::class)
    private val awayTeamRaw: String? = null,
    @SerialName("home_team")
    @Serializable(with = FlexibleStringSerializer::class)
    private val homeTeamRaw: String? = null,
    @SerialName("away_ab")
    @Serializable(with = FlexibleStringSerializer::class)
    val awayAb: String? = null,
    @SerialName("home_ab")
    @Serializable(with = FlexibleStringSerializer::class)
    val homeAb: String? = null,
    @SerialName("home_ml")
    @Serializable(with = FlexibleIntSerializer::class)
    val homeMl: Int? = null,
    @SerialName("away_ml")
    @Serializable(with = FlexibleIntSerializer::class)
    val awayMl: Int? = null,
    @SerialName("home_spread")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val homeSpread: Double? = null,
    @SerialName("away_spread")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val awaySpread: Double? = null,
    @SerialName("over_line")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val overLine: Double? = null,
    @SerialName("game_date")
    @Serializable(with = FlexibleStringSerializer::class)
    private val gameDateRaw: String? = null,
    @SerialName("game_time")
    @Serializable(with = FlexibleStringSerializer::class)
    private val gameTimeRaw: String? = null,
    @SerialName("training_key")
    @Serializable(with = FlexibleStringSerializer::class)
    private val trainingKeyRaw: String? = null,
    @SerialName("unique_id")
    @Serializable(with = FlexibleStringSerializer::class)
    private val uniqueIdRaw: String? = null,
    /** Probability the moneyline prediction comes in (home favorite). */
    @SerialName("home_away_ml_prob")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val homeAwayMlProb: Double? = null,
    /** Probability the home team covers the spread. Below 0.5 → away covers. */
    @SerialName("home_away_spread_cover_prob")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val homeAwaySpreadCoverProb: Double? = null,
    /** Probability the total goes Over. Below 0.5 → Under. */
    @SerialName("ou_result_prob")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val ouResultProb: Double? = null,
    /**
     * Model fair total (`fg_pred_total` in the dry-run contract). The legacy
     * pipeline doesn't publish one — nil there, and the card falls back to
     * `ouResultProb` for O/U direction.
     */
    @SerialName("pred_total")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val predTotal: Double? = null,
    @SerialName("run_id")
    @Serializable(with = FlexibleStringSerializer::class)
    val runId: String? = null,
    // Weather (legacy pipeline)
    @SerialName("temperature")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val temperature: Double? = null,
    @SerialName("precipitation")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val precipitation: Double? = null,
    @SerialName("wind_speed")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val windSpeed: Double? = null,
    @SerialName("icon")
    @Serializable(with = FlexibleStringSerializer::class)
    val icon: String? = null,
    // Public betting splits (display labels)
    @SerialName("spread_splits_label")
    @Serializable(with = FlexibleStringSerializer::class)
    val spreadSplitsLabel: String? = null,
    @SerialName("total_splits_label")
    @Serializable(with = FlexibleStringSerializer::class)
    val totalSplitsLabel: String? = null,
    @SerialName("ml_splits_label")
    @Serializable(with = FlexibleStringSerializer::class)
    val mlSplitsLabel: String? = null,
    // Public betting raw percentages — decimal strings, e.g. "0.61"; kept as
    // String on purpose (formatting happens in the view layer).
    @SerialName("home_ml_handle")
    @Serializable(with = FlexibleStringSerializer::class)
    val homeMlHandle: String? = null,
    @SerialName("away_ml_handle")
    @Serializable(with = FlexibleStringSerializer::class)
    val awayMlHandle: String? = null,
    @SerialName("home_ml_bets")
    @Serializable(with = FlexibleStringSerializer::class)
    val homeMlBets: String? = null,
    @SerialName("away_ml_bets")
    @Serializable(with = FlexibleStringSerializer::class)
    val awayMlBets: String? = null,
    @SerialName("home_spread_handle")
    @Serializable(with = FlexibleStringSerializer::class)
    val homeSpreadHandle: String? = null,
    @SerialName("away_spread_handle")
    @Serializable(with = FlexibleStringSerializer::class)
    val awaySpreadHandle: String? = null,
    @SerialName("home_spread_bets")
    @Serializable(with = FlexibleStringSerializer::class)
    val homeSpreadBets: String? = null,
    @SerialName("away_spread_bets")
    @Serializable(with = FlexibleStringSerializer::class)
    val awaySpreadBets: String? = null,
    @SerialName("over_handle")
    @Serializable(with = FlexibleStringSerializer::class)
    val overHandle: String? = null,
    @SerialName("under_handle")
    @Serializable(with = FlexibleStringSerializer::class)
    val underHandle: String? = null,
    @SerialName("over_bets")
    @Serializable(with = FlexibleStringSerializer::class)
    val overBets: String? = null,
    @SerialName("under_bets")
    @Serializable(with = FlexibleStringSerializer::class)
    val underBets: String? = null,
    // NFL dry-run identity / model contract
    @SerialName("game_id")
    @Serializable(with = FlexibleStringSerializer::class)
    private val gameIdRaw: String? = null,
    @SerialName("season")
    @Serializable(with = FlexibleIntSerializer::class)
    val season: Int? = null,
    @SerialName("week")
    @Serializable(with = FlexibleIntSerializer::class)
    val week: Int? = null,
    @SerialName("gameday")
    @Serializable(with = FlexibleStringSerializer::class)
    val gameday: String? = null,
    @SerialName("kickoff")
    @Serializable(with = FlexibleStringSerializer::class)
    val kickoff: String? = null,
    @SerialName("slot")
    @Serializable(with = FlexibleStringSerializer::class)
    val slot: String? = null,
    @SerialName("fg_spread_open")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val fgSpreadOpen: Double? = null,
    @SerialName("fg_spread_close")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val fgSpreadClose: Double? = null,
    @SerialName("fg_total_open")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val fgTotalOpen: Double? = null,
    @SerialName("fg_total_close")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val fgTotalClose: Double? = null,
    @SerialName("fg_ml_home_close")
    @Serializable(with = FlexibleIntSerializer::class)
    val fgMlHomeClose: Int? = null,
    @SerialName("fg_ml_away_close")
    @Serializable(with = FlexibleIntSerializer::class)
    val fgMlAwayClose: Int? = null,
    @SerialName("tt_home_close")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val ttHomeClose: Double? = null,
    @SerialName("tt_away_close")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val ttAwayClose: Double? = null,
    @SerialName("tt_home_best_over")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val ttHomeBestOver: Double? = null,
    @SerialName("tt_home_best_under")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val ttHomeBestUnder: Double? = null,
    @SerialName("tt_away_best_over")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val ttAwayBestOver: Double? = null,
    @SerialName("tt_away_best_under")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val ttAwayBestUnder: Double? = null,
    @SerialName("tt_home_pick")
    @Serializable(with = FlexibleStringSerializer::class)
    val ttHomePick: String? = null,
    @SerialName("tt_away_pick")
    @Serializable(with = FlexibleStringSerializer::class)
    val ttAwayPick: String? = null,
    @SerialName("tt_home_edge")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val ttHomeEdge: Double? = null,
    @SerialName("tt_away_edge")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val ttAwayEdge: Double? = null,
    @SerialName("tt_home_pred")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val ttHomePred: Double? = null,
    @SerialName("tt_away_pred")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val ttAwayPred: Double? = null,
    @SerialName("h1_spread_close")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val h1SpreadClose: Double? = null,
    @SerialName("h1_total_close")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val h1TotalClose: Double? = null,
    @SerialName("h1_ml_home_close")
    @Serializable(with = FlexibleIntSerializer::class)
    val h1MlHomeClose: Int? = null,
    @SerialName("h1_ml_away_close")
    @Serializable(with = FlexibleIntSerializer::class)
    val h1MlAwayClose: Int? = null,
    @SerialName("h1_spread_pick")
    @Serializable(with = FlexibleStringSerializer::class)
    val h1SpreadPick: String? = null,
    @SerialName("h1_total_pick")
    @Serializable(with = FlexibleStringSerializer::class)
    val h1TotalPick: String? = null,
    @SerialName("h1_ml_pick")
    @Serializable(with = FlexibleStringSerializer::class)
    val h1MlPick: String? = null,
    @SerialName("fg_pred_margin")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val fgPredMargin: Double? = null,
    @SerialName("fg_pred_spread")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val fgPredSpread: Double? = null,
    @SerialName("fg_pred_home_pts")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val fgPredHomePts: Double? = null,
    @SerialName("fg_pred_away_pts")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val fgPredAwayPts: Double? = null,
    @SerialName("fg_spread_edge")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val fgSpreadEdge: Double? = null,
    @SerialName("fg_spread_pick")
    @Serializable(with = FlexibleStringSerializer::class)
    val fgSpreadPick: String? = null,
    @SerialName("fg_spread_confluence")
    @Serializable(with = FlexibleIntSerializer::class)
    val fgSpreadConfluence: Int? = null,
    @SerialName("fg_total_edge")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val fgTotalEdge: Double? = null,
    @SerialName("fg_total_pick")
    @Serializable(with = FlexibleStringSerializer::class)
    val fgTotalPick: String? = null,
    @SerialName("fg_total_tier")
    @Serializable(with = FlexibleStringSerializer::class)
    val fgTotalTier: String? = null,
    @SerialName("h1_pred_total")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val h1PredTotal: Double? = null,
    @SerialName("h1_pred_margin")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val h1PredMargin: Double? = null,
    @SerialName("h1_total_edge")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val h1TotalEdge: Double? = null,
    @SerialName("h1_cover_tilt")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val h1CoverTilt: Double? = null,
    @SerialName("h1_home_win_prob")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val h1HomeWinProb: Double? = null,
    @SerialName("conviction_tier")
    @Serializable(with = FlexibleStringSerializer::class)
    private val convictionTierField: String? = null,
    @SerialName("stake_units")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val stakeUnits: Double? = null,
    @SerialName("conviction_summary")
    @Serializable(with = TolerantConvictionSummarySerializer::class)
    val convictionSummary: ConvictionSummary? = null,
    @SerialName("flags_active")
    @Serializable(with = FlexibleIntSerializer::class)
    val flagsActive: Int? = null,
    @SerialName("flags_tracking")
    @Serializable(with = FlexibleIntSerializer::class)
    val flagsTracking: Int? = null,
    @SerialName("mammoth")
    @Serializable(with = FlexibleBooleanSerializer::class)
    private val mammothRaw: Boolean? = null,
    @SerialName("wx_temp_f")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val wxTempF: Double? = null,
    @SerialName("wx_wind_mph")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val wxWindMph: Double? = null,
    @SerialName("wx_precip_mm")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val wxPrecipMm: Double? = null,
    @SerialName("wx_indoors")
    @Serializable(with = FlexibleBooleanSerializer::class)
    val wxIndoors: Boolean? = null,
    @SerialName("wx_icon")
    @Serializable(with = FlexibleStringSerializer::class)
    val wxIcon: String? = null,
    @SerialName("wx_summary")
    @Serializable(with = FlexibleStringSerializer::class)
    val wxSummary: String? = null,
) {
    // Swift id fallback chain: id ?? game_id ?? training_key ?? "".
    val id: String get() = idRaw ?: gameIdRaw ?: trainingKeyRaw ?: ""
    val awayTeam: String get() = awayTeamRaw ?: ""
    val homeTeam: String get() = homeTeamRaw ?: ""
    val gameDate: String get() = gameDateRaw ?: ""
    val gameTime: String get() = gameTimeRaw ?: ""
    val trainingKey: String get() = trainingKeyRaw ?: id
    val uniqueId: String get() = uniqueIdRaw ?: trainingKey
    val gameId: String get() = gameIdRaw ?: id
    val convictionTierRaw: String get() = convictionTierField ?: "none"
    val mammoth: Boolean get() = mammothRaw ?: false

    @Serializable
    data class ConvictionPlay(
        @SerialName("card_group") val cardGroup: String,
        val conviction: String? = null,
        val recommendation: String? = null,
        @SerialName("pick_label") val pickLabel: String,
    ) {
        val id: String get() = "$cardGroup-$pickLabel"
    }

    @Serializable
    data class ConvictionSummary(
        @SerialName("top_card") val topCard: String? = null,
        @SerialName("top_conviction") val topConviction: String? = null,
        // No default: like Swift's synthesized decode, a missing/invalid plays
        // array fails the summary (the tolerant wrapper then yields null).
        val plays: List<ConvictionPlay>,
    )

    data class PredictedScore(val home: Double, val away: Double)

    val predictedScore: PredictedScore?
        get() {
            val home = fgPredHomePts
            val away = fgPredAwayPts
            if (home != null && away != null) return PredictedScore(home, away)
            val total = predTotal ?: return null
            val margin = fgPredMargin ?: return null
            return PredictedScore((total + margin) / 2, (total - margin) / 2)
        }

    val topConvictionRank: Int
        get() = when ((if (mammoth) "mammoth" else convictionTierRaw).lowercase()) {
            "mammoth" -> 0
            "high" -> 1
            "med", "medium" -> 2
            "low" -> 3
            "lean" -> 4
            else -> 5
        }
}

/** Bool-or-null that never throws (Swift `try? decode(Bool)`), wrong-typed → null. */
private object FlexibleBooleanSerializer : KSerializer<Boolean?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("FlexibleBoolean", PrimitiveKind.BOOLEAN).nullable

    override fun deserialize(decoder: Decoder): Boolean? {
        val el = (decoder as? JsonDecoder)?.decodeJsonElement()
            ?: return runCatching { decoder.decodeBoolean() }.getOrNull()
        val prim = el as? JsonPrimitive ?: return null
        if (prim is JsonNull) return null
        return prim.booleanOrNull
    }

    override fun serialize(encoder: Encoder, value: Boolean?) {
        if (value == null) encoder.encodeNull() else encoder.encodeBoolean(value)
    }
}

/** conviction_summary decode that mirrors Swift's `try? decodeIfPresent` — any failure → null. */
private object TolerantConvictionSummarySerializer : KSerializer<NFLPrediction.ConvictionSummary?> {
    private val delegate = NFLPrediction.ConvictionSummary.serializer()
    override val descriptor: SerialDescriptor = delegate.descriptor.nullable

    override fun deserialize(decoder: Decoder): NFLPrediction.ConvictionSummary? {
        val input = decoder as? JsonDecoder
            ?: return runCatching { decoder.decodeSerializableValue(delegate) }.getOrNull()
        val el = runCatching { input.decodeJsonElement() }.getOrNull() ?: return null
        if (el is JsonNull) return null
        return runCatching { input.json.decodeFromJsonElement(delegate, el) }.getOrNull()
    }

    override fun serialize(encoder: Encoder, value: NFLPrediction.ConvictionSummary?) {
        if (value == null) encoder.encodeNull() else encoder.encodeSerializableValue(delegate, value)
    }
}
