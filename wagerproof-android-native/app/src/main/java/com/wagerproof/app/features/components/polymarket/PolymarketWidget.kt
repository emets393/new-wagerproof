package com.wagerproof.app.features.components.polymarket

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.wagerproof.app.features.gamecards.TeamColorPair
import com.wagerproof.app.features.gamecards.teamVisible
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.PolymarketGameMarkets
import com.wagerproof.core.models.PolymarketMarket
import com.wagerproof.core.models.PolymarketMarketType
import com.wagerproof.core.services.PolymarketService
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt

/**
 * Full market-odds widget for every game sheet — port of iOS
 * `Polymarket/PolymarketWidget.swift`. One fetch loads all three markets; the
 * toggle re-slices. "Spread" reads "Run Line" for MLB.
 */
@Composable
fun PolymarketWidget(
    league: String,
    awayTeam: String,
    homeTeam: String,
    awayColors: TeamColorPair,
    homeColors: TeamColorPair,
    awayAbbr: String,
    homeAbbr: String,
    modifier: Modifier = Modifier,
) {
    var markets by remember(league, awayTeam, homeTeam) { mutableStateOf<PolymarketGameMarkets?>(null) }
    var loaded by remember(league, awayTeam, homeTeam) { mutableStateOf(false) }
    var selected by remember(league, awayTeam, homeTeam) { mutableStateOf(PolymarketMarketType.MONEYLINE) }

    LaunchedEffect(league, awayTeam, homeTeam) {
        markets = PolymarketService.shared.markets(league, awayTeam, homeTeam)
        loaded = true
    }

    val available = markets?.markets?.keys?.toList().orEmpty()
    if (selected !in available) available.firstOrNull()?.let { selected = it }
    val market = markets?.markets?.get(selected)

    Column(modifier.fillMaxWidth()) {
        when {
            !loaded -> Column(Modifier.shimmering(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SkeletonBlock(height = 28.dp, width = 200.dp, cornerRadius = 14.dp)
                Row { SkeletonBlock(height = 60.dp); Spacer(Modifier.width(10.dp)); SkeletonBlock(height = 60.dp) }
                SkeletonBlock(height = 170.dp, cornerRadius = 16.dp)
            }
            available.isEmpty() -> Text("No market odds yet", color = AppColors.appTextMuted, fontSize = 13.sp)
            else -> {
                MarketToggle(available, selected, league) { selected = it }
                Spacer(Modifier.height(12.dp))
                market?.let {
                    OddsRow(it, selected, awayColors, homeColors, awayAbbr, homeAbbr)
                    Spacer(Modifier.height(12.dp))
                    PolymarketChartCard(it, selected, awayColors, homeColors, awayTeam, homeTeam)
                }
            }
        }
    }
}

@Composable
private fun MarketToggle(
    available: List<PolymarketMarketType>,
    selected: PolymarketMarketType,
    league: String,
    onSelect: (PolymarketMarketType) -> Unit,
) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
        available.forEach { type ->
            val label = if (type == PolymarketMarketType.SPREAD && league.lowercase() == "mlb") "Run Line" else type.displayLabel
            val active = type == selected
            Box(
                Modifier
                    .clip(CircleShape)
                    .background(if (active) AppColors.appPrimary.copy(alpha = 0.20f) else Color.White.copy(alpha = 0.08f))
                    .border(1.dp, if (active) AppColors.appPrimary else Color.White.copy(alpha = 0.10f), CircleShape)
                    .clickable { onSelect(type) }
                    .padding(horizontal = 14.dp, vertical = 7.dp),
            ) {
                Text(label, color = if (active) AppColors.appPrimary else Color.White.copy(alpha = 0.60f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun OddsRow(
    market: PolymarketMarket,
    type: PolymarketMarketType,
    awayColors: TeamColorPair,
    homeColors: TeamColorPair,
    awayAbbr: String,
    homeAbbr: String,
) {
    val history = market.priceHistory
    val chartHistory = history.takeLast(60)
    // The Polymarket contract mirrors iOS: current_*_odds are percentage
    // points (67), while price_history.p is a 0...1 fraction (0.67). Keep the
    // UI boundary wholly in percentage points. The previous implementation
    // multiplied a whole percentage by 100 and subtracted a fractional point,
    // producing 6700% and +6622%.
    val awayNow = market.currentAwayOdds?.asPolymarketPercent()
        ?: chartHistory.lastOrNull()?.p?.asPolymarketPercent()
    val homeNow = market.currentHomeOdds?.asPolymarketPercent()
        ?: chartHistory.lastOrNull()?.p?.let { 100.0 - it.asPolymarketPercent() }
    val awayDelta = polymarketMovementPercent(chartHistory)

    val (awayTint, homeTint) = if (type == PolymarketMarketType.TOTAL) {
        AppColors.appWin to AppColors.appLoss
    } else {
        awayColors.primary.teamVisible(0.6f) to homeColors.primary.teamVisible(0.6f)
    }
    val awayLabel = if (type == PolymarketMarketType.TOTAL) "Over" else awayAbbr
    val homeLabel = if (type == PolymarketMarketType.TOTAL) "Under" else homeAbbr

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        OddsCard(awayLabel, awayNow, awayDelta, awayTint, Modifier.weight(1f))
        OddsCard(homeLabel, homeNow, awayDelta?.let { -it }, homeTint, Modifier.weight(1f))
    }
}

@Composable
private fun OddsCard(label: String, odds: Double?, delta: Double?, tint: Color, modifier: Modifier = Modifier) {
    Column(
        modifier
            .clip(RoundedCornerShape(12.dp))
            .background(tint.copy(alpha = 0.12f))
            .border(1.dp, tint.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
            .padding(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(6.dp).clip(CircleShape).background(tint))
            Spacer(Modifier.width(6.dp))
            Text(label, color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        }
        Spacer(Modifier.height(6.dp))
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                odds?.let { "${it.roundToInt()}%" } ?: "—",
                color = AppColors.appTextPrimary,
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
            )
            delta?.takeIf { abs(it) >= 1 }?.let {
                Text(
                    "${if (it > 0) "↗ +" else "↘ "}${it.roundToInt()}%",
                    color = if (it > 0) AppColors.appWin else AppColors.appLoss,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

/** Accept either the service's whole-percent values or fractional history. */
internal fun Double.asPolymarketPercent(): Double = if (abs(this) <= 1.0) this * 100.0 else this

/** iOS shows movement over the visible 60-point chart window, not one tick. */
internal fun polymarketMovementPercent(history: List<com.wagerproof.core.models.PolymarketPricePoint>): Double? {
    if (history.size < 2) return null
    val series = history.takeLast(60)
    return series.last().p.asPolymarketPercent() - series.first().p.asPolymarketPercent()
}

@Composable
private fun PolymarketChartCard(
    market: PolymarketMarket,
    type: PolymarketMarketType,
    awayColors: TeamColorPair,
    homeColors: TeamColorPair,
    awayTeam: String,
    homeTeam: String,
) {
    val points = market.priceHistory.takeLast(60)
    val shape = RoundedCornerShape(16.dp)
    Box(
        Modifier
            .fillMaxWidth()
            .height(198.dp)
            .liquidGlassBackground(shape)
            .clip(shape)
            .background(Color(0xFF0F131C).copy(alpha = 0.5f))
            .border(1.dp, Color.White.copy(alpha = 0.08f), shape)
            .padding(14.dp),
    ) {
        if (points.size < 2) {
            Column(
                modifier = Modifier.align(Alignment.Center),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text("⌁", color = AppColors.appTextMuted, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                Text(
                    "Not enough price history yet",
                    color = AppColors.appTextMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        } else {
            val awayTint = if (type == PolymarketMarketType.TOTAL) AppColors.appWin else awayColors.primary.teamVisible(0.72f)
            val homeTint = if (type == PolymarketMarketType.TOTAL) AppColors.appLoss else homeColors.primary.teamVisible(0.72f)
            PolymarketAxesChart(
                points = points,
                awayTint = awayTint,
                homeTint = homeTint,
                modifier = Modifier.fillMaxWidth().height(170.dp),
            )
            Row(Modifier.align(Alignment.TopEnd), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LegendDot(if (type == PolymarketMarketType.TOTAL) "Over" else awayTeam, awayTint)
                LegendDot(if (type == PolymarketMarketType.TOTAL) "Under" else homeTeam, homeTint)
            }
        }
    }
}

internal data class PolymarketChartScale(
    val lower: Float,
    val upper: Float,
    val ticks: List<Float>,
)

/** iOS derives its zoomed Y domain from both complementary probability lines. */
internal fun polymarketChartScale(
    points: List<com.wagerproof.core.models.PolymarketPricePoint>,
): PolymarketChartScale {
    val values = points.flatMap { point ->
        val away = point.p.asPolymarketPercent().toFloat().coerceIn(0f, 100f)
        listOf(away, 100f - away)
    }
    if (values.isEmpty()) return PolymarketChartScale(0f, 100f, listOf(0f, 25f, 50f, 75f, 100f))

    val minValue = values.min()
    val maxValue = values.max()
    val padding = max(4f, (maxValue - minValue) * 0.15f)
    val paddedLower = (minValue - padding).coerceAtLeast(0f)
    val paddedUpper = (maxValue + padding).coerceAtMost(100f)
    val step = niceChartStep(((paddedUpper - paddedLower) / 4f).coerceAtLeast(1f))
    val lower = (floor(paddedLower / step) * step).coerceAtLeast(0f)
    val upper = (ceil(paddedUpper / step) * step).coerceAtMost(100f).coerceAtLeast(lower + step)
    val ticks = buildList {
        var value = lower
        while (value <= upper + 0.001f) {
            add(value)
            value += step
        }
    }
    return PolymarketChartScale(lower, upper, ticks)
}

private fun niceChartStep(raw: Float): Float {
    val base = 10f.pow(floor(log10(raw.toDouble())).toFloat())
    val fraction = raw / base
    val niceFraction = when {
        fraction <= 1f -> 1f
        fraction <= 2f -> 2f
        fraction <= 5f -> 5f
        else -> 10f
    }
    return niceFraction * base
}

@Composable
private fun PolymarketAxesChart(
    points: List<com.wagerproof.core.models.PolymarketPricePoint>,
    awayTint: Color,
    homeTint: Color,
    modifier: Modifier = Modifier,
) {
    val scale = polymarketChartScale(points)
    val away = points.map { it.p.asPolymarketPercent().toFloat().coerceIn(0f, 100f) }
    val home = away.map { 100f - it }
    val grid = AppColors.appBorder
    val label = AppColors.appTextMuted

    Canvas(modifier) {
        // These gutters mirror the space Swift Charts reserves around its plot.
        val plotLeft = 38.dp.toPx()
        val plotRight = size.width - 8.dp.toPx()
        val plotTop = 24.dp.toPx()
        val plotBottom = size.height - 24.dp.toPx()
        val plotWidth = (plotRight - plotLeft).coerceAtLeast(1f)
        val plotHeight = (plotBottom - plotTop).coerceAtLeast(1f)
        val range = (scale.upper - scale.lower).coerceAtLeast(1f)
        fun x(index: Int): Float = plotLeft + plotWidth * index / (away.size - 1).coerceAtLeast(1)
        fun y(value: Float): Float = plotBottom - plotHeight * (value - scale.lower) / range

        val yLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = label.toArgb()
            textSize = 10.sp.toPx()
            textAlign = Paint.Align.RIGHT
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        }
        val xLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = label.toArgb()
            textSize = 10.sp.toPx()
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        }

        scale.ticks.forEach { tick ->
            val tickY = y(tick)
            drawLine(
                color = grid.copy(alpha = 0.20f),
                start = androidx.compose.ui.geometry.Offset(plotLeft, tickY),
                end = androidx.compose.ui.geometry.Offset(plotRight, tickY),
                strokeWidth = 1.dp.toPx(),
            )
            drawContext.canvas.nativeCanvas.drawText(
                "${tick.roundToInt()}%",
                plotLeft - 6.dp.toPx(),
                tickY - (yLabelPaint.ascent() + yLabelPaint.descent()) / 2f,
                yLabelPaint,
            )
        }

        listOf(plotLeft, plotRight).forEach { tickX ->
            drawLine(
                color = grid.copy(alpha = 0.25f),
                start = androidx.compose.ui.geometry.Offset(tickX, plotTop),
                end = androidx.compose.ui.geometry.Offset(tickX, plotBottom),
                strokeWidth = 1.dp.toPx(),
            )
        }
        xLabelPaint.textAlign = Paint.Align.LEFT
        drawContext.canvas.nativeCanvas.drawText("Start", plotLeft, size.height - 2.dp.toPx(), xLabelPaint)
        xLabelPaint.textAlign = Paint.Align.RIGHT
        drawContext.canvas.nativeCanvas.drawText("Now", plotRight, size.height - 2.dp.toPx(), xLabelPaint)

        fun monotonePath(values: List<Float>): Path = Path().apply {
            moveTo(x(0), y(values.first()))
            for (index in 1..values.lastIndex) {
                val previousX = x(index - 1)
                val currentX = x(index)
                val midpoint = (previousX + currentX) / 2f
                cubicTo(midpoint, y(values[index - 1]), midpoint, y(values[index]), currentX, y(values[index]))
            }
        }
        clipRect(plotLeft, plotTop, plotRight, plotBottom) {
            val stroke = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
            drawPath(monotonePath(away), awayTint, style = stroke)
            drawPath(monotonePath(home), homeTint, style = stroke)
        }
    }
}

@Composable
private fun LegendDot(label: String, tint: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(5.dp).clip(CircleShape).background(tint))
        Spacer(Modifier.width(3.dp))
        Text(label, color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
    }
}
