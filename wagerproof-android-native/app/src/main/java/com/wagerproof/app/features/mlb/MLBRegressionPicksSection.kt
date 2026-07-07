package com.wagerproof.app.features.mlb

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBSuggestedPick
import java.util.Locale

/**
 * Regression-report pick cards inside the MLB detail sheet — port of iOS
 * `MLBRegressionPicksSection`. The host `WidgetCollapsingSection` supplies the
 * title/chrome; this renders the pre-filtered per-game picks.
 *
 * FIDELITY-WAIVER #110: model-alignment detection ("Aligns/Contradicts model")
 * is intentionally omitted — the structural port ships without needle-matching
 * until the picks-generation pipeline wires up downstream.
 */
@Composable
fun MLBRegressionPicksSection(
    picks: List<MLBSuggestedPick>,
    modifier: Modifier = Modifier,
) {
    if (picks.isEmpty()) return
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        picks.forEach { pickCard(it) }
    }
}

@Composable
private fun pickCard(pick: MLBSuggestedPick) {
    val confColor = if (pick.confidenceAtSuggestion == "high") AppColors.appPrimary else hexColor(0xF59E0BL)
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.4f))
            .border(1.dp, AppColors.appBorder, shape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                betTypeLabel(pick.betType).uppercase(),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = AppColors.appTextSecondary,
            )
            Column(Modifier.weight(1f)) {}
            Text(
                pick.confidenceAtSuggestion.uppercase(),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.4.sp,
                color = confColor,
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(confColor.copy(alpha = 0.13f))
                    .border(1.dp, confColor, RoundedCornerShape(6.dp))
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            )
        }
        Text(pick.pick, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary, maxLines = 2)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            statCell("Edge", edgeText(pick), Modifier.weight(1f))
            statCell("Bucket", bucketText(pick.edgeBucket), Modifier.weight(1f))
            statCell("Bucket W%", String.format(Locale.US, "%.0f%%", pick.bucketWinPct), Modifier.weight(1f), winPctColor(pick.bucketWinPct))
        }
        pick.reasoning?.takeIf { it.isNotEmpty() }?.let {
            Text(it, fontSize = 12.sp, fontStyle = FontStyle.Italic, color = AppColors.appTextSecondary, lineHeight = 17.sp)
        }
    }
}

@Composable
private fun statCell(label: String, value: String, modifier: Modifier = Modifier, color: Color = AppColors.appTextPrimary) {
    Column(modifier.padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Medium, color = AppColors.appTextSecondary)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = color, textAlign = TextAlign.Center)
    }
}

private fun betTypeLabel(bt: String): String = when (bt) {
    "full_ml" -> "Full Game · Moneyline"
    "full_ou" -> "Full Game · Total"
    "f5_ml" -> "1st 5 · Moneyline"
    "f5_ou" -> "1st 5 · Total"
    else -> bt
}

private fun edgeText(pick: MLBSuggestedPick): String {
    val sign = if (pick.edgeAtSuggestion > 0) "+" else ""
    val suffix = if (pick.betType.contains("ml")) "%" else ""
    return "$sign${String.format(Locale.US, "%g", pick.edgeAtSuggestion)}$suffix"
}

private fun bucketText(bucket: String): String = if (bucket == "perfect_storm") "Perfect\nStorm" else bucket

/** Mirrors RN `winColor(pct)`. */
private fun winPctColor(pct: Double): Color = when {
    pct >= 65 -> AppColors.appPrimary
    pct >= 55 -> hexColor(0xEAB308L)
    pct >= 50 -> hexColor(0xF97316L)
    else -> AppColors.appAccentRed
}
