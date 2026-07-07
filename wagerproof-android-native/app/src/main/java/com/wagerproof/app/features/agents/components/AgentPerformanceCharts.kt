package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentBetItem
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.AgentSport
import java.util.Locale

/**
 * Native port of iOS `AgentPerformanceCharts`. Renders cumulative-units line
 * chart(s) for an agent — one overall + one per sport. Cumulative units is
 * computed client-side from each item's `netUnitsContribution` (Formula B, same
 * as the agent-performance recalc RPC); every settled parlay contributes exactly
 * one point (its ticket-level payout), never per leg.
 *
 * Charts are hand-drawn on Compose Canvas (FIDELITY-WAIVER #205) instead of the
 * iOS `Charts` framework.
 */

// One point on a cumulative curve.
private data class ChartPoint(val index: Int, val cumulative: Double)

private data class SportStats(
    val sport: AgentSport?,
    val label: String,
    val wins: Int,
    val losses: Int,
    val pushes: Int,
    val netUnits: Double,
    val points: List<ChartPoint>,
)

@Composable
fun AgentPerformanceCharts(
    items: List<AgentBetItem>,
    preferredSports: List<AgentSport>,
    // Kept for API parity with iOS; the line color is win/loss-driven, not agent-driven.
    agentColor: Color,
    showsTitle: Boolean = true,
) {
    val settledItems = remember(items) {
        items.filter {
            it.result == AgentPick.PickResultStatus.WON ||
                it.result == AgentPick.PickResultStatus.LOST ||
                it.result == AgentPick.PickResultStatus.PUSH
        }.sortedBy { it.createdAt }
    }

    val overallStats = remember(settledItems) { compute("Overall", settledItems, null) }
    val sportStats = remember(settledItems, preferredSports) {
        // Multi-sport parlays (sportForFilter == null) count in Overall only.
        preferredSports.mapNotNull { sport ->
            val scoped = settledItems.filter { it.sportForFilter == sport }
            if (scoped.size >= 2) compute(sport.label, scoped, sport) else null
        }
    }

    val textMeasurer = rememberTextMeasurer()

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (overallStats.points.size < 3) {
            EmptyState()
        } else {
            if (showsTitle) {
                Text(
                    "Performance",
                    color = AppColors.appTextPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                )
            }
            OverallCard(overallStats, textMeasurer)
            if (sportStats.size > 1) {
                Text(
                    "By Sport",
                    color = AppColors.appTextPrimary,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 4.dp),
                )
                sportStats.forEach { SportCard(it, textMeasurer) }
            }
        }
    }
}

// MARK: - Cards

@Composable
private fun EmptyState() {
    Column(
        modifier = Modifier.fillMaxWidth().glassCard().padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            agentSymbol("chart.line.uptrend.xyaxis"),
            contentDescription = null,
            tint = AppColors.appTextSecondary,
            modifier = Modifier.size(32.dp),
        )
        Text(
            "Performance charts will appear after picks are graded",
            color = AppColors.appTextSecondary,
            fontSize = 13.sp,
        )
    }
}

@Composable
private fun OverallCard(stats: SportStats, textMeasurer: TextMeasurer) {
    val accent = if (stats.netUnits >= 0) AppColors.appWin else AppColors.appLoss
    Column(
        modifier = Modifier.fillMaxWidth().glassCard().padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Cumulative Units",
                color = AppColors.appTextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            Text(
                unitsLabel(stats.netUnits),
                color = accent,
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
            )
        }
        CumulativeLineChart(
            points = stats.points,
            color = accent,
            height = 180.dp,
            showXAxis = true,
            showYAxis = true,
            fillArea = true,
            yFormat = { String.format(Locale.US, "%+.1f", it) },
            textMeasurer = textMeasurer,
        )
    }
}

@Composable
private fun SportCard(stats: SportStats, textMeasurer: TextMeasurer) {
    val accent = if (stats.netUnits >= 0) AppColors.appWin else AppColors.appLoss
    Column(
        modifier = Modifier.fillMaxWidth().glassCard().padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                stats.label,
                color = AppColors.appTextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            val record = "${stats.wins}-${stats.losses}" + if (stats.pushes > 0) "-${stats.pushes}" else ""
            Text(
                record,
                color = AppColors.appTextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.width(8.dp))
            Text(
                unitsLabel(stats.netUnits),
                color = accent,
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
            )
        }
        if (stats.points.size > 1) {
            CumulativeLineChart(
                points = stats.points,
                color = accent,
                height = 110.dp,
                showXAxis = false,
                showYAxis = true,
                fillArea = false,
                yFormat = { String.format(Locale.US, "%+.0f", it) },
                textMeasurer = textMeasurer,
            )
        } else {
            Text(
                "No graded picks yet",
                color = AppColors.appTextSecondary,
                fontSize = 12.sp,
                modifier = Modifier.fillMaxWidth().height(60.dp),
            )
        }
    }
}

// MARK: - Canvas line chart

