@file:OptIn(ExperimentalSerializationApi::class)

package com.wagerproof.core.models.serialization

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.descriptors.nullable
import kotlin.time.Instant
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toInstant
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.nullable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlin.math.roundToInt

/**
 * Shared Json instance for all Wagerproof model decoding. Supabase rows carry
 * extra columns and Postgres NUMERIC drifts between number and string on the
 * wire, so decoding must be lenient by default.
 */
val WagerproofJson: Json = Json {
    ignoreUnknownKeys = true
    isLenient = true
    coerceInputValues = true
    explicitNulls = false
}

// MARK: flexible primitives ---------------------------------------------------

private fun JsonElement.asFlexDouble(stripPercent: Boolean): Double? {
    val prim = this as? JsonPrimitive ?: return null
    if (prim is JsonNull) return null
    prim.doubleOrNull?.let { return it }
    var s = prim.content.trim()
    if (stripPercent) s = s.replace("%", "").trim()
    return s.toDoubleOrNull()
}

private fun JsonElement.asFlexInt(roundDoubles: Boolean): Int? {
    val prim = this as? JsonPrimitive ?: return null
    if (prim is JsonNull) return null
    prim.intOrNull?.let { return it }
    val s = prim.content.trim()
    s.toIntOrNull()?.let { return it }
    val d = prim.doubleOrNull ?: s.toDoubleOrNull() ?: return null
    return if (roundDoubles) d.roundToInt() else d.toInt()
}

private fun Decoder.decodeFlexElement(): JsonElement? =
    (this as? JsonDecoder)?.decodeJsonElement()

/** Number-or-string double (Postgres NUMERIC via PostgREST). Unparsable → null. */
object FlexibleDoubleSerializer : KSerializer<Double?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("FlexibleDouble", PrimitiveKind.DOUBLE).nullable

    override fun deserialize(decoder: Decoder): Double? {
        val el = decoder.decodeFlexElement() ?: return decoder.decodeDouble()
        return el.asFlexDouble(stripPercent = false)
    }

    override fun serialize(encoder: Encoder, value: Double?) {
        if (value == null) encoder.encodeNull() else encoder.encodeDouble(value)
    }
}

/** Like [FlexibleDoubleSerializer] but strips a `%` suffix from string values (MLB trend pcts). */
object PercentFlexibleDoubleSerializer : KSerializer<Double?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("PercentFlexibleDouble", PrimitiveKind.DOUBLE).nullable

    override fun deserialize(decoder: Decoder): Double? {
        val el = decoder.decodeFlexElement() ?: return decoder.decodeDouble()
        return el.asFlexDouble(stripPercent = true)
    }

    override fun serialize(encoder: Encoder, value: Double?) {
        if (value == null) encoder.encodeNull() else encoder.encodeDouble(value)
    }
}

/** Non-null flexible double; missing/null/unparsable → 0.0 (Swift `flexDouble ?? 0`). */
object FlexibleDoubleOrZeroSerializer : KSerializer<Double> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("FlexibleDoubleOrZero", PrimitiveKind.DOUBLE)

    override fun deserialize(decoder: Decoder): Double {
        val el = decoder.decodeFlexElement() ?: return decoder.decodeDouble()
        return el.asFlexDouble(stripPercent = true) ?: 0.0
    }

    override fun serialize(encoder: Encoder, value: Double) = encoder.encodeDouble(value)
}

/** Non-null flexible double defaulting to 1.0 — for `units` columns (Swift `?? 1.0`). */
object FlexibleDoubleOrOneSerializer : KSerializer<Double> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("FlexibleDoubleOrOne", PrimitiveKind.DOUBLE)

    override fun deserialize(decoder: Decoder): Double {
        val el = decoder.decodeFlexElement() ?: return decoder.decodeDouble()
        return el.asFlexDouble(stripPercent = false) ?: 1.0
    }

    override fun serialize(encoder: Encoder, value: Double) = encoder.encodeDouble(value)
}

/** Int-or-string-or-double int; doubles truncate toward zero (Swift `Int(d)`). Unparsable → null. */
object FlexibleIntSerializer : KSerializer<Int?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("FlexibleInt", PrimitiveKind.INT).nullable

    override fun deserialize(decoder: Decoder): Int? {
        val el = decoder.decodeFlexElement() ?: return decoder.decodeInt()
        return el.asFlexInt(roundDoubles = false)
    }

    override fun serialize(encoder: Encoder, value: Int?) {
        if (value == null) encoder.encodeNull() else encoder.encodeInt(value)
    }
}

/** Variant that rounds doubles (Swift `Int(d.rounded())` — MLB player-prop odds). */
object RoundingFlexibleIntSerializer : KSerializer<Int?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("RoundingFlexibleInt", PrimitiveKind.INT).nullable

    override fun deserialize(decoder: Decoder): Int? {
        val el = decoder.decodeFlexElement() ?: return decoder.decodeInt()
        return el.asFlexInt(roundDoubles = true)
    }

    override fun serialize(encoder: Encoder, value: Int?) {
        if (value == null) encoder.encodeNull() else encoder.encodeInt(value)
    }
}

/** Non-null flexible int; missing/null/unparsable → 0. */
object FlexibleIntOrZeroSerializer : KSerializer<Int> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("FlexibleIntOrZero", PrimitiveKind.INT)

    override fun deserialize(decoder: Decoder): Int {
        val el = decoder.decodeFlexElement() ?: return decoder.decodeInt()
        return el.asFlexInt(roundDoubles = false) ?: 0
    }

    override fun serialize(encoder: Encoder, value: Int) = encoder.encodeInt(value)
}

