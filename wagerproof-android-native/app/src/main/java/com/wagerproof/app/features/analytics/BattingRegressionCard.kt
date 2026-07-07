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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBBattingRegression
import java.util.Locale

/**
 * One team batting regression candidate (heat-up or cool-down — split lives in
 * the section group labels; severity colors the accent/pill). Port of iOS
 * `BattingRegressionCard`.
 */
@Composable
fun BattingRegressionCard(team: MLBBattingRegression, modifier: Modifier = Modifier) {
    val sev = Regression.severityColor(team.severity)
    RegressionAccentRow(color = sev, modifier = modifier) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(team.teamName, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
                    Text("${team.games}G sample", fontSize = 11.sp, color = AppColors.appTextSecondary)
                }
                team.severity?.let { RegressionPill(it.uppercase(), sev) }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                RegressionStat("wOBA", team.woba?.let { String.format(Locale.US, "%.3f", it) } ?: "-", Modifier.weight(1f))
                RegressionStat("BABIP", String.format(Locale.US, "%.3f", team.babip), Modifier.weight(1f))
                RegressionStat("xwOBACon", team.xwobacon?.let { String.format(Locale.US, "%.3f", it) } ?: "-", Modifier.weight(1f))
                RegressionStat("GAP", team.wobaGap?.let { Regression.signed(it, 3) } ?: "-", Modifier.weight(1f), team.wobaGap?.let { gapColor(it) })
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                RegressionStat("HH%", team.hardHitPct?.let { String.format(Locale.US, "%.1f%%", it * 100) } ?: "-", Modifier.weight(1f))
                RegressionStat("BARREL%", team.barrelPct?.let { String.format(Locale.US, "%.1f%%", it * 100) } ?: "-", Modifier.weight(1f))
                RegressionStat("EV", team.avgEv?.let { String.format(Locale.US, "%.1f", it) } ?: "-", Modifier.weight(1f))
                RegressionStat("xwC L5", team.trendXwobacon?.let { Regression.signed(it, 3) } ?: "-", Modifier.weight(1f), team.trendXwobacon?.let { trendColor(it) })
            }
        }
    }
}

private fun gapColor(gap: Double): Color? = when {
    gap > 0.03 -> Regression.lossRed
    gap < -0.03 -> Regression.winGreen
    else -> null
}

// Inverted vs pitchers: rising contact quality is GOOD for hitters.
private fun trendColor(value: Double): Color? = when {
    value > 0.015 -> Regression.winGreen
    value < -0.015 -> Regression.lossRed
    else -> null
}
