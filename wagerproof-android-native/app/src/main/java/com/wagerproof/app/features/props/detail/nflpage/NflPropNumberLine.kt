package com.wagerproof.app.features.props.detail.nflpage

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors

/**
 * The player-analysis "number line": a grey rail with an amber (emphasized)
 * marker and an optional slate marker, a colored connector, a centered delta
 * pill, and edge captions. Port of the web layout reused by ModelStrip, the
 * touchdown probability comparison, and the scheme production rows; mirrors
 * iOS `PropNumberLine.swift`.
 */
data class NflPropNumberLineMarker(
    val label: String,
    val value: String,
    /** Small suffix after the value ("yds"). */
    val unit: String? = null,
    /** Line under the value ("-112" / "EPA/db"). */
    val caption: String? = null,
)

enum class NflPropNumberLineTone { UP, DOWN, NEUTRAL }

private val Amber = Color(0xFFF59E0B)
private val Slate = Color(0xFF94A3B8)

/**
 * Web scale math: pad the [min, max] domain, then place values on the middle
 * 88% of the rail. [floorAtZero] clamps the padded min (counts and
 * probabilities can't go negative; EPA can).
 */
fun nflPropNumberLineFractions(
    primary: Double,
    secondary: Double?,
    padding: Double,
    floorAtZero: Boolean = true,
): Pair<Double, Double?> {
    val values = listOfNotNull(primary, secondary)
    val minV = values.min()
    val maxV = values.max()
    var scaleMin = minV - padding
    if (floorAtZero) scaleMin = maxOf(0.0, scaleMin)
    val scaleMax = maxV + padding
    val span = maxOf(scaleMax - scaleMin, 0.0001)
    fun fraction(v: Double) = 0.06 + ((v - scaleMin) / span) * 0.88
    return fraction(primary) to secondary?.let(::fraction)
}

@Composable
fun NflPropNumberLine(
    primary: NflPropNumberLineMarker,
    primaryFraction: Double,
    secondary: NflPropNumberLineMarker?,
    secondaryFraction: Double?,
    tone: NflPropNumberLineTone,
    deltaText: String?,
    leadingCaption: String,
    trailingCaption: String,
    primaryValueSize: Float = 26f,
) {
    val height = 128.dp
    val railY = 72.dp
    val toneColor = when (tone) {
        NflPropNumberLineTone.UP -> AppColors.appWin
        NflPropNumberLineTone.DOWN -> AppColors.appLoss
        NflPropNumberLineTone.NEUTRAL -> AppColors.appTextMuted
    }

    BoxWithConstraints(Modifier.fillMaxWidth().height(height)) {
        val width = maxWidth
        fun x(fraction: Double): Dp = width * fraction.coerceIn(0.0, 1.0).toFloat()
        fun clampLabelX(x: Dp): Dp = if (x < 56.dp) 56.dp else if (x > width - 56.dp) width - 56.dp else x
        val primaryX = x(primaryFraction)
        val secondaryX = secondaryFraction?.let(::x)

        // Rail.
        Box(
            Modifier
                .align(Alignment.TopStart)
                .offset(x = width * 0.05f, y = railY - 2.dp)
                .width(width * 0.9f)
                .height(4.dp)
                .clip(CircleShape)
                .background(AppColors.appTextMuted.copy(alpha = 0.22f)),
        )

        // Connector between the two markers.
        if (secondaryX != null) {
            val left = if (primaryX < secondaryX) primaryX else secondaryX
            val connectorWidth = if (primaryX > secondaryX) primaryX - secondaryX else secondaryX - primaryX
            Box(
                Modifier
                    .align(Alignment.TopStart)
                    .offset(x = left, y = railY - 2.dp)
                    .width(connectorWidth)
                    .height(4.dp)
                    .background(toneColor.copy(alpha = if (tone == NflPropNumberLineTone.NEUTRAL) 0.4f else 0.55f)),
            )
        }

        if (secondary != null && secondaryX != null) {
            MarkerColumn(
                marker = secondary, emphasized = false, valueSize = 15f,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .offset(x = clampLabelX(secondaryX) - 55.dp)
                    .width(110.dp),
            )
            MarkerDot(color = Slate, modifier = Modifier.align(Alignment.TopStart).offset(x = secondaryX - 6.dp, y = railY - 6.dp))
        }

        MarkerColumn(
            marker = primary, emphasized = true, valueSize = primaryValueSize,
            modifier = Modifier
                .align(Alignment.TopStart)
                .offset(x = clampLabelX(primaryX) - 60.dp)
                .width(120.dp),
        )
        MarkerDot(color = Amber, modifier = Modifier.align(Alignment.TopStart).offset(x = primaryX - 6.dp, y = railY - 6.dp))

        if (deltaText != null && secondaryX != null) {
            val mid = (primaryX + secondaryX) / 2
            Text(
                deltaText,
                color = if (tone == NflPropNumberLineTone.NEUTRAL) AppColors.appTextSecondary else toneColor,
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .offset(x = clampLabelX(mid) - 55.dp, y = railY + 12.dp)
                    .width(110.dp)
                    .padding(vertical = 2.dp),
                textAlign = TextAlign.Center,
            )
        }

        // Edge captions.
        Row(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(horizontal = width * 0.05f)) {
            Text(leadingCaption, color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            Text(trailingCaption, color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun MarkerColumn(
    marker: NflPropNumberLineMarker,
    emphasized: Boolean,
    valueSize: Float,
    modifier: Modifier,
) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            marker.label.uppercase(),
            color = if (emphasized) Amber else AppColors.appTextMuted,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            maxLines = 1,
        )
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                marker.value,
                color = AppColors.appTextPrimary,
                fontSize = valueSize.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                maxLines = 1,
            )
            if (!marker.unit.isNullOrEmpty()) {
                Spacer(Modifier.width(2.dp))
                Text(marker.unit, color = AppColors.appTextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
        if (!marker.caption.isNullOrEmpty()) {
            Text(
                marker.caption,
                color = AppColors.appTextMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
            )
        }
        Box(
            Modifier
                .width(1.dp)
                .height(14.dp)
                .background((if (emphasized) Amber else Slate).copy(alpha = 0.6f)),
        )
    }
}

@Composable
private fun MarkerDot(color: Color, modifier: Modifier) {
    Box(
        modifier
            .size(12.dp)
            .clip(CircleShape)
            .background(color),
    )
}
