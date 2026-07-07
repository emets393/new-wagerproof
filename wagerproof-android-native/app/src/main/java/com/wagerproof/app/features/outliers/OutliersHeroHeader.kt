package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.tokens.AppColors

/**
 * Legacy glassmorphic hero banner for the Outliers hub. Port of iOS
 * `Components/OutliersHeroHeader.swift` — superseded by [OutliersHowToBanner]
 * but still on disk, so ported minimally for parity.
 *
 * Tri-color gradient stripe, headline + body, then a "We Scan → We Flag →
 * You Act" 3-step flow row.
 */
@Composable
fun OutliersHeroHeaderView(modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(
                Brush.linearGradient(
                    0f to hexColor(0x00E676).copy(alpha = 0.10f),
                    0.5f to hexColor(0x00B0FF).copy(alpha = 0.06f),
                    1f to hexColor(0x7C4DFF).copy(alpha = 0.10f),
                    start = Offset(0f, 0f),
                    end = Offset.Infinite,
                ),
            )
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.6f))
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.6f), shape),
    ) {
        // Tri-color accent stripe.
        Box(
            Modifier
                .fillMaxWidth()
                .height(3.dp)
                .background(
                    Brush.horizontalGradient(
                        listOf(hexColor(0x00E676), hexColor(0x00B0FF), hexColor(0x7C4DFF)),
                    ),
                ),
        )

        Column(
            Modifier.padding(horizontal = 16.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                "Spot the setup before the outcome.",
                color = AppColors.appTextPrimary,
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
            )
            Text(
                "We scan every game across every sport for statistical outliers — the rare conditions that historically lead to profitable betting opportunities. When the data lines up like this, you want to know about it.",
                color = AppColors.appTextSecondary,
                fontSize = 13.sp,
            )

            HorizontalDivider(Modifier.padding(top = 8.dp), color = AppColors.appBorder)

            Row(
                Modifier.fillMaxWidth().padding(top = 8.dp),
                verticalAlignment = Alignment.Top,
            ) {
                FlowStep(
                    icon = "dot.radiowaves.left.and.right",
                    iconColor = hexColor(0x22C55E),
                    title = "We Scan",
                    desc = "Every line, trend, and model signal across 5 sports",
                    modifier = Modifier.weight(1f),
                )
                Chevron()
                FlowStep(
                    icon = "chart.bar.xaxis",
                    iconColor = hexColor(0xF59E0B),
                    title = "We Flag",
                    desc = "Rare setups where history says the edge is real",
                    modifier = Modifier.weight(1f),
                )
                Chevron()
                FlowStep(
                    icon = "scope",
                    iconColor = hexColor(0x7C4DFF),
                    title = "You Act",
                    desc = "Get the alert before the line moves",
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun Chevron() {
    Icon(
        outlierSymbol("chevron.right"),
        null,
        tint = AppColors.appTextSecondary,
        modifier = Modifier.padding(top = 10.dp).size(11.dp),
    )
}

@Composable
private fun FlowStep(
    icon: String,
    iconColor: Color,
    title: String,
    desc: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            Modifier.size(40.dp).clip(CircleShape).background(iconColor.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(outlierSymbol(icon), null, tint = iconColor, modifier = Modifier.size(16.dp))
        }
        Text(title, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        Text(
            desc,
            color = AppColors.appTextSecondary,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
        )
    }
}
