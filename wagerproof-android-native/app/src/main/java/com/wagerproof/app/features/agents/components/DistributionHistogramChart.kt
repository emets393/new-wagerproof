package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.toSize
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.CurvePoint
import com.wagerproof.core.models.DistributionBucket
import com.wagerproof.core.models.NormalFit
import com.wagerproof.core.models.StatMetric
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Native port of iOS `DistributionHistogramChart`: a win-rate (or net-units)
 * histogram with a fitted normal (bell) curve laid over it, plus mean and
 * break-even reference lines. Axis is SHARE (% of agents), never raw counts.
 * Tapping a bar calls [onSelectBin]. An estimated fit draws its curve dashed/grey.
 *
 * Hand-drawn on Compose Canvas (FIDELITY-WAIVER #205) instead of iOS `Charts`.
 */

// Break-even win rate at standard -110 juice (52.38%).
private const val BREAK_EVEN = 0.5238

// Plot insets (dp) — shared by the Canvas draw and the tap hit-test.
private val LEFT_PAD = 34.dp
private val RIGHT_PAD = 8.dp
private val TOP_PAD = 16.dp
private val BOTTOM_PAD = 18.dp

@Composable
fun DistributionHistogramChart(
    buckets: List<DistributionBucket>,
    curve: List<CurvePoint>,
    fit: NormalFit?,
    domain: ClosedFloatingPointRange<Double>,
    metric: StatMetric,
    accent: Color = AppColors.appAccentBlue,
    height: Dp = 220.dp,
    showReferenceLines: Boolean = true,
    onSelectBin: ((DistributionBucket) -> Unit)? = null,
) {
    val textMeasurer = rememberTextMeasurer()
    val density = LocalDensity.current
    val axisStyle = TextStyle(color = AppColors.appTextSecondary, fontSize = 10.sp)
    val yAxisStyle = TextStyle(color = AppColors.appTextSecondary, fontSize = 9.sp)
    val meanStyle = TextStyle(color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold)

    val curveColor = if (fit?.isEstimated == true) AppColors.appTextSecondary else accent

    val domStart = domain.start
    val domEnd = domain.endInclusive
    val domSpan = (domEnd - domStart).coerceAtLeast(1e-9)

    // Map a plot-space x back to a domain value; used for tap hit-testing so the
    // gesture and the draw share one coordinate transform.
    fun valueAtX(xPx: Float, sizePx: Size): Double? {
        val leftPx = with(density) { LEFT_PAD.toPx() }
        val rightPx = with(density) { RIGHT_PAD.toPx() }
        val plotW = sizePx.width - leftPx - rightPx
        if (plotW <= 0) return null
        val ratio = ((xPx - leftPx) / plotW).coerceIn(0f, 1f)
        return domStart + ratio * domSpan
    }

    val tapModifier = if (onSelectBin != null) {
        Modifier.pointerInput(buckets, domain) {
            detectTapGestures { offset ->
                val value = valueAtX(offset.x, size.toSize()) ?: return@detectTapGestures
                val hit = buckets.firstOrNull { value >= it.lower && value < it.upper }
                    ?: buckets.lastOrNull()?.takeIf { value >= it.lower }
                if (hit != null) onSelectBin(hit)
            }
        }
    } else Modifier

    Canvas(Modifier.fillMaxWidth().height(height).then(tapModifier)) {
        val leftPad = LEFT_PAD.toPx()
        val rightPad = RIGHT_PAD.toPx()
        val topPad = TOP_PAD.toPx()
        val bottomPad = BOTTOM_PAD.toPx()
        val plotW = size.width - leftPad - rightPad
        val plotH = size.height - topPad - bottomPad
        if (plotW <= 0 || plotH <= 0) return@Canvas

        val maxY = maxOf(
            buckets.maxOfOrNull { it.share } ?: 0.0,
            curve.maxOfOrNull { it.y } ?: 0.0,
            1e-6,
        )

        fun px(x: Double) = leftPad + ((x - domStart) / domSpan).toFloat() * plotW
        fun py(y: Double) = topPad + (1f - (y / maxY).toFloat()) * plotH
        val baseline = topPad + plotH

        // Y gridlines + share (%) labels (~4 ticks).
        val yTicks = 4
        for (t in 0..yTicks) {
            val v = maxY * t / yTicks
            val y = py(v)
            drawLine(
                AppColors.appBorder.copy(alpha = 0.18f),
                Offset(leftPad, y),
                Offset(size.width - rightPad, y),
                strokeWidth = 1f,
            )
            val layout = textMeasurer.measure("${(v * 100).roundToInt()}%", yAxisStyle)
            drawText(layout, topLeft = Offset(2f, y - layout.size.height / 2f))
        }

        // X gridlines + labels (~5 ticks).
        val xTicks = 5
        for (t in 0..xTicks) {
            val v = domStart + domSpan * t / xTicks
            val x = px(v)
            drawLine(
                AppColors.appBorder.copy(alpha = 0.22f),
                Offset(x, topPad),
                Offset(x, baseline),
                strokeWidth = 1f,
            )
            val label = axisLabel(v, metric)
            val layout = textMeasurer.measure(label, axisStyle)
            drawText(
                layout,
                topLeft = Offset(
                    (x - layout.size.width / 2f).coerceIn(0f, size.width - layout.size.width),
                    size.height - bottomPad + 4f,
                ),
            )
        }

        // Bars — width 0.9 of each bin, share height, accent @ 0.32.
        buckets.forEach { b ->
            val binWpx = (px(b.upper) - px(b.lower))
            val barW = binWpx * 0.9f
            val cx = px(b.mid)
            val top = py(b.share)
            drawRoundRect(
                color = accent.copy(alpha = 0.32f),
                topLeft = Offset(cx - barW / 2f, top),
                size = Size(barW, (baseline - top).coerceAtLeast(0f)),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(3f * this.density, 3f * this.density),
            )
        }

        // Fitted curve overlay (densely sampled -> straight segments read smooth).
        if (curve.size >= 2) {
            val path = Path()
            curve.forEachIndexed { i, p ->
                val o = Offset(px(p.x), py(p.y))
                if (i == 0) path.moveTo(o.x, o.y) else path.lineTo(o.x, o.y)
            }
            drawPath(
                path,
                color = curveColor,
                style = Stroke(
                    width = 2.5f * this.density,
                    pathEffect = if (fit?.isEstimated == true) PathEffect.dashPathEffect(floatArrayOf(10f, 6f)) else null,
                ),
            )
        }

        // Mean reference line + label.
        if (showReferenceLines && fit != null) {
            val mx = px(fit.mean)
            drawLine(
                AppColors.appTextMuted,
                Offset(mx, topPad),
                Offset(mx, baseline),
                strokeWidth = 1f,
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 3f)),
            )
            val label = valueLabel(fit.mean, metric)
            val layout = textMeasurer.measure(label, meanStyle)
            drawText(
                layout,
                topLeft = Offset(
                    (mx - layout.size.width / 2f).coerceIn(0f, size.width - layout.size.width),
                    (topPad - layout.size.height - 2f).coerceAtLeast(0f),
                ),
            )
        }

        // Break-even (win rate) / zero (net units) reference line.
        if (showReferenceLines) {
            val refX = px(if (metric == StatMetric.WIN_RATE) BREAK_EVEN else 0.0)
            if (refX in leftPad..(leftPad + plotW)) {
                val refColor = (if (metric == StatMetric.WIN_RATE) AppColors.appLoss else AppColors.appTextMuted)
                    .copy(alpha = 0.55f)
                drawLine(refColor, Offset(refX, topPad), Offset(refX, baseline), strokeWidth = 1f)
            }
        }
    }
}

private fun valueLabel(v: Double, metric: StatMetric): String =
    if (metric == StatMetric.WIN_RATE) "${(v * 100).roundToInt()}%"
    else String.format(Locale.US, "%+.1fu", v)

private fun axisLabel(v: Double, metric: StatMetric): String =
    if (metric == StatMetric.WIN_RATE) "${(v * 100).roundToInt()}%"
    else String.format(Locale.US, "%.0f", v)
