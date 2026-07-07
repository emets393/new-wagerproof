package com.wagerproof.app.features.nfl

import androidx.compose.ui.graphics.Color
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.serialization.FlexibleDoubleSerializer
import com.wagerproof.core.models.serialization.FlexibleIntSerializer
import com.wagerproof.core.models.serialization.LossyListSerializer
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.nullable
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull

/**
 * NFL dry-run detail-page data contract — port of the private row structs in
 * iOS `NFLGameBottomSheet.swift` (`nfl_dryrun_picks`, `nfl_signal_defs`,
 * `nfl_team_trends`, `nfl_matchup_history`). Everything decodes tolerantly:
 * one corrupt row/field must never blank the whole board.
 */

// MARK: - Rows

@Serializable
data class NFLDryrunPickRow(
    @Serializable(with = FlexibleIntSerializer::class) val id: Int? = null,
    @SerialName("game_id") val gameId: String? = null,
    @SerialName("card_group") val cardGroup: String? = null,
    @SerialName("bet_type") val betType: String? = null,
    @SerialName("sort_order") @Serializable(with = FlexibleIntSerializer::class) val sortOrder: Int? = null,
    @SerialName("pick_side") val pickSide: String? = null,
    @SerialName("pick_team") val pickTeam: String? = null,
    @SerialName("pick_label") val pickLabel: String? = null,
    @SerialName("model_number") @Serializable(with = FlexibleDoubleSerializer::class) val modelNumber: Double? = null,
    @SerialName("model_line") @Serializable(with = FlexibleDoubleSerializer::class) val modelLine: Double? = null,
    @SerialName("vegas_line") @Serializable(with = FlexibleDoubleSerializer::class) val vegasLine: Double? = null,
    @SerialName("vegas_price") @Serializable(with = FlexibleDoubleSerializer::class) val vegasPrice: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class) val edge: Double? = null,
    @SerialName("best_book") val bestBook: String? = null,
    @SerialName("best_book_name") val bestBookName: String? = null,
    @SerialName("best_book_logo") val bestBookLogo: String? = null,
    @SerialName("best_line") @Serializable(with = FlexibleDoubleSerializer::class) val bestLine: Double? = null,
    @SerialName("best_odds") @Serializable(with = FlexibleDoubleSerializer::class) val bestOdds: Double? = null,
    val conviction: String? = null,
    val recommendation: String? = null,
    @SerialName("is_mammoth") @Serializable(with = NFLFlexibleBooleanSerializer::class) val isMammoth: Boolean? = null,
    @SerialName("stake_units") @Serializable(with = FlexibleDoubleSerializer::class) val stakeUnits: Double? = null,
    @SerialName("has_play") @Serializable(with = NFLFlexibleBooleanSerializer::class) val hasPlay: Boolean? = null,
    @SerialName("display_only") @Serializable(with = NFLFlexibleBooleanSerializer::class) val displayOnly: Boolean? = null,
    @Serializable(with = NFLPickSignalListSerializer::class) val signals: List<NFLPickSignalRow> = emptyList(),
    @SerialName("signal_keys") @Serializable(with = NFLFlexibleStringListSerializer::class) val signalKeys: List<String> = emptyList(),
)

@Serializable
data class NFLPickSignalRow(
    val key: String,
    val label: String? = null,
    val team: String? = null,
    val action: String? = null,
    val stance: String? = null,
    val tier: String? = null,
)

@Serializable
data class NFLSignalDefinition(
    @SerialName("signal_key") val signalKey: String,
    @SerialName("display_name") val displayName: String? = null,
    @SerialName("one_liner") val oneLiner: String? = null,
    val definition: String? = null,
    @SerialName("why_it_works") val whyItWorks: String? = null,
    @SerialName("bet_direction") val betDirection: String? = null,
    @SerialName("typical_hit") val typicalHit: String? = null,
)

