package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.CurvePoint
import kotlin.math.roundToInt

/**
 * Native port of iOS `FittedCurveOverlayChart`. Multi-sport comparison: the
 * fitted normal (bell) curves for each sport drawn on one axis so their centers
 * + spreads line up for direct comparison. Curves are peak-normalized (height 1
 * at the mean) so cohort size doesn't distort the shape read. An estimated
 * series (the NFL placeholder) draws dashed.
 *
 * FIDELITY-WAIVER #205 (narrowed): hand-drawn on Compose Canvas instead of iOS
 * `Charts`; the curves now use the same Catmull-Rom interpolation, so only the
 * rendering mechanism differs.
 */
data class FittedCurveSeries(
    val name: String,
    val color: Color,
    val isEstimated: Boolean,
    val points: List<CurvePoint>,
)

// Break-even win rate at -110 juice — the same reference the histogram uses.
private const val BREAK_EVEN = 0.5238

/** Density-resolved plot insets, in pixels. */
private data class PlotInsets(
    val left: Float,
    val right: Float,
    val top: Float,
    val bottom: Float,
    val labelGap: Float,
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FittedCurveOverlayChart(
    series: List<FittedCurveSeries>,
    domain: ClosedFloatingPointRange<Double>,
    height: Dp = 220.dp,
) {
    val textMeasurer = rememberTextMeasurer()
    val axisStyle = TextStyle(color = AppColors.appTextSecondary, fontSize = 10.sp)
    // Named `localDensity` so it can't shadow DrawScope.density inside the Canvas.
    val localDensity = LocalDensity.current
    // Plot insets declared in dp and converted once — raw pixel constants were
    // ~2× too tight on an xxhdpi phone and ~3× on a tablet.
    val padPx = remember(localDensity) {
        with(localDensity) {
            PlotInsets(
                left = 6.dp.toPx(), right = 6.dp.toPx(), top = 8.dp.toPx(),
                bottom = 20.dp.toPx(), labelGap = 4.dp.toPx(),
            )
        }
    }

    Column(Modifier.fillMaxWidth().height(height)) {
        Canvas(Modifier.fillMaxWidth().weight(1f)) {
            val leftPad = padPx.left
            val rightPad = padPx.right
            val topPad = padPx.top
            val bottomPad = padPx.bottom
            val plotW = size.width - leftPad - rightPad
            val plotH = size.height - topPad - bottomPad
            if (plotW <= 0 || plotH <= 0) return@Canvas

            val domStart = domain.start
            val domEnd = domain.endInclusive
            val domSpan = (domEnd - domStart).coerceAtLeast(1e-9)

            // Peak-normalized curves top out near 1; pad a touch of headroom.
            val maxY = (series.flatMap { it.points }.maxOfOrNull { it.y } ?: 1.0).coerceAtLeast(1e-6)

            fun px(x: Double) = leftPad + ((x - domStart) / domSpan).toFloat() * plotW
            fun py(y: Double) = topPad + (1f - (y / maxY).toFloat()) * plotH

            // X gridlines + percent labels (~5 ticks).
            val ticks = 5
            for (t in 0..ticks) {
                val v = domStart + domSpan * t / ticks
                val x = px(v)
                drawLine(
                    AppColors.appBorder.copy(alpha = 0.22f),
                    Offset(x, topPad),
                    Offset(x, topPad + plotH),
                    strokeWidth = 1f,
                )
                val label = "${(v * 100).roundToInt()}%"
                val layout = textMeasurer.measure(label, axisStyle)
                drawText(
                    layout,
                    topLeft = Offset(
                        (x - layout.size.width / 2f).coerceIn(0f, size.width - layout.size.width),
                        size.height - bottomPad + padPx.labelGap,
                    ),
                )
            }

            // Break-even reference line.
            val beX = px(BREAK_EVEN)
            if (beX in leftPad..(leftPad + plotW)) {
                drawLine(
                    AppColors.appLoss.copy(alpha = 0.5f),
                    Offset(beX, topPad),
                    Offset(beX, topPad + plotH),
                    strokeWidth = 1f,
                )
            }

            // Each sport's curve, Catmull-Rom smoothed like iOS's
            // `.interpolationMethod(.catmullRom)`; dashed when the fit is estimated.
            series.forEach { s ->
                if (s.points.size < 2) return@forEach
                drawPath(
                    catmullRomPath(s.points.map { Offset(px(it.x), py(it.y)) }),
                    color = s.color,
                    style = Stroke(
                        width = 2.5f * this.density,
                        pathEffect = if (s.isEstimated) PathEffect.dashPathEffect(floatArrayOf(10f, 6f)) else null,
                    ),
                )
            }
        }

        // Legend (iOS `.chartLegend(position: .bottom)`, which wraps). A fixed
        // Row clipped the 4th entry on narrow screens.
        FlowRow(
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            series.forEach { s ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Canvas(Modifier.width(18.dp).height(3.dp)) {
                        drawLine(
                            s.color,
                            Offset(0f, size.height / 2f),
                            Offset(size.width, size.height / 2f),
                            strokeWidth = size.height,
                            pathEffect = if (s.isEstimated) PathEffect.dashPathEffect(floatArrayOf(5f, 3f)) else null,
                        )
                    }
                    Text(
                        s.name,
                        color = AppColors.appTextSecondary,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(start = 6.dp),
                    )
                }
            }
        }
    }
}
