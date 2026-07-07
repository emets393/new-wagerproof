package com.wagerproof.app.features.props.detail

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import androidx.compose.material3.Text
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBPlayerProps
import com.wagerproof.core.models.MLBPropChartBar

/**
 * Recent-form bar chart for a player prop — hand-drawn with Compose [Canvas]
 * (no external chart lib). As the selected line changes upstream, the dashed
 * threshold line slides (animated via [animateFloatAsState], easeInOut ~250ms)
 * and bars recolor green/red live against the animated threshold. Fixed
 * x-domain (oldest→newest); value annotations sit on each bar.
 * Port of iOS `RecentPropBarChart.swift`.
 */
@Composable
fun RecentPropBarChart(bars: List<MLBPropChartBar>, line: Double, modifier: Modifier = Modifier) {
    if (bars.isEmpty()) {
        Text(
            "No recent games",
            color = AppColors.appTextMuted,
            fontStyle = FontStyle.Italic,
            fontSize = 13.sp,
            modifier = modifier.fillMaxWidth(),
        )
        return
    }

    val animatedLine by animateFloatAsState(
        targetValue = line.toFloat(),
        animationSpec = tween(250),
        label = "propChartLine",
    )
    // Domain uses the target line so bars don't rescale mid-slide (RN parity).
    val maxVal = maxOf(line * 1.5, bars.maxOf { it.value }, line + 1, 1.0)

    val green = AppColors.appPrimary.toArgb()
    val loss = AppColors.appLoss
    val primary = AppColors.appPrimary
    val muted = AppColors.appTextMuted

    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Canvas(Modifier.fillMaxWidth().height(168.dp)) {
            val n = bars.size
            val slot = size.width / n
            val barW = slot * 0.62f
            val topInset = 16.dp.toPx() // room for value annotations

            val valuePaint = Paint().apply {
                isAntiAlias = true
                textSize = 9.sp.toPx()
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                textAlign = Paint.Align.CENTER
            }

            bars.forEachIndexed { i, bar ->
                val cleared = bar.value > animatedLine
                val h = (bar.value / maxVal).toFloat() * (size.height - topInset)
                val cx = slot * i + slot / 2f
                val left = cx - barW / 2f
                val top = size.height - h
                val color = if (cleared) primary else loss.copy(alpha = 0.7f)
                drawRoundRect(
                    color = color,
                    topLeft = Offset(left, top),
                    size = Size(barW, h),
                    cornerRadius = CornerRadius(2.dp.toPx()),
                )
                valuePaint.color = if (cleared) green else loss.toArgb()
                drawContext.canvas.nativeCanvas.drawText(
                    MLBPlayerProps.formatBarValue(bar.value),
                    cx,
                    top - 4.dp.toPx(),
                    valuePaint,
                )
            }

            // Dashed threshold line.
            val ty = size.height - (animatedLine / maxVal).toFloat() * (size.height - topInset)
            drawLine(
                color = primary.copy(alpha = 0.85f),
                start = Offset(0f, ty),
                end = Offset(size.width, ty),
                strokeWidth = 1.2.dp.toPx(),
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx())),
            )
            val labelPaint = Paint().apply {
                isAntiAlias = true
                textSize = 9.sp.toPx()
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                textAlign = Paint.Align.RIGHT
                color = primary.toArgb()
            }
            drawContext.canvas.nativeCanvas.drawText(
                "Line ${MLBPlayerProps.formatBarValue(animatedLine.toDouble())}",
                size.width,
                ty - 3.dp.toPx(),
                labelPaint,
            )
        }

        // X labels (M/D), one per bar, oldest → newest.
        Row(Modifier.fillMaxWidth()) {
            bars.forEach { bar ->
                Text(
                    shortDate(bar.date) ?: "",
                    color = muted,
                    fontSize = 8.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Text(
            "Last ${bars.size} games · oldest left → most recent right",
            color = muted,
            fontSize = 10.sp,
            textAlign = TextAlign.Center,
            fontWeight = FontWeight.Normal,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** "2026-06-15" → "6/15". Mirrors RN `formatShortDate`. */
fun shortDate(iso: String?): String? {
    if (iso == null) return null
    val parts = iso.split("-")
    if (parts.size < 3) return null
    val month = parts[1].toIntOrNull() ?: return null
    val day = parts[2].take(2).toIntOrNull() ?: return null
    return "$month/$day"
}
