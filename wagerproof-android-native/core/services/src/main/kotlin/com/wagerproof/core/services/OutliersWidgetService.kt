package com.wagerproof.core.services

import com.wagerproof.core.models.OutlierAlertForWidget
import com.wagerproof.core.models.OutlierFadeAlert
import com.wagerproof.core.models.OutlierValueAlert
import com.wagerproof.core.models.serialization.WagerproofJson
import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.shared.AppGroupKey
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put

/**
 * Composes the "Top Outliers" home-screen widget payload (iOS
 * OutliersWidgetService.swift). Reuses OutliersService's full fetch pipeline
 * (fetchWeekGames -> value/fade alerts) — several Supabase queries per sport
 * plus prediction hydration, far too expensive to run from a widget refresh.
 * Only the main app calls [sync]; the widget just reads the cached payload.
 *
 * The App Group blob is ONE JSON document shared across domains (agent picks,
 * outliers, entitlement mirror...), so this does a read-modify-write that
 * replaces only `topOutliers` + `lastUpdated` and preserves every other key.
 */
object OutliersWidgetService {
    private const val MAX_WIDGET_ALERTS = 6

    suspend fun sync(): List<OutlierAlertForWidget> {
        val games = runCatching { OutliersService.shared.fetchWeekGames() }.getOrNull()
        if (games.isNullOrEmpty()) return emptyList()

        val (values, fades) = coroutineScope {
            val valuesTask = async { OutliersService.shared.fetchValueAlerts(games) }
            val fadesTask = async { OutliersService.shared.fetchFadeAlerts(games) }
            valuesTask.await() to fadesTask.await()
        }

        val top = (values.map(::toWidget) + fades.map(::toWidget))
            .sortedByDescending { it.confidence }
            .take(MAX_WIDGET_ALERTS)

        // Write failure is non-fatal (iOS try?): the widget just keeps stale data.
        runCatching { writeTopOutliers(top) }
        return top
    }

    // -- Mapping ---------------------------------------------------------------

    private fun toWidget(alert: OutlierValueAlert) = OutlierAlertForWidget(
        id = "value-${alert.id}",
        kind = OutlierAlertForWidget.Kind.VALUE,
        sport = alert.sport.raw,
        awayTeam = alert.awayTeam,
        homeTeam = alert.homeTeam,
        marketType = alert.marketType.raw,
        side = alert.side,
        confidence = alert.percentage.roundToInt(),
        gameTime = alert.game.gameTime,
    )

    private fun toWidget(alert: OutlierFadeAlert) = OutlierAlertForWidget(
        id = "fade-${alert.id}",
        kind = OutlierAlertForWidget.Kind.FADE,
        sport = alert.sport.raw,
        awayTeam = alert.awayTeam,
        homeTeam = alert.homeTeam,
        marketType = alert.pickType.raw,
        // Raw model-favored side — the widget view computes the "fade to the
        // opposite side" recommendation from this + kind.
        side = alert.predictedTeam,
        confidence = alert.confidence,
        gameTime = alert.game.gameTime,
    )

    // -- Payload read-modify-write ----------------------------------------------

    private fun writeTopOutliers(alerts: List<OutlierAlertForWidget>) {
        val prefs = AppGroup.prefs
        // The live key is the legacy Expo-compat "widgetPayload" — NOT widget_payload_v1.
        val existing: Map<String, kotlinx.serialization.json.JsonElement> =
            prefs.getString(AppGroupKey.WIDGET_PAYLOAD_LEGACY, null)
                ?.let { runCatching { WagerproofJson.parseToJsonElement(it).jsonObject }.getOrNull() }
                ?: emptyPayloadSkeleton()

        val merged = buildJsonObject {
            existing.forEach { (key, value) -> put(key, value) }
            put("topOutliers", WagerproofJson.encodeToJsonElement(alerts))
            put("lastUpdated", nowISO())
        }
        prefs.edit()
            .putString(
                AppGroupKey.WIDGET_PAYLOAD_LEGACY,
                WagerproofJson.encodeToString(JsonObject.serializer(), merged),
            )
            .apply()
    }

    /** Fresh payload shape when nothing exists yet — mirrors iOS WidgetDataPayload.empty(). */
    private fun emptyPayloadSkeleton(): Map<String, kotlinx.serialization.json.JsonElement> = mapOf(
        "editorPicks" to JsonArray(emptyList()),
        "fadeAlerts" to JsonArray(emptyList()),
        "polymarketValues" to JsonArray(emptyList()),
        "topAgentPicks" to JsonArray(emptyList()),
        "lastUpdated" to JsonPrimitive(""),
    )

    // iOS emits ISO8601 with fractional seconds in UTC — keep the exact shape.
    private val isoMillisUTC: DateTimeFormatter =
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).withZone(ZoneOffset.UTC)

    private fun nowISO(): String = isoMillisUTC.format(Instant.now())
}
