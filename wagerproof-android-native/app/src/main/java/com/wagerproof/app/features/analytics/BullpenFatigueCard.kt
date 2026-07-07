package com.wagerproof.app.features.analytics

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBBullpenFatigue
import java.util.Locale

/**
 * One bullpen in the fatigue/trend list. OVERWORKED (red) vs DECLINING (amber)
 * follows the row's `flag`. IP thresholds (13 over 3d, 22 over 5d) highlighted
 * red. Port of iOS `BullpenFatigueCard`.
 */
@Composable
fun BullpenFatigueCard(bullpen: MLBBullpenFatigue, modifier: Modifier = Modifier) {
    val overworked = bullpen.flag == "overworked"
    val color = if (overworked) Regression.lossRed else Regression.warnAmber
    RegressionAccentRow(color = color, modifier = modifier) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(bullpen.teamName, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary, modifier = Modifier.weight(1f))
                RegressionPill(if (overworked) "OVERWORKED" else "DECLINING", color)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                RegressionStat(
                    "IP L3d",
                    String.format(Locale.US, "%.1f", bullpen.bpIpLast3d),
                    Modifier.weight(1f),
                    if (bullpen.bpIpLast3d >= 13) Regression.lossRed else null,
                )
                RegressionStat(
                    "IP L5d",
                    String.format(Locale.US, "%.1f", bullpen.bpIpLast5d),
                    Modifier.weight(1f),
                    if (bullpen.bpIpLast5d >= 22) Regression.lossRed else null,
                )
                RegressionStat("SEASON xFIP", bullpen.seasonBpXfip?.let { String.format(Locale.US, "%.2f", it) } ?: "-", Modifier.weight(1f))
                RegressionStat(
                    "TREND xFIP",
                    bullpen.trendBpXfip?.let { Regression.signed(it, 2) } ?: "-",
                    Modifier.weight(1f),
                    bullpen.trendBpXfip?.let { if (it > 0) Regression.lossRed else Regression.winGreen },
                )
            }
        }
    }
}
