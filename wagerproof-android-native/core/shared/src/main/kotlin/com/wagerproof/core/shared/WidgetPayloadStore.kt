package com.wagerproof.core.shared

import android.content.SharedPreferences
import com.wagerproof.core.models.WidgetDataPayload
import com.wagerproof.core.models.serialization.WagerproofJson
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put

/**
 * Typed read/write layer for the home-screen widget payload — port of the
 * payload plumbing in iOS `TopAgentsWidgetService` (`readPayload` /
 * `writePayload`), backed by [AppGroup.prefs] like every other shared key.
 *
 * The payload is stored as a JSON STRING under the legacy Expo-compat literal
 * `"widgetPayload"` ([AppGroupKey.WIDGET_PAYLOAD_LEGACY]) — NOT
 * `widget_payload_v1` (docs/inventory/02_services.md gotcha #9).
 *
 * Writers must go through [updateSlice] so each domain (editor picks, fade
 * alerts, top agent picks, outliers) replaces only its own slice plus
 * `lastUpdated`, matching the iOS/RN sync contract.
 */
object WidgetPayloadStore {

    private val prefs: SharedPreferences get() = AppGroup.prefs

    /**
     * One writer at a time.
     *
     * The hourly widget worker fetches every domain concurrently, and each
     * domain's write is a read-modify-write against the SAME blob — interleaved,
     * the writer that reads first but finishes last reverts the other domain's
     * slice to the previous hour's data. iOS dodges this by merging both results
     * into a single write (`App/WidgetSyncCoordinator.swift`: "A single write is
     * important"); we serialize the writers instead, which also covers domains
     * added later.
     */
    private val writeMutex = Mutex()

    /** Current payload; [WidgetDataPayload.empty] when absent or corrupt. */
    fun read(): WidgetDataPayload = decode(prefs.getString(AppGroupKey.WIDGET_PAYLOAD_LEGACY, null))

    /**
     * Replace one domain's slice (plus `lastUpdated`) inside the shared blob,
     * leaving every other key untouched.
     *
     * Merging at the raw-JSON level on purpose: a typed round-trip through
     * [WidgetDataPayload] would drop any key this Kotlin model doesn't know
     * about, and the blob is a cross-platform contract with the RN bridge.
     */
    suspend fun updateSlice(key: String, value: JsonElement) = writeMutex.withLock {
        val merged = buildJsonObject {
            readRaw().forEach { (existingKey, existingValue) -> put(existingKey, existingValue) }
            put(key, value)
            put("lastUpdated", nowISO())
        }
        writeRaw(merged)
    }

    /** Raw payload object, or the empty skeleton when absent/corrupt. */
    private fun readRaw(): JsonObject =
        prefs.getString(AppGroupKey.WIDGET_PAYLOAD_LEGACY, null)
            ?.let { runCatching { WagerproofJson.parseToJsonElement(it).jsonObject }.getOrNull() }
            ?: EMPTY_SKELETON

    private fun writeRaw(payload: JsonObject) {
        // Stored as a JSON *string*, matching the RN bridge / iOS UserDefaults shape.
        prefs.edit()
            .putString(
                AppGroupKey.WIDGET_PAYLOAD_LEGACY,
                WagerproofJson.encodeToString(JsonObject.serializer(), payload),
            )
            .apply()
    }

    private fun decode(json: String?): WidgetDataPayload {
        if (json.isNullOrEmpty()) return WidgetDataPayload.empty()
        // Corrupt/foreign payloads degrade to empty rather than crashing the
        // widget — same tolerance as the iOS reader.
        return runCatching {
            WagerproofJson.decodeFromString(WidgetDataPayload.serializer(), json)
        }.getOrDefault(WidgetDataPayload.empty())
    }

    /** Fresh payload shape when nothing exists yet — mirrors iOS `WidgetDataPayload.empty()`. */
    private val EMPTY_SKELETON = JsonObject(
        mapOf(
            "editorPicks" to JsonArray(emptyList()),
            "fadeAlerts" to JsonArray(emptyList()),
            "polymarketValues" to JsonArray(emptyList()),
            "topAgentPicks" to JsonArray(emptyList()),
            "lastUpdated" to JsonPrimitive(""),
        ),
    )

    // iOS emits ISO8601 with fractional seconds in UTC — keep the exact shape.
    private val isoMillisUTC: DateTimeFormatter =
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).withZone(ZoneOffset.UTC)

    private fun nowISO(): String = isoMillisUTC.format(Instant.now())
}
