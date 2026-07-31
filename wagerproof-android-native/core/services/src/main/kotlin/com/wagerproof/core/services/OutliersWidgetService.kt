package com.wagerproof.core.services

import com.wagerproof.core.models.OutlierAlertForWidget
import com.wagerproof.core.models.OutlierFadeAlert
import com.wagerproof.core.models.OutlierValueAlert
import com.wagerproof.core.models.serialization.WagerproofJson
import com.wagerproof.core.shared.WidgetPayloadStore
import kotlin.math.roundToInt
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.encodeToJsonElement

/**
 * Composes the "Top Outliers" home-screen widget payload (iOS
 * OutliersWidgetService.swift). Reuses OutliersService's full fetch pipeline
 * (fetchWeekGames -> value/fade alerts) — several Supabase queries per sport
 * plus prediction hydration, far too expensive to run from a widget refresh.
 * Only the main app calls [sync]; the widget just reads the cached payload.
 *
 * The App Group blob is ONE JSON document shared across domains (agent picks,
 * outliers, entitlement mirror...), so this replaces only `topOutliers` +
 * `lastUpdated` and preserves every other key. That merge belongs to
 * [WidgetPayloadStore], whose mutex is what keeps the concurrent TopAgents sync
 * from clobbering this slice.
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

    // -- Payload write -----------------------------------------------------------

    private suspend fun writeTopOutliers(alerts: List<OutlierAlertForWidget>) {
        WidgetPayloadStore.updateSlice(
            key = "topOutliers",
            value = WagerproofJson.encodeToJsonElement(alerts),
        )
    }
}