@Serializable
data class NFLTeamTrendRow(
    @SerialName("team_abbr") val teamAbbr: String,
    @SerialName("team_name") val teamName: String? = null,
    @SerialName("su_w") @Serializable(with = FlexibleIntSerializer::class) val suW: Int? = null,
    @SerialName("su_l") @Serializable(with = FlexibleIntSerializer::class) val suL: Int? = null,
    @SerialName("su_record") val suRecord: String? = null,
    @SerialName("ats_w") @Serializable(with = FlexibleIntSerializer::class) val atsW: Int? = null,
    @SerialName("ats_l") @Serializable(with = FlexibleIntSerializer::class) val atsL: Int? = null,
    @SerialName("ats_p") @Serializable(with = FlexibleIntSerializer::class) val atsP: Int? = null,
    @SerialName("ats_pct") @Serializable(with = FlexibleDoubleSerializer::class) val atsPct: Double? = null,
    @SerialName("ou_o") @Serializable(with = FlexibleIntSerializer::class) val ouO: Int? = null,
    @SerialName("ou_u") @Serializable(with = FlexibleIntSerializer::class) val ouU: Int? = null,
    @SerialName("ou_p") @Serializable(with = FlexibleIntSerializer::class) val ouP: Int? = null,
    @SerialName("over_pct") @Serializable(with = FlexibleDoubleSerializer::class) val overPct: Double? = null,
    @SerialName("tt_o") @Serializable(with = FlexibleIntSerializer::class) val ttO: Int? = null,
    @SerialName("tt_u") @Serializable(with = FlexibleIntSerializer::class) val ttU: Int? = null,
    @SerialName("tt_over_pct") @Serializable(with = FlexibleDoubleSerializer::class) val ttOverPct: Double? = null,
    @SerialName("h1_ats_w") @Serializable(with = FlexibleIntSerializer::class) val h1AtsW: Int? = null,
    @SerialName("h1_ats_l") @Serializable(with = FlexibleIntSerializer::class) val h1AtsL: Int? = null,
    @SerialName("h1_ats_p") @Serializable(with = FlexibleIntSerializer::class) val h1AtsP: Int? = null,
    @SerialName("h1_ats_pct") @Serializable(with = FlexibleDoubleSerializer::class) val h1AtsPct: Double? = null,
    @SerialName("h1_ou_o") @Serializable(with = FlexibleIntSerializer::class) val h1OuO: Int? = null,
    @SerialName("h1_ou_u") @Serializable(with = FlexibleIntSerializer::class) val h1OuU: Int? = null,
    @SerialName("h1_over_pct") @Serializable(with = FlexibleDoubleSerializer::class) val h1OverPct: Double? = null,
    @SerialName("last5_su") @Serializable(with = NFLFlexibleStringListSerializer::class) val last5Su: List<String> = emptyList(),
    @SerialName("last5_ats") @Serializable(with = NFLFlexibleStringListSerializer::class) val last5Ats: List<String> = emptyList(),
    @SerialName("last5_ou") @Serializable(with = NFLFlexibleStringListSerializer::class) val last5Ou: List<String> = emptyList(),
    @SerialName("game_log") @Serializable(with = NFLTrendGameLogListSerializer::class) val gameLog: List<NFLTeamTrendGameLog> = emptyList(),
)

@Serializable
data class NFLTeamTrendGameLog(
    val week: Int? = null,
    val opp: String? = null,
    val date: String? = null,
    @SerialName("is_home") val isHome: Boolean? = null,
    val spread: Double? = null,
    val total: Double? = null,
    @SerialName("tt_line") val ttLine: Double? = null,
    @SerialName("h1_spread") val h1Spread: Double? = null,
    @SerialName("h1_total") val h1Total: Double? = null,
    val su: String? = null,
    val ats: String? = null,
    val ou: String? = null,
    val tt: String? = null,
    @SerialName("h1_ats") val h1Ats: String? = null,
    @SerialName("h1_ou") val h1Ou: String? = null,
    @SerialName("cover_margin") val coverMargin: Double? = null,
    @SerialName("ou_margin") val ouMargin: Double? = null,
    @SerialName("tt_margin") val ttMargin: Double? = null,
    @SerialName("h1_cover_margin") val h1CoverMargin: Double? = null,
    @SerialName("h1_ou_margin") val h1OuMargin: Double? = null,
)

