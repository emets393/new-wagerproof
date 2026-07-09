package com.wagerproof.app.features.cfb

import com.wagerproof.core.models.serialization.FlexibleDoubleSerializer
import com.wagerproof.core.models.serialization.FlexibleIntSerializer
import com.wagerproof.core.models.serialization.FlexibleStringSerializer
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.KSerializer
import kotlinx.serialization.ExperimentalSerializationApi
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
 * Tolerant `cfb_dryrun_picks` row shared by the feed card and game detail.
 * Numeric ids/lines and JSON-array/string signal-key variants mirror the iOS
 * `FlexibleText` / `FlexibleStringList` decoding contract.
 */
@Serializable
data class CFBDryrunPickRow(
    @Serializable(with = FlexibleStringSerializer::class) val id: String? = null,
    @SerialName("game_id") @Serializable(with = FlexibleStringSerializer::class) val gameId: String? = null,
    @SerialName("card_group") val cardGroup: String? = null,
    @SerialName("bet_type") val betType: String? = null,
    @SerialName("sort_order") @Serializable(with = FlexibleIntSerializer::class) val sortOrder: Int? = null,
    @SerialName("pick_team") val pickTeam: String? = null,
    @SerialName("pick_side") val pickSide: String? = null,
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
    @SerialName("is_mammoth") @Serializable(with = CFBFlexibleBooleanSerializer::class) val isMammoth: Boolean? = null,
    @SerialName("stake_units") @Serializable(with = FlexibleDoubleSerializer::class) val stakeUnits: Double? = null,
    val recommendation: String? = null,
    @SerialName("display_only") @Serializable(with = CFBFlexibleBooleanSerializer::class) val displayOnly: Boolean? = null,
    @SerialName("signal_keys") @Serializable(with = CFBFlexibleStringListSerializer::class) val signalKeys: List<String> = emptyList(),
    @SerialName("has_play") @Serializable(with = CFBFlexibleBooleanSerializer::class) val hasPlay: Boolean? = null,
) {
    val resolvedModelLine: Double? get() = modelLine ?: modelNumber
    val normalizedCardGroup: String get() = normalizeCFBCardGroup(cardGroup)
}

/** Full detail payload. Result preserves the caller's cached rows on failure. */
suspend fun loadCFBDryrunPicksResult(gameId: String): Result<List<CFBDryrunPickRow>> = runCatching {
    SupabaseClients.cfb
        .from("cfb_dryrun_picks")
        .select {
            filter { eq("game_id", gameId) }
            order("sort_order", Order.ASCENDING)
        }
        .decodeList<CFBDryrunPickRow>()
}

/** Slim feed-card payload, matching iOS `CFBSlatePickRow`. */
suspend fun loadCFBSlatePicksResult(gameId: String): Result<List<CFBDryrunPickRow>> = runCatching {
    SupabaseClients.cfb
        .from("cfb_dryrun_picks")
        .select(
            Columns.raw(
                "game_id,card_group,pick_team,pick_side,pick_label,best_line,vegas_line," +
                    "conviction,is_mammoth,signal_keys,has_play,sort_order",
            ),
        ) {
            filter { eq("game_id", gameId) }
            order("sort_order", Order.ASCENDING)
        }
        .decodeList<CFBDryrunPickRow>()
}

fun normalizeCFBCardGroup(group: String?): String {
    val key = (group ?: "other").lowercase()
    return when {
        key.startsWith("team_total") -> "team_total"
        key == "ml" -> "moneyline"
        key == "h1_moneyline" -> "h1_ml"
        else -> key
    }
}

@OptIn(ExperimentalSerializationApi::class)
object CFBFlexibleBooleanSerializer : KSerializer<Boolean?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("CFBFlexibleBoolean", PrimitiveKind.BOOLEAN).nullable

    override fun deserialize(decoder: Decoder): Boolean? {
        val element = (decoder as? JsonDecoder)?.decodeJsonElement()
            ?: return runCatching { decoder.decodeBoolean() }.getOrNull()
        val primitive = element as? JsonPrimitive ?: return null
        if (primitive is JsonNull) return null
        return primitive.booleanOrNull
    }

    override fun serialize(encoder: Encoder, value: Boolean?) {
        if (value == null) encoder.encodeNull() else encoder.encodeBoolean(value)
    }
}

object CFBFlexibleStringListSerializer : KSerializer<List<String>> {
    private val delegate = ListSerializer(String.serializer())
    override val descriptor: SerialDescriptor = delegate.descriptor

    override fun deserialize(decoder: Decoder): List<String> {
        val input = decoder as? JsonDecoder
            ?: return runCatching { delegate.deserialize(decoder) }.getOrDefault(emptyList())
        val element = runCatching { input.decodeJsonElement() }.getOrNull() ?: return emptyList()
        if (element is JsonArray) {
            return element.mapNotNull { (it as? JsonPrimitive)?.content }.filter { it.isNotBlank() }
        }
        val raw = (element as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content ?: return emptyList()
        runCatching { Json.decodeFromString(delegate, raw) }.getOrNull()?.let { parsed ->
            return parsed.filter { it.isNotBlank() }
        }
        return raw.split(',').map(String::trim).filter(String::isNotBlank)
    }

    override fun serialize(encoder: Encoder, value: List<String>) = delegate.serialize(encoder, value)
}
