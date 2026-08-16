package com.wagerproof.app.features.props.detail.nflpage

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NFLPlayerProps
import com.wagerproof.core.models.NFLPropTrendGame
import java.util.Locale


/**
 * Recent Games widget body — the native `Last10Strip` drawn in the MLB
 * `RecentPropBarChart` Canvas style. Bars are the player's actual stat totals
 * from the trends game log, graded against TODAY's line (not the historical
 * closing lines), oldest left → most recent right, opponent abbrevs below.
 * Mirrors iOS `NFLRecentGamesChart.swift`.
 */
@Composable
fun NflRecentGamesChart(
    /** Newest-first, as served. */
    games: List<NFLPropTrendGame>,
    marketKey: String,
    line: Double?,
    /** Override for the dashed-line badge ("TD" for anytime-TD's 0.5 bar). */
    lineLabel: String? = null,
) {
    data class Bar(val opp: String, val value: Double?, val delta: Double?)

    val displayed = games.take(10).reversed()
    if (displayed.isEmpty()) {
        Text(
            "No recent game log yet",
            color = AppColors.appTextMuted,
            fontSize = 13.sp,
            fontStyle = FontStyle.Italic,
            modifier = Modifier.fillMaxWidth(),
        )
        return
    }
    val bars = displayed.map { game ->
        val actual = game.actuals[marketKey]
        Bar(
            opp = game.opp,
            value = actual,
            delta = if (actual != null && line != null) actual - line else null,
        )
    }
    // Web ceiling: max(1, line, all actuals) × 1.14.
    val ceiling = maxOf(1.0, line ?: 0.0, bars.mapNotNull { it.value }.maxOrNull() ?: 0.0) * 1.14
    val win = AppColors.appWin
    val loss = AppColors.appLoss
    val muted = AppColors.appTextMuted

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Canvas(Modifier.fillMaxWidth().height(172.dp)) {
            val n = bars.size
            val slot = size.width / n
            val barW = slot * 0.62f
            val topInset = 24.dp.toPx()
            val plotHeight = size.height - topInset
            val valuePaint = Paint().apply {
                isAntiAlias = true
                textSize = 9.sp.toPx()
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                textAlign = Paint.Align.CENTER
            }
            val deltaPaint = Paint().apply {
                isAntiAlias = true
                textSize = 7.sp.toPx()
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                textAlign = Paint.Align.CENTER
            }
            bars.forEachIndexed { i, bar ->
                val toneColor = when {
                    bar.value == null || line == null || bar.value == line -> muted.copy(alpha = 0.45f)
                    bar.value > line -> win
                    else -> loss.copy(alpha = 0.75f)
                }
                // Missing actuals still occupy a slot (short muted stub) so
                // the opponent row below stays aligned — web parity.
                val value = bar.value ?: (ceiling * 0.06)
                val h = (value / ceiling).toFloat() * plotHeight
                val cx = slot * i + slot / 2f
                val top = size.height - h
                drawRoundRect(
                    color = toneColor,
                    topLeft = Offset(cx - barW / 2f, top),
                    size = Size(barW, h),
                    cornerRadius = CornerRadius(2.dp.toPx()),
                )
                valuePaint.color = toneColor.toArgb()
                drawContext.canvas.nativeCanvas.drawText(
                    bar.value?.let(::barLabel) ?: "—",
                    cx,
                    top - (if (bar.delta != null) 14.dp.toPx() else 4.dp.toPx()),
                    valuePaint,
                )
                bar.delta?.let { delta ->
                    deltaPaint.color = toneColor.toArgb()
                    drawContext.canvas.nativeCanvas.drawText(deltaLabel(delta), cx, top - 4.dp.toPx(), deltaPaint)
                }
            }
            if (line != null) {
                val ty = size.height - (line / ceiling).toFloat() * plotHeight
                drawLine(
                    color = AppColors.appPrimary.copy(alpha = 0.85f),
                    start = Offset(0f, ty),
                    end = Offset(size.width, ty),
                    strokeWidth = 1.2.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx())),
                )
                val labelPaint = Paint().apply {
                    isAntiAlias = true
                    textSize = 9.sp.toPx()
                    typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                    textAlign = Paint.Align.LEFT
                    color = AppColors.appPrimary.toArgb()
                }
                drawContext.canvas.nativeCanvas.drawText(
                    lineLabel ?: "Line ${NFLPlayerProps.formatLine(line)}",
                    4.dp.toPx(),
                    ty - 3.dp.toPx(),
                    labelPaint,
                )
            }
        }
        Row(Modifier.fillMaxWidth()) {
            bars.forEach { bar ->
                Text(
                    bar.opp,
                    color = AppColors.appTextMuted,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Text(
            "Oldest left → most recent right",
            color = AppColors.appTextMuted,
            fontSize = 9.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().align(Alignment.CenterHorizontally),
        )
    }
}

private fun barLabel(v: Double): String =
    if (v == Math.rint(v)) v.toInt().toString() else String.format(Locale.US, "%.1f", v)

private fun deltaLabel(d: Double): String {
    if (d == 0.0) return "0"
    val magnitude = if (d == Math.rint(d)) kotlin.math.abs(d).toInt().toString() else String.format(Locale.US, "%.1f", kotlin.math.abs(d))
    return "${if (d > 0) "+" else "-"}$magnitude"
}
