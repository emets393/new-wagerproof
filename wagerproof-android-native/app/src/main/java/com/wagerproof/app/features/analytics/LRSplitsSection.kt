package com.wagerproof.app.features.analytics

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBLRSplitEntry

/**
 * L/R Pitcher Splits: notable matchups (indigo accent) first, then all other
 * splits. Port of iOS `LRSplitsSection` / RN `LRSplitsBody`.
 */
@Composable
fun LRSplitsSection(splits: List<MLBLRSplitEntry>, modifier: Modifier = Modifier) {
    val notable = splits.filter { it.isNotable }
    val rest = splits.filter { !it.isNotable }

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (notable.isNotEmpty()) {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                RegressionGroupLabel(
                    label = "NOTABLE MATCHUPS",
                    count = notable.size,
                    color = Regression.accentIndigo,
                    note = "Favorable or difficult splits worth flagging",
                )
                notable.forEach { LRSplitRow(it, notable = true) }
            }
        }
        if (rest.isNotEmpty()) {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                RegressionGroupLabel(label = "ALL OTHER SPLITS", count = rest.size)
                rest.forEach { LRSplitRow(it, notable = false) }
            }
        }
    }
}

@Composable
private fun LRSplitRow(split: MLBLRSplitEntry, notable: Boolean) {
    val record = if (split.f5Ties > 0) {
        "F5 ${split.f5Wins}-${split.f5Losses}-${split.f5Ties}"
    } else {
        "F5 ${split.f5Wins}-${split.f5Losses}"
    }
    val winColor: Color = split.f5WinPct?.let { pct ->
        when {
            pct >= 60 -> Regression.winGreen
            pct <= 40 -> Regression.lossRed
            else -> AppColors.appTextPrimary
        }
    } ?: AppColors.appTextPrimary

    RegressionAccentRow(color = if (notable) Regression.accentIndigo else Color.Transparent) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f)) {
                Row {
                    Text(split.teamName, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
                    Text("  ${split.facing}", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = AppColors.appTextSecondary)
                }
                Text(
                    text = "vs ${split.opponentSp ?: split.opponent} (${split.opponentSpHand}HP)",
                    fontSize = 11.sp,
                    color = AppColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${Regression.trimmed(split.avgF5Runs)} R/G",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    fontFamily = FontFamily.Monospace,
                    color = AppColors.appTextPrimary,
                )
                Text(
                    text = record + (split.f5WinPct?.let { "  ${Regression.trimmed(it)}%" } ?: ""),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    fontFamily = FontFamily.Monospace,
                    color = winColor,
                )
            }
        }
    }
}
