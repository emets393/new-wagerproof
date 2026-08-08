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
import androidx.glance.appwidget.GlanceAppWidgetManager
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
import com.wagerproof.core.models.OutliersWidgetItem
import com.wagerproof.core.models.OutliersWidgetMarketData
import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.shared.AppGroupKey
import com.wagerproof.core.shared.WidgetPayloadStore

/**
 * "Top Outliers" home-screen widget — Glance port of iOS `TopOutliersWidget`.
 *
 * Each widget instance follows one cached Outliers market (Parlay God,
 * moneyline, totals, props, and so on) selected by the configuration Activity.
 * Legacy value/fade alerts remain a backwards-compatible fallback for payloads
 * written before `outlierMarkets` shipped. No in-widget network fetch — same
 * reasoning as iOS: keep the widget process light and off the authenticated
 * Supabase path. Empty cache → "open the app" placeholder. Tap →
 * `wagerproof://outliers` deep link.
 */
class TopOutliersGlanceWidget : GlanceAppWidget() {

    override val sizeMode: SizeMode = SizeMode.Responsive(WidgetSizes.ALL)

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        // Widgets run in the app process, but a widget update can spin the
        // process up before any Activity — make the prefs container safe to read.
        AppGroup.initialize(context)
        val payload = WidgetPayloadStore.read()
        val appWidgetId = runCatching {
            GlanceAppWidgetManager(context).getAppWidgetId(id)
        }.getOrNull()
        val selectedMarketId = appWidgetId?.let {
            TopOutliersWidgetPreferences.selectedMarketId(context, it)
        }
        val isPro = AppGroup.prefs.getBoolean(AppGroupKey.PRO_ENTITLEMENT_GRANTED, false)
        val visibleMarkets = payload.outlierMarkets.filter { market ->
            isPro || market.id != "parlay-god"
        }
        provideContent {
            TopOutliersContent(
                alerts = payload.topOutliers,
                markets = visibleMarkets,
                marketsVersion = payload.outlierMarketsVersion,
                selectedMarketId = selectedMarketId,
            )
        }
    }

    override suspend fun onDelete(context: Context, glanceId: GlanceId) {
        runCatching {
            GlanceAppWidgetManager(context).getAppWidgetId(glanceId)
        }.getOrNull()?.let { appWidgetId ->
            TopOutliersWidgetPreferences.clear(context, appWidgetId)
        }
        super.onDelete(context, glanceId)
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
private fun TopOutliersContent(
    alerts: List<OutlierAlertForWidget>,
    markets: List<OutliersWidgetMarketData>,
    marketsVersion: Int,
    selectedMarketId: String?,
) {
    val family = currentFamily()
    val selectedMarket = resolveOutliersWidgetMarket(markets, selectedMarketId)
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetTheme.background)
            .padding(12.dp)
            .clickable(actionStartActivity(outliersDeepLink(androidx.glance.LocalContext.current))),
        contentAlignment = Alignment.TopStart,
    ) {
        when {
            selectedMarket != null && selectedMarket.items.isNotEmpty() -> when (family) {
                WidgetFamily.SMALL -> SmallMarketOutlier(selectedMarket)
                WidgetFamily.LARGE -> MarketOutliersList(selectedMarket, rowLimit = 5)
                WidgetFamily.MEDIUM -> MarketOutliersList(selectedMarket, rowLimit = 2)
            }
            marketsVersion > 0 -> EmptyOutliers(compact = family == WidgetFamily.SMALL)
            alerts.isEmpty() -> EmptyOutliers(compact = family == WidgetFamily.SMALL)
            family == WidgetFamily.SMALL -> SmallOutlier(alerts.first())
            family == WidgetFamily.LARGE -> OutliersList(alerts.take(5))
            else -> OutliersList(alerts.take(2))
        }
    }
}

/**
 * A missing explicit selection is an empty state, not permission to switch the
 * widget to an unrelated market. Null is reserved for pre-configuration/default
 * instances and may follow the first currently available market.
 */
internal fun resolveOutliersWidgetMarket(
    markets: List<OutliersWidgetMarketData>,
    selectedMarketId: String?,
): OutliersWidgetMarketData? =
    if (selectedMarketId == null) markets.firstOrNull()
    else markets.firstOrNull { it.id == selectedMarketId }

@Composable
private fun SmallMarketOutlier(market: OutliersWidgetMarketData) {
    val item = market.items.first()
    Column(modifier = GlanceModifier.fillMaxSize()) {
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(marketGlyph(market.symbolName), style = TextStyle(fontSize = 12.sp))
            Spacer(GlanceModifier.width(4.dp))
            Text(
                market.title,
                style = TextStyle(
                    color = ColorProvider(WidgetTheme.textMuted),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                ),
                maxLines = 1,
            )
        }
        Spacer(GlanceModifier.defaultWeight())
        Text(
            item.matchup,
            style = TextStyle(color = ColorProvider(WidgetTheme.textMuted), fontSize = 9.sp),
            maxLines = 1,
        )
        Text(
            item.selection,
            style = TextStyle(
                color = ColorProvider(WidgetTheme.textPrimary),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            ),
            maxLines = 2,
        )
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                item.fractionText,
                style = TextStyle(
                    color = ColorProvider(WidgetTheme.accent),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                ),
            )
            item.oddsText?.let { odds ->
                Spacer(GlanceModifier.width(6.dp))
                Text(
                    odds,
                    style = TextStyle(color = ColorProvider(WidgetTheme.textSecondary), fontSize = 10.sp),
                )
            }
        }
    }
}

