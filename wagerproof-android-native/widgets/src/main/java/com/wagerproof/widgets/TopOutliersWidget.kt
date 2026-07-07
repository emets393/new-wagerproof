package com.wagerproof.widgets

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.wagerproof.core.models.OutlierAlertForWidget
import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.shared.WidgetPayloadStore

/**
 * "Top Outliers" home-screen widget — Glance port of iOS `TopOutliersWidget`.
 *
 * Renders the day's highest-confidence value/fade alerts from the App Group
 * payload the main app syncs (`WidgetPayloadStore.read().topOutliers`). No
 * in-widget network fetch — same reasoning as iOS: keep the widget process
 * light and off the authed Supabase path. Empty cache → "open the app"
 * placeholder. Tap → `wagerproof://outliers` deep link.
 */
class TopOutliersGlanceWidget : GlanceAppWidget() {

    override val sizeMode: SizeMode = SizeMode.Responsive(WidgetSizes.ALL)

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        // Widgets run in the app process, but a widget update can spin the
        // process up before any Activity — make the prefs container safe to read.
        AppGroup.initialize(context)
        val alerts = WidgetPayloadStore.read().topOutliers
        provideContent {
            TopOutliersContent(alerts)
        }
    }
}

class TopOutliersWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TopOutliersGlanceWidget()
}

private fun outliersDeepLink(context: Context): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse("wagerproof://outliers")).apply {
        setPackage(context.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

@Composable
private fun TopOutliersContent(alerts: List<OutlierAlertForWidget>) {
    val family = currentFamily()
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetTheme.background)
            .padding(12.dp)
            .clickable(actionStartActivity(outliersDeepLink(androidx.glance.LocalContext.current))),
        contentAlignment = Alignment.TopStart,
    ) {
        when {
            alerts.isEmpty() -> EmptyOutliers(compact = family == WidgetFamily.SMALL)
            family == WidgetFamily.SMALL -> SmallOutlier(alerts.first())
            family == WidgetFamily.LARGE -> OutliersList(alerts.take(5))
            else -> OutliersList(alerts.take(2))
        }
    }
}

@Composable
private fun currentFamily(): WidgetFamily {
    val size = LocalSize.current
    return when {
        size.width < 200.dp -> WidgetFamily.SMALL
        size.height < 220.dp -> WidgetFamily.MEDIUM
        else -> WidgetFamily.LARGE
    }
}

@Composable
private fun EmptyOutliers(compact: Boolean) {
    Column(
        modifier = GlanceModifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // FIDELITY-WAIVER #211: iOS uses the "bell.badge.fill" SF Symbol; Glance
        // has no symbol font, so we substitute an emoji glyph.
        Text("🔔", style = TextStyle(fontSize = if (compact) 20.sp else 24.sp))
        Spacer(GlanceModifier.height(4.dp))
        Text(
            text = if (compact) "Outliers" else "Open WagerProof to load today's outliers",
            style = TextStyle(
                color = ColorProvider(WidgetTheme.textSecondary),
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
            ),
        )
    }
}

@Composable
private fun SmallOutlier(alert: OutlierAlertForWidget) {
    Column(modifier = GlanceModifier.fillMaxSize()) {
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SportBadge(alert.sport)
            Spacer(GlanceModifier.defaultWeight())
            // FIDELITY-WAIVER #211: kind glyph (bolt.fill / chart.line) → emoji.
            Text(
                text = if (alert.kind == OutlierAlertForWidget.Kind.FADE) "⚡" else "📈",
                style = TextStyle(fontSize = 11.sp),
            )
        }
        Spacer(GlanceModifier.defaultWeight())
        Text(
            alert.matchup(),
            style = TextStyle(color = ColorProvider(WidgetTheme.textMuted), fontSize = 10.sp),
            maxLines = 1,
        )
        Text(
            alert.displayLabel(),
            style = TextStyle(
                color = ColorProvider(WidgetTheme.textPrimary),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
            ),
            maxLines = 2,
        )
        Text(
            alert.confidenceDisplay(),
            style = TextStyle(
                color = ColorProvider(WidgetTheme.accent),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
    }
}

@Composable
private fun OutliersList(alerts: List<OutlierAlertForWidget>) {
    Column(modifier = GlanceModifier.fillMaxSize()) {
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Top Outliers",
                style = TextStyle(
                    color = ColorProvider(WidgetTheme.textPrimary),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                ),
            )
            Spacer(GlanceModifier.defaultWeight())
            Text(
                "WagerProof",
                style = TextStyle(color = ColorProvider(WidgetTheme.textMuted), fontSize = 10.sp),
            )
        }
        Spacer(GlanceModifier.height(8.dp))
        alerts.forEach { alert ->
            OutlierRow(alert)
            Spacer(GlanceModifier.height(6.dp))
        }
    }
}

@Composable
private fun OutlierRow(alert: OutlierAlertForWidget) {
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(WidgetTheme.card)
            .cornerRadius(8.dp)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SportBadge(alert.sport)
        Spacer(GlanceModifier.width(8.dp))
        Column(modifier = GlanceModifier.defaultWeight()) {
            Text(
                alert.matchup(),
                style = TextStyle(color = ColorProvider(WidgetTheme.textMuted), fontSize = 9.sp),
                maxLines = 1,
            )
            Text(
                alert.displayLabel(),
                style = TextStyle(
                    color = ColorProvider(WidgetTheme.textPrimary),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                ),
                maxLines = 1,
            )
        }
        Spacer(GlanceModifier.width(8.dp))
        Text(
            alert.confidenceDisplay(),
            style = TextStyle(
                color = ColorProvider(WidgetTheme.accent),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
    }
}

@Composable
private fun SportBadge(sport: String) {
    Text(
        text = sport.uppercase(),
        style = TextStyle(
            color = ColorProvider(androidx.compose.ui.graphics.Color.White),
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
        ),
        modifier = GlanceModifier
            .background(WidgetTheme.sportBadge(sport))
            .cornerRadius(4.dp)
            .padding(horizontal = 6.dp, vertical = 3.dp),
    )
}

// MARK: - Display helpers (mirror of iOS `OutlierAlertForWidget` extension)

private fun OutlierAlertForWidget.matchup(): String = "$awayTeam @ $homeTeam"

/**
 * Fade alerts store the model's *favored* side; the recommendation is the
 * opposite. Value alerts use `side` as-is.
 */
private fun OutlierAlertForWidget.displaySide(): String {
    if (kind != OutlierAlertForWidget.Kind.FADE) return side
    return if (marketType == "Total") {
        if (side == "Over") "Under" else "Over"
    } else {
        if (side == awayTeam) homeTeam else awayTeam
    }
}

private fun OutlierAlertForWidget.displayLabel(): String =
    if (kind == OutlierAlertForWidget.Kind.FADE) "Fade to ${displaySide()}" else "${displaySide()} value"

/**
 * NFL fade alerts are probability-based (0-100%); other-sport fades are
 * point-deltas. Value alerts are always a market percentage.
 */
private fun OutlierAlertForWidget.confidenceDisplay(): String {
    if (kind == OutlierAlertForWidget.Kind.VALUE) return "$confidence%"
    return if (sport.lowercase() == "nfl") "$confidence%" else "${confidence}pt"
}