@Serializable
data class NFLMatchupHistoryRow(
    @SerialName("matchup_key") val matchupKey: String? = null,
    @SerialName("game_id") val gameId: String? = null,
    @Serializable(with = FlexibleIntSerializer::class) val season: Int? = null,
    val date: String? = null,
    @SerialName("away_team") val awayTeam: String = "",
    @SerialName("home_team") val homeTeam: String = "",
    @SerialName("neutral_site") @Serializable(with = NFLFlexibleBooleanSerializer::class) val neutralSite: Boolean? = null,
    @SerialName("away_score") @Serializable(with = FlexibleIntSerializer::class) val awayScore: Int? = null,
    @SerialName("home_score") @Serializable(with = FlexibleIntSerializer::class) val homeScore: Int? = null,
    @SerialName("total_points") @Serializable(with = FlexibleIntSerializer::class) val totalPoints: Int? = null,
    @SerialName("closing_spread_home") @Serializable(with = FlexibleDoubleSerializer::class) val closingSpreadHome: Double? = null,
    @SerialName("closing_total") @Serializable(with = FlexibleDoubleSerializer::class) val closingTotal: Double? = null,
    @SerialName("closing_ml_home") @Serializable(with = FlexibleIntSerializer::class) val closingMlHome: Int? = null,
    @SerialName("closing_ml_away") @Serializable(with = FlexibleIntSerializer::class) val closingMlAway: Int? = null,
    @SerialName("winner_team") val winnerTeam: String? = null,
    @SerialName("cover_team") val coverTeam: String? = null,
    @SerialName("ats_result") val atsResult: String? = null,
    @SerialName("ou_result") val ouResult: String? = null,
) {
    val id: String get() = gameId ?: "$awayTeam-$homeTeam-${date ?: ""}"
}

// MARK: - Display models

/** Resolved signal (row data + definition) grouped under support/counter. */
data class NFLSignalDisplay(
    val key: String,
    val displayName: String,
    val team: String?,
    val label: String?,
    val action: String?,
    val stance: String,
    val tier: String?,
    val definition: NFLSignalDefinition?,
)

/** One card-group section (spread / total / …) with its ordered pick rows. */
data class NFLPickGroup(val cardGroup: String, val picks: List<NFLDryrunPickRow>) {
    val id: String get() = cardGroup

    val title: String
        get() = when (cardGroup) {
            "spread" -> "Spread Prediction"
            "total" -> "Total Prediction"
            "team_total" -> "Team Total Prediction"
            "moneyline" -> "Moneyline Prediction"
            "h1_spread" -> "1H Spread Prediction"
            "h1_total" -> "1H Total Prediction"
            "h1_ml" -> "1H Moneyline Prediction"
            else -> cardGroup.replaceFirstChar { it.uppercase() }
        }

    val systemImage: String
        get() = when (cardGroup) {
            "spread", "h1_spread" -> "target"
            "total", "h1_total" -> "arrow.up.arrow.down"
            "team_total" -> "chart.bar.fill"
            "moneyline", "h1_ml" -> "dollarsign.circle.fill"
            else -> "football.fill"
        }

    val tint: Color
        get() = when (cardGroup) {
            "total", "h1_total" -> AppColors.appAccentBlue
            "moneyline", "h1_ml" -> AppColors.appAccentAmber
            else -> AppColors.appPrimary
        }
}

enum class NFLTrendKind {
    SPREAD, TOTAL, TEAM_TOTAL, MONEYLINE, H1_SPREAD, H1_TOTAL;

    val title: String
        get() = when (this) {
            SPREAD -> "ATS Trend"
            TOTAL -> "O/U Trend"
            TEAM_TOTAL -> "Team Total Trend"
            MONEYLINE -> "Moneyline Trend"
            H1_SPREAD -> "1H ATS Trend"
            H1_TOTAL -> "1H O/U Trend"
        }

    val lineHeader: String
        get() = when (this) {
            MONEYLINE -> "Line"
            TEAM_TOTAL -> "TT"
            H1_SPREAD -> "1H Spr"
            H1_TOTAL -> "1H Tot"
            SPREAD -> "Spread"
            TOTAL -> "Total"
        }

    val resultHeader: String
        get() = when (this) {
            TOTAL, H1_TOTAL -> "O/U"
            TEAM_TOTAL -> "TT"
            MONEYLINE -> "SU"
            else -> "ATS"
        }

    val marginHeader: String
        get() = when (this) {
            SPREAD, H1_SPREAD -> "Cover +/-"
            TOTAL, H1_TOTAL -> "O/U +/-"
            TEAM_TOTAL -> "TT +/-"
            MONEYLINE -> "Margin"
        }
}

data class NFLTrendDetailSelection(val team: NFLTeamTrendRow, val kind: NFLTrendKind)

data class NFLTrendGameDetailRow(
    val date: String?,
    val opponent: String,
    val locationMarker: String,
    val lineText: String,
    val result: String,
    val margin: Double?,
)

// MARK: - Supabase loaders

suspend fun loadNFLDryrunPicks(gameId: String): List<NFLDryrunPickRow> = runCatching {
    SupabaseClients.cfb
        .from("nfl_dryrun_picks")
        .select {
            filter { eq("game_id", gameId) }
            order("sort_order", Order.ASCENDING)
        }
        .decodeList<NFLDryrunPickRow>()
}.getOrDefault(emptyList())

