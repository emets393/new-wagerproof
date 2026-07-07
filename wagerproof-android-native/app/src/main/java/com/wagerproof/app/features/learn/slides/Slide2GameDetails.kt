package com.wagerproof.app.features.learn.slides

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing

/**
 * Port of iOS `Slide2_GameDetails.swift`. Miniature Game-Details sheet mockup:
 * team gradient header, model-vs-vegas block, 62/38 public-split bar, callout.
 */
@Composable
fun Slide2GameDetails(modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(Spacing.lg)) {
        sheetMockup()
        calloutRow()
    }
}

private const val AWAY_ABBR = "LAL"
private const val HOME_ABBR = "BOS"
private val lakersColor = Color(0xFF552583)
private val celticsColor = Color(0xFF007A33)

@Composable
private fun sheetMockup() {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(AppColors.appSurfaceElevated),
    ) {
        // Drag handle.
        Box(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 4.dp), contentAlignment = Alignment.Center) {
            Box(Modifier.width(36.dp).height(4.dp).clip(CircleShape).background(AppColors.appTextMuted.copy(alpha = 0.4f)))
        }

        // Team gradient header.
        Box(
            Modifier
                .fillMaxWidth()
                .background(
                    Brush.horizontalGradient(
                        listOf(lakersColor.copy(alpha = 0.25f), Color.Transparent, celticsColor.copy(alpha = 0.25f)),
                    ),
                ),
        ) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = Spacing.lg, vertical = Spacing.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                teamCol(AWAY_ABBR, "+4.5 | +165")
                Spacer(Modifier.weight(1f))
                Box(
                    Modifier.size(28.dp).clip(CircleShape).background(AppColors.appTextMuted.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = AppIcon.fromSystemName("at")!!.imageVector,
                        contentDescription = null,
                        tint = AppColors.appTextSecondary,
                        modifier = Modifier.size(14.dp),
                    )
                }
                Spacer(Modifier.weight(1f))
                teamCol(HOME_ABBR, "-4.5 | -195")
            }
        }

        // Model prediction.
        Column(
            Modifier.padding(horizontal = Spacing.md, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            sectionHeader(AppIcon.fromSystemName("brain.head.profile")!!.imageVector, AppColors.appWin, "Model Prediction")
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(AppColors.appSurfaceMuted)
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                predRow("Vegas Spread:", "BOS -4.5", AppColors.appTextPrimary)
                predRow("Model Spread:", "BOS -6.8", AppColors.appTextPrimary)
                predRow("Edge:", "+2.3 to BOS", AppColors.appWin, bold = true)
            }
        }

        // Public betting.
        Column(
            Modifier.padding(horizontal = Spacing.md).padding(bottom = 10.dp),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            sectionHeader(AppIcon.fromSystemName("person.3.fill")!!.imageVector, AppColors.appPrimary, "Public Betting")
            Row(
                Modifier.fillMaxWidth().height(24.dp).clip(RoundedCornerShape(12.dp)),
            ) {
                Box(Modifier.weight(0.38f).fillMaxWidth().height(24.dp).background(AppColors.appLoss), contentAlignment = Alignment.Center) {
                    Text("38%", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }
                Box(Modifier.weight(0.62f).fillMaxWidth().height(24.dp).background(AppColors.appWin), contentAlignment = Alignment.Center) {
                    Text("62%", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 0.dp).padding(top = 4.dp)) {
                Text(AWAY_ABBR, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary)
                Spacer(Modifier.weight(1f))
                Text(HOME_ABBR, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary)
            }
        }
    }
}

@Composable
private fun teamCol(abbr: String, line: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(
            Modifier.size(40.dp).clip(CircleShape).background(AppColors.appSurfaceMuted),
            contentAlignment = Alignment.Center,
        ) {
            Text(abbr.take(1), fontSize = 18.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
        }
        Text(abbr, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
        Text(line, fontSize = 10.sp, color = AppColors.appTextSecondary)
    }
}

@Composable
private fun sectionHeader(icon: androidx.compose.ui.graphics.vector.ImageVector, iconColor: Color, title: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(imageVector = icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(13.dp))
        Text(title, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary)
    }
}

@Composable
private fun predRow(label: String, value: String, color: Color, bold: Boolean = false) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, fontSize = 11.sp, color = AppColors.appTextSecondary)
        Spacer(Modifier.weight(1f))
        Text(value, fontSize = 11.sp, fontWeight = if (bold) FontWeight.Bold else FontWeight.SemiBold, color = color)
    }
}

@Composable
private fun calloutRow() {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(
            imageVector = AppIcon.fromSystemName("hand.tap.fill")!!.imageVector,
            contentDescription = null,
            tint = AppColors.appPrimary,
            modifier = Modifier.size(13.dp),
        )
        Text("Tap any game card to view full analysis", fontSize = 12.sp, color = AppColors.appTextSecondary)
        Spacer(Modifier.weight(1f))
    }
}
