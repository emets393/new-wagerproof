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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBPitcherRegression
import java.util.Locale

/**
 * One starting pitcher regression candidate. The negative/positive split lives
 * in the section's group labels; accent + pill color is driven by per-row
 * severity. Port of iOS `PitcherRegressionCard`.
 */
@Composable
fun PitcherRegressionCard(pitcher: MLBPitcherRegression, modifier: Modifier = Modifier) {
    val sev = Regression.severityColor(pitcher.severity)
    RegressionAccentRow(color = sev, modifier = modifier) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Row {
                        Text(
                            text = pitcher.pitcherName,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = AppColors.appTextPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = "  ${pitcher.teamName}",
                            fontSize = 12.sp,
                            color = AppColors.appTextSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    if (pitcher.opponent != null) {
                        Text(
                            text = "vs ${pitcher.opponent}",
                            fontSize = 11.sp,
                            color = AppColors.appTextSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                RegressionPill(pitcher.severity.uppercase(), sev)
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                RegressionStat("ERA", String.format(Locale.US, "%.2f", pitcher.era), Modifier.weight(1f))
                RegressionStat("xFIP", String.format(Locale.US, "%.2f", pitcher.xfip), Modifier.weight(1f))
                RegressionStat("GAP", Regression.signed(pitcher.eraMinusXfip, 2), Modifier.weight(1f), gapColor(pitcher.eraMinusXfip))
                RegressionStat("xwOBA", pitcher.xwoba?.let { String.format(Locale.US, "%.3f", it) } ?: "-", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                RegressionStat("WHIP", pitcher.whip?.let { String.format(Locale.US, "%.2f", it) } ?: "-", Modifier.weight(1f))
                RegressionStat("K%", pitcher.kPct?.let { String.format(Locale.US, "%.1f%%", it) } ?: "-", Modifier.weight(1f))
                RegressionStat("BB%", pitcher.bbPct?.let { String.format(Locale.US, "%.1f%%", it) } ?: "-", Modifier.weight(1f))
                RegressionStat(
                    "xFIP L3",
                    pitcher.trendXfip?.let { Regression.signed(it, 2) } ?: "-",
                    Modifier.weight(1f),
                    pitcher.trendXfip?.let { trendColor(it) },
                )
            }
        }
    }
}

private fun gapColor(gap: Double): Color? = when {
    gap > 0.5 -> Regression.lossRed
    gap < -0.5 -> Regression.winGreen
    else -> null
}

// Rising xFIP trend = degrading pitcher → red.
private fun trendColor(value: Double): Color? = when {
    value > 0.3 -> Regression.lossRed
    value < -0.3 -> Regression.winGreen
    else -> null
}