/** Slim column set the feed card needs for slate pills (mirrors iOS `NFLSlatePickRow`). */
suspend fun loadNFLSlatePicks(gameId: String): List<NFLDryrunPickRow> = runCatching {
    SupabaseClients.cfb
        .from("nfl_dryrun_picks")
        .select(
            Columns.raw(
                "game_id,card_group,pick_team,pick_side,pick_label,best_line,vegas_line," +
                    "conviction,is_mammoth,signal_keys,has_play,sort_order",
            ),
        ) {
            filter { eq("game_id", gameId) }
            order("sort_order", Order.ASCENDING)
        }
        .decodeList<NFLDryrunPickRow>()
}.getOrDefault(emptyList())

suspend fun loadNFLSignalDefs(): Map<String, NFLSignalDefinition> = runCatching {
    SupabaseClients.cfb
        .from("nfl_signal_defs")
        .select()
        .decodeList<NFLSignalDefinition>()
        .associateBy { it.signalKey }
}.getOrDefault(emptyMap())

suspend fun loadNFLTeamTrends(awayAbbr: String, homeAbbr: String): Map<String, NFLTeamTrendRow> = runCatching {
    SupabaseClients.cfb
        .from("nfl_team_trends")
        .select {
            filter { isIn("team_abbr", listOf(awayAbbr, homeAbbr)) }
        }
        .decodeList<NFLTeamTrendRow>()
        .associateBy { it.teamAbbr }
}.getOrDefault(emptyMap())

suspend fun loadNFLMatchupHistory(awayAbbr: String, homeAbbr: String): List<NFLMatchupHistoryRow> = runCatching {
    SupabaseClients.cfb
        .from("nfl_matchup_history")
        .select {
            filter { eq("matchup_key", listOf(awayAbbr, homeAbbr).sorted().joinToString("|")) }
            order("date", Order.DESCENDING)
            limit(5)
        }
        .decodeList<NFLMatchupHistoryRow>()
}.getOrDefault(emptyList())

// MARK: - Shared color helpers

fun nflConvictionColor(raw: String?): Color = when ((raw ?: "").lowercase()) {
    "mammoth", "high" -> hexColor(0xF97316)
    "med", "medium" -> AppColors.appPrimary
    "low", "lean" -> AppColors.appAccentBlue
    else -> AppColors.appTextSecondary
}

fun nflTrendChipColor(value: String): Color = when (value.uppercase()) {
    "W", "O", "COVER", "OVER" -> hexColor(0x22C55E)
    "L", "U", "UNDER" -> AppColors.appAccentRed
    else -> AppColors.appTextSecondary
}

// MARK: - Tolerant serializers

/** Bool-or-null that never throws (Swift `try? decode(Bool)`); wrong-typed → null. */
object NFLFlexibleBooleanSerializer : KSerializer<Boolean?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("NFLFlexibleBoolean", PrimitiveKind.BOOLEAN).nullable

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

/**
 * String list decode tolerant of the table's three shapes: a real JSON array,
 * a JSON-stringified array, or a comma-separated string (iOS `NFLFlexibleStringList`).
 */
object NFLFlexibleStringListSerializer : KSerializer<List<String>> {
    private val delegate = ListSerializer(String.serializer())
    override val descriptor: SerialDescriptor = delegate.descriptor

    override fun deserialize(decoder: Decoder): List<String> {
        val input = decoder as? JsonDecoder
            ?: return runCatching { delegate.deserialize(decoder) }.getOrDefault(emptyList())
        val el = runCatching { input.decodeJsonElement() }.getOrNull() ?: return emptyList()
        if (el is JsonArray) {
            return el.mapNotNull { (it as? JsonPrimitive)?.content }.filter { it.isNotEmpty() }
        }
        val raw = (el as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content ?: return emptyList()
        runCatching { Json.decodeFromString(delegate, raw) }.getOrNull()?.let { parsed ->
            return parsed.filter { it.isNotEmpty() }
        }
        return raw.split(",").map { it.trim() }.filter { it.isNotEmpty() }
    }

    override fun serialize(encoder: Encoder, value: List<String>) = delegate.serialize(encoder, value)
}

object NFLPickSignalListSerializer : LossyListSerializer<NFLPickSignalRow>(NFLPickSignalRow.serializer())
object NFLTrendGameLogListSerializer : LossyListSerializer<NFLTeamTrendGameLog>(NFLTeamTrendGameLog.serializer())