/** String that may arrive as a number (Swift f5FlexString). Non-primitive → null. */
object FlexibleStringSerializer : KSerializer<String?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("FlexibleString", PrimitiveKind.STRING).nullable

    override fun deserialize(decoder: Decoder): String? {
        val el = decoder.decodeFlexElement() ?: return decoder.decodeString()
        val prim = el as? JsonPrimitive ?: return null
        if (prim is JsonNull) return null
        return prim.content
    }

    override fun serialize(encoder: Encoder, value: String?) {
        if (value == null) encoder.encodeNull() else encoder.encodeString(value)
    }
}

// MARK: enum fallback ---------------------------------------------------------

/**
 * Enum serializer matching Swift's `Enum(rawValue:) ?? default` semantics:
 * unknown / non-string wire values decode to [default] instead of throwing.
 * [candidates] lets callers try transformed raw values in order
 * (e.g. CFBFlagConviction tries as-is then uppercased; GameType lowercases).
 */
open class FallbackEnumSerializer<T : Any>(
    serialName: String,
    private val rawToValue: Map<String, T>,
    private val valueToRaw: (T) -> String,
    private val default: T,
    private val candidates: (String) -> List<String> = { listOf(it) },
) : KSerializer<T> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor(serialName, PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): T {
        val raw = rawString(decoder) ?: return default
        for (candidate in candidates(raw)) rawToValue[candidate]?.let { return it }
        return default
    }

    override fun serialize(encoder: Encoder, value: T) = encoder.encodeString(valueToRaw(value))
}

/** Enum-with-fallback where the Swift fallback is `nil` (e.g. AgentArchetype). */
open class OptionalFallbackEnumSerializer<T : Any>(
    serialName: String,
    private val rawToValue: Map<String, T>,
    private val valueToRaw: (T) -> String,
    private val candidates: (String) -> List<String> = { listOf(it) },
) : KSerializer<T?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor(serialName, PrimitiveKind.STRING).nullable

    override fun deserialize(decoder: Decoder): T? {
        val raw = rawString(decoder) ?: return null
        for (candidate in candidates(raw)) rawToValue[candidate]?.let { return it }
        return null
    }

    override fun serialize(encoder: Encoder, value: T?) {
        if (value == null) encoder.encodeNull() else encoder.encodeString(valueToRaw(value))
    }
}

private fun rawString(decoder: Decoder): String? {
    val el = decoder.decodeFlexElement() ?: return runCatching { decoder.decodeString() }.getOrNull()
    val prim = el as? JsonPrimitive ?: return null
    if (prim is JsonNull) return null
    return prim.content
}

// MARK: lossy lists -----------------------------------------------------------

/**
 * Element-wise list decode that skips undecodable elements — one corrupt row
 * must never blank a pick history / snapshot (Swift `decodeLossyArray`).
 * Subclass per element type: `object X : LossyListSerializer<Y>(Y.serializer())`.
 */
open class LossyListSerializer<T>(
    private val element: KSerializer<T>,
) : KSerializer<List<T>> {
    private val delegate = ListSerializer(element)
    override val descriptor: SerialDescriptor = delegate.descriptor

    override fun deserialize(decoder: Decoder): List<T> {
        val input = decoder as? JsonDecoder ?: return delegate.deserialize(decoder)
        val el = runCatching { input.decodeJsonElement() }.getOrNull() ?: return emptyList()
        val array = el as? JsonArray ?: return emptyList()
        return array.mapNotNull { item ->
            runCatching { input.json.decodeFromJsonElement(element, item) }.getOrNull()
        }
    }

    override fun serialize(encoder: Encoder, value: List<T>) = delegate.serialize(encoder, value)
}

/** Standalone lossy decode for repository-layer use (raw JSON string or element). */
fun <T> Json.decodeLossyList(deserializer: KSerializer<T>, element: JsonElement?): List<T> {
    val array = element as? JsonArray ?: return emptyList()
    return array.mapNotNull { runCatching { decodeFromJsonElement(deserializer, it) }.getOrNull() }
}

fun <T> Json.decodeLossyList(deserializer: KSerializer<T>, jsonString: String): List<T> {
    val element = runCatching { parseToJsonElement(jsonString) }.getOrNull()
    return decodeLossyList(deserializer, element)
}

// MARK: dates -----------------------------------------------------------------

/**
 * ISO-8601 instant tolerant of Supabase's two shapes (with/without fractional
 * seconds, with/without offset). Only Profile.createdAt uses a real date type;
 * every other timestamp in the module stays a String on purpose.
 */
object LenientInstantSerializer : KSerializer<Instant?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("LenientInstant", PrimitiveKind.STRING).nullable

    override fun deserialize(decoder: Decoder): Instant? {
        val raw = rawString(decoder)?.trim().takeUnless { it.isNullOrEmpty() } ?: return null
        runCatching { return Instant.parse(raw) }
        runCatching { return Instant.parse(raw + "Z") }
        // Offset-less local timestamp — Supabase emits these for timestamp-without-tz columns.
        runCatching { return LocalDateTime.parse(raw).toInstant(TimeZone.UTC) }
        return null
    }

    override fun serialize(encoder: Encoder, value: Instant?) {
        if (value == null) encoder.encodeNull() else encoder.encodeString(value.toString())
    }
}
