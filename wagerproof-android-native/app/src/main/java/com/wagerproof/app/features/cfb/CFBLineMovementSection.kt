package com.wagerproof.app.features.cfb

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.CFBPrediction
import java.util.Locale
import kotlin.math.floor

/**
 * FIDELITY-WAIVER #033: line-movement chart stub (doc §4.3). Renders opening /
 * current line metric boxes + placeholder copy; the live `cfb_line_movement`
 * chart wires up in a later batch.
 */
@Composable
fun CFBLineMovementSection(
    game: CFBPrediction,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppIcon.fromSystemName("chart.line.uptrend.xyaxis")?.let {
                Icon(it.imageVector, contentDescription = null, tint = AppColors.appAccentPurple)
            }
            Text(
                "Line Movement",
                color = AppColors.appTextPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            game.openingSpread?.let {
                Metric("Opening Spread", GameCardFormatting.formatSpread(it), Modifier.weight(1f))
            }
            game.openingTotal?.let {
                Metric("Opening Total", fmtHalfLine(it), Modifier.weight(1f))
            }
            game.homeSpread?.let {
                Metric("Current Spread", GameCardFormatting.formatSpread(it), Modifier.weight(1f))
            }
        }
        Text(
            "Detailed line history will appear once cfb_line_movement wires up.",
            color = AppColors.appTextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
private fun Metric(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier
            .background(AppColors.appSurfaceMuted, RoundedCornerShape(10.dp))
            .padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label, color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        Text(
            value,
            color = AppColors.appTextPrimary,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
        )
    }
}

private fun fmtHalfLine(value: Double?): String {
    val rounded = GameCardFormatting.roundToNearestHalf(value) ?: return "—"
    return if (floor(rounded) == rounded) rounded.toInt().toString()
    else String.format(Locale.US, "%.1f", rounded)
}