@Composable
private fun CumulativeLineChart(
    points: List<ChartPoint>,
    color: Color,
    height: Dp,
    showXAxis: Boolean,
    showYAxis: Boolean,
    fillArea: Boolean,
    yFormat: (Double) -> String,
    textMeasurer: TextMeasurer,
) {
    val labelStyle = TextStyle(color = AppColors.appTextSecondary, fontSize = 10.sp)
    Canvas(Modifier.fillMaxWidth().height(height)) {
        if (points.isEmpty()) return@Canvas

        val leftPad = if (showYAxis) 40f else 8f
        val bottomPad = if (showXAxis) 20f else 8f
        val topPad = 8f
        val rightPad = 8f
        val plotW = size.width - leftPad - rightPad
        val plotH = size.height - topPad - bottomPad
        if (plotW <= 0 || plotH <= 0) return@Canvas

        val minIndex = points.first().index
        val maxIndex = points.last().index
        val idxSpan = (maxIndex - minIndex).coerceAtLeast(1).toFloat()

        var minY = points.minOf { it.cumulative }
        var maxY = points.maxOf { it.cumulative }
        if (minY == maxY) { minY -= 1.0; maxY += 1.0 }
        val ySpan = (maxY - minY)

        fun px(i: Int) = leftPad + (i - minIndex) / idxSpan * plotW
        fun py(v: Double) = topPad + (1f - ((v - minY) / ySpan).toFloat()) * plotH

        // Horizontal gridlines + Y labels (~4 ticks).
        val ticks = 4
        for (t in 0..ticks) {
            val v = minY + ySpan * t / ticks
            val y = py(v)
            drawLine(
                AppColors.appBorder.copy(alpha = 0.3f),
                Offset(leftPad, y),
                Offset(size.width - rightPad, y),
                strokeWidth = 1f,
            )
            if (showYAxis) {
                val layout = textMeasurer.measure(yFormat(v), labelStyle)
                drawText(layout, topLeft = Offset(2f, y - layout.size.height / 2f))
            }
        }

        val offsets = points.map { Offset(px(it.index), py(it.cumulative)) }

        // Area fill under the curve.
        if (fillArea && offsets.size > 1) {
            val baseline = topPad + plotH
            val area = smoothPath(offsets).apply {
                lineTo(offsets.last().x, baseline)
                lineTo(offsets.first().x, baseline)
                close()
            }
            drawPath(
                area,
                brush = Brush.verticalGradient(
                    colors = listOf(color.copy(alpha = 0.2f), Color.Transparent),
                    startY = topPad,
                    endY = baseline,
                ),
            )
        }

        // The line.
        if (offsets.size > 1) {
            drawPath(
                smoothPath(offsets),
                color = color,
                style = Stroke(width = 2f * density),
            )
        }

        // X labels: "Start" at first, "Now" at last.
        if (showXAxis) {
            val startLayout = textMeasurer.measure("Start", labelStyle)
            drawText(startLayout, topLeft = Offset(leftPad, size.height - bottomPad + 4f))
            val nowLayout = textMeasurer.measure("Now", labelStyle)
            drawText(
                nowLayout,
                topLeft = Offset(size.width - rightPad - nowLayout.size.width, size.height - bottomPad + 4f),
            )
        }
    }
}

/** Smooth (monotone-ish) path through the offsets via quadratic segments. */
private fun smoothPath(pts: List<Offset>): Path {
    val path = Path()
    if (pts.isEmpty()) return path
    path.moveTo(pts.first().x, pts.first().y)
    for (i in 1 until pts.size) {
        val prev = pts[i - 1]
        val cur = pts[i]
        val midX = (prev.x + cur.x) / 2f
        val midY = (prev.y + cur.y) / 2f
        path.quadraticBezierTo(prev.x, prev.y, midX, midY)
    }
    path.lineTo(pts.last().x, pts.last().y)
    return path
}

// MARK: - Stats compute

/** Cumulative-units series via Formula B (matches recalculate_avatar_performance). */
private fun compute(label: String, items: List<AgentBetItem>, sport: AgentSport?): SportStats {
    var cumulative = 0.0
    val points = mutableListOf(ChartPoint(index = 0, cumulative = 0.0))
    var wins = 0
    var losses = 0
    var pushes = 0

    items.forEachIndexed { idx, item ->
        when (item.result) {
            AgentPick.PickResultStatus.WON -> wins++
            AgentPick.PickResultStatus.LOST -> losses++
            AgentPick.PickResultStatus.PUSH -> pushes++
            AgentPick.PickResultStatus.PENDING -> return@forEachIndexed
        }
        cumulative += item.netUnitsContribution
        points.add(ChartPoint(index = idx + 1, cumulative = cumulative))
    }

    return SportStats(
        sport = sport,
        label = label,
        wins = wins,
        losses = losses,
        pushes = pushes,
        netUnits = cumulative,
        points = points,
    )
}

private fun unitsLabel(n: Double): String {
    val sign = if (n >= 0) "+" else ""
    return String.format(Locale.US, "%s%.2fu", sign, n)
}

/**
 * Translucent glass chrome for the chart tiles. The iOS `.ultraThinMaterial`
 * blur isn't reproduced here (FIDELITY-WAIVER #301) — a dark tint + faint white
 * hairline stands in so the agent aura still reads through.
 */
private fun Modifier.glassCard(corner: Dp = 16.dp): Modifier = this
    .clip(RoundedCornerShape(corner))
    .background(Color(0xFF0F131C).copy(alpha = 0.5f))
    .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(corner))

/**
 * Loading placeholder mirroring the overall card footprint (title row + 180dp
 * chart area inside the same glass chrome) so the swap to the real chart never
 * jumps the layout.
 */
@Composable
fun AgentPerformanceChartSkeleton() {
    Column(
        modifier = Modifier.fillMaxWidth().glassCard().padding(14.dp).shimmering(),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SkeletonBlock(width = 130.dp, height = 15.dp)
            Spacer(Modifier.weight(1f))
            SkeletonBlock(width = 64.dp, height = 13.dp)
        }
        SkeletonBlock(height = 180.dp, cornerRadius = 12.dp, modifier = Modifier.fillMaxWidth())
    }
}