@Composable
private fun MarketOutliersList(market: OutliersWidgetMarketData, rowLimit: Int) {
    val visibleItems = market.items.take(rowLimit)
    val remainingCount = (market.totalCount - visibleItems.size).coerceAtLeast(0)
    Column(modifier = GlanceModifier.fillMaxSize()) {
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = GlanceModifier
                    .width(26.dp)
                    .height(26.dp)
                    .background(WidgetTheme.accent)
                    .cornerRadius(8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    marketGlyph(market.symbolName),
                    style = TextStyle(color = ColorProvider(WidgetTheme.background), fontSize = 12.sp),
                )
            }
            Spacer(GlanceModifier.width(8.dp))
            Column {
                Text(
                    market.title,
                    style = TextStyle(
                        color = ColorProvider(WidgetTheme.textPrimary),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                    maxLines = 1,
                )
                Text(
                    "TOP STREAKS",
                    style = TextStyle(
                        color = ColorProvider(WidgetTheme.textMuted),
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                )
            }
            Spacer(GlanceModifier.defaultWeight())
            Text(
                "☷",
                style = TextStyle(color = ColorProvider(WidgetTheme.textMuted), fontSize = 11.sp),
            )
        }
        Spacer(GlanceModifier.height(8.dp))
        visibleItems.forEachIndexed { index, item ->
            MarketOutlierRow(
                item = item,
                rank = index + 1,
                isTop = index == 0,
            )
            Spacer(GlanceModifier.height(6.dp))
        }
        if (rowLimit > 2) {
            Spacer(GlanceModifier.defaultWeight())
            Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (remainingCount > 0) "+$remainingCount more in ${market.title}" else "Every qualifying streak",
                    style = TextStyle(
                        color = ColorProvider(WidgetTheme.textMuted),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Medium,
                    ),
                    maxLines = 1,
                )
                Spacer(GlanceModifier.defaultWeight())
                Text(
                    "WAGERPROOF",
                    style = TextStyle(
                        color = ColorProvider(WidgetTheme.textMuted),
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                )
            }
        }
    }
}

@Composable
private fun MarketOutlierRow(item: OutliersWidgetItem, rank: Int, isTop: Boolean) {
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(if (isTop) WidgetTheme.accent.copy(alpha = 0.09f) else WidgetTheme.card)
            .cornerRadius(8.dp)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = GlanceModifier
                .width(20.dp)
                .height(20.dp)
                .background(if (isTop) WidgetTheme.accent else WidgetTheme.card)
                .cornerRadius(10.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "$rank",
                style = TextStyle(
                    color = ColorProvider(if (isTop) WidgetTheme.background else WidgetTheme.textMuted),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                ),
            )
        }
        Spacer(GlanceModifier.width(7.dp))
        SportBadge(item.sport)
        Spacer(GlanceModifier.width(8.dp))
        Column(modifier = GlanceModifier.defaultWeight()) {
            Text(
                item.subject,
                style = TextStyle(
                    color = ColorProvider(WidgetTheme.textPrimary),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                ),
                maxLines = 1,
            )
            Text(
                "${item.selection} · ${item.matchup}",
                style = TextStyle(
                    color = ColorProvider(WidgetTheme.textSecondary),
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Medium,
                ),
                maxLines = 1,
            )
        }
        Spacer(GlanceModifier.width(8.dp))
        Column(horizontalAlignment = Alignment.End) {
            Text(
                item.fractionText,
                style = TextStyle(
                    color = ColorProvider(if (isTop) WidgetTheme.accent else WidgetTheme.textPrimary),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                ),
            )
            val detail = listOfNotNull(
                item.oddsText?.takeIf(String::isNotBlank),
                item.additionalTrendCount.takeIf { it > 0 }?.let { "+$it more" },
            ).joinToString("  ")
            if (detail.isNotEmpty()) {
                Text(
                    detail,
                    style = TextStyle(
                        color = ColorProvider(WidgetTheme.textSecondary),
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                    maxLines = 1,
                )
            }
        }
    }
}

/** SF Symbols arrive in the shared payload as semantic keys; Glance uses text glyphs. */
private fun marketGlyph(symbolName: String): String = when (symbolName) {
    "bolt.fill" -> "⚡"
    "dollarsign.circle.fill" -> "$"
    "arrow.left.and.right" -> "↔"
    "sum" -> "Σ"
    "5.circle.fill" -> "⑤"
    "figure.run", "figure.run.circle.fill" -> "●"
    "paperplane.fill", "paperplane" -> "➤"
    "trophy.fill" -> "★"
    else -> "↗"
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
