package com.wagerproof.core.shared

import android.content.SharedPreferences
import com.wagerproof.core.models.WidgetDataPayload
import com.wagerproof.core.models.serialization.WagerproofJson

/**
 * Typed read/write layer for the home-screen widget payload — port of the
 * payload plumbing in iOS `TopAgentsWidgetService` (`readPayload` /
 * `writePayload`), backed by [AppGroup.prefs] like every other shared key.
 *
 * The payload is stored as a JSON STRING under the legacy Expo-compat literal
 * `"widgetPayload"` ([AppGroupKey.WIDGET_PAYLOAD_LEGACY]) — NOT
 * `widget_payload_v1` (docs/inventory/02_services.md gotcha #9).
 *
 * Writers must go through [update] (read-modify-write) so each domain (editor
 * picks, fade alerts, top agent picks, outliers) replaces only its own slice
 * plus `lastUpdated`, matching the iOS/RN sync contract.
 */
object WidgetPayloadStore {

    private val prefs: SharedPreferences get() = AppGroup.prefs

    /** Current payload; [WidgetDataPayload.empty] when absent or corrupt. */
    fun read(): WidgetDataPayload = decode(prefs.getString(AppGroupKey.WIDGET_PAYLOAD_LEGACY, null))

    fun write(payload: WidgetDataPayload) {
        prefs.edit()
            .putString(
                AppGroupKey.WIDGET_PAYLOAD_LEGACY,
                WagerproofJson.encodeToString(WidgetDataPayload.serializer(), payload),
            )
            .apply()
    }

    /**
     * Read-modify-write in one step — a domain sync replaces just its slice
     * (e.g. `topAgentPicks` + `lastUpdated`) without clobbering the others.
     */
    fun update(transform: (WidgetDataPayload) -> WidgetDataPayload) {
        write(transform(read()))
    }

    private fun decode(json: String?): WidgetDataPayload {
        if (json.isNullOrEmpty()) return WidgetDataPayload.empty()
        // Corrupt/foreign payloads degrade to empty rather than crashing the
        // widget — same tolerance as the iOS reader.
        return runCatching {
            WagerproofJson.decodeFromString(WidgetDataPayload.serializer(), json)
        }.getOrDefault(WidgetDataPayload.empty())
    }
}
