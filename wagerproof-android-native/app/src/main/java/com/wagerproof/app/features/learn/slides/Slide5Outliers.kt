package com.wagerproof.app.features.learn.slides

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing

/**
 * Port of iOS `Slide5_Outliers.swift`. Two alert cards (VALUE + FADE) with
 * pro-lock badges + a green/amber legend. Hardcoded marketing content.
 */
private enum class AlertKind { VALUE, FADE }

private data class OutlierAlert(
    val kind: AlertKind,
    val sport: String,
    val matchup: String,
    val description: String,
    val confidence: Int,
    val suggestedBet: String?,
)

private val alerts = listOf(
    OutlierAlert(AlertKind.VALUE, "NFL", "Patriots @ Dolphins", "Polymarket shows 67% on Patriots +3.5", 67, null),
    OutlierAlert(AlertKind.FADE, "NFL", "Bills @ Jets", "Model predicts Bills at 82% - Historical fade opportunity", 82, "Jets +7"),
)

@Composable
fun Slide5Outliers(modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(Spacing.lg)) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
            alerts.forEach { alertCard(it) }
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            legendRow(Color(0xFF22C55E), "Value alerts: Market disagrees with Vegas")
            legendRow(Color(0xFFF59E0B), "Fade alerts: High confidence = fade opportunity")
        }
    }
}

@Composable
private fun alertCard(a: OutlierAlert) {
    val color = if (a.kind == AlertKind.VALUE) Color(0xFF22C55E) else Color(0xFFF59E0B)
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(AppColors.appSurfaceElevated)
            .border(1.dp, color.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
    ) {
        // Top accent bar.
        Box(Modifier.fillMaxWidth().height(3.dp).background(color))
        Column(
            Modifier.padding(Spacing.md),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    a.sport,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.appTextSecondary,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(AppColors.appSurfaceMuted)
                        .padding(horizontal = 8.dp, vertical = 3.dp),
                )
                Row(
                    Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(color.copy(alpha = 0.2f))
                        .padding(horizontal = 8.dp, vertical = 3.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = AppIcon.fromSystemName(
                            if (a.kind == AlertKind.VALUE) "chart.line.uptrend.xyaxis" else "bolt.fill",
                        )!!.imageVector,
                        contentDescription = null,
                        tint = color,
                        modifier = Modifier.size(10.dp),
                    )
                    Text(if (a.kind == AlertKind.VALUE) "VALUE" else "FADE", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = color)
                }
                Text(
                    "${a.confidence}%",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = color,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(color.copy(alpha = 0.2f))
                        .padding(horizontal = 8.dp, vertical = 3.dp),
                )
                Spacer(Modifier.weight(1f))
            }

            Text(a.matchup, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary)
            Text(a.description, fontSize = 12.sp, color = AppColors.appTextSecondary, lineHeight = 16.sp)

            a.suggestedBet?.let { suggested ->
                Row(
                    Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(color.copy(alpha = 0.1f))
                        .border(1.dp, color.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Suggested:", fontSize = 11.sp, color = AppColors.appTextSecondary)
                    Text(suggested, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = color)
                }
            }
        }
        // Pro-lock badge, top-right.
        Row(
            Modifier
                .align(Alignment.TopEnd)
                .padding(10.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(AppColors.appSurfaceMuted)
                .padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = AppIcon.fromSystemName("lock.fill")!!.imageVector,
                contentDescription = null,
                tint = AppColors.appAccentAmber,
                modifier = Modifier.size(9.dp),
            )
            Text("Pro Feature", fontSize = 9.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appAccentAmber)
        }
    }
}

@Composable
private fun legendRow(color: Color, text: String) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(12.dp).clip(CircleShape).background(color))
        Text(text, fontSize = 12.sp, color = AppColors.appTextSecondary)
        Spacer(Modifier.weight(1f))
    }
}
