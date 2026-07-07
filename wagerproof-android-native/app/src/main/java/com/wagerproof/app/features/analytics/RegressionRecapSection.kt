package com.wagerproof.app.features.analytics

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBPerfectStormRecords
import com.wagerproof.core.models.MLBYesterdayRecap
import kotlin.math.roundToInt

/**
 * Yesterday's Results: hero tiles (yesterday record + Perfect Storm-tier
 * all-time record) over per-pick graded rows. The ALL-TIME hero deliberately
 * uses tier records, NOT `report.cumulative_record` (RN parity). Port of iOS
 * `RegressionRecapSection`.
 */
@Composable
fun RegressionRecapSection(
    recap: List<MLBYesterdayRecap>,
    psRecords: MLBPerfectStormRecords?,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        HeroRow(recap, psRecords)
        if (recap.isEmpty()) {
            Text(
                text = "No picks graded yesterday.",
                fontSize = 12.sp,
                fontStyle = FontStyle.Italic,
                color = AppColors.appTextSecondary,
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                recap.forEach { RecapRow(it) }
            }
        }
    }
}

@Composable
private fun HeroRow(recap: List<MLBYesterdayRecap>, psRecords: MLBPerfectStormRecords?) {
    val wins = recap.count { it.result == "won" }
    val losses = recap.count { it.result == "lost" }
    val pushes = recap.count { it.result == "push" }
    val total = wins + losses
    val yPct = if (total > 0) wins.toDouble() / total * 100 else 0.0
    val yRecord = if (pushes > 0) "$wins-$losses-$pushes" else "$wins-$losses"

    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        RegressionHeroTile(
            label = "YESTERDAY",
            primary = yRecord,
            modifier = Modifier.weight(1f),
        ) {
            Text(
                text = if (total > 0) "${yPct.roundToInt()}% win rate" else "No graded picks",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (total > 0) Regression.winPctColor(yPct) else AppColors.appTextSecondary,
            )
        }

        val cum = psRecords?.combined
        if (cum != null && cum.wins + cum.losses + cum.pushes > 0) {
            val record = if (cum.pushes > 0) "${cum.wins}-${cum.losses}-${cum.pushes}" else "${cum.wins}-${cum.losses}"
            RegressionHeroTile(
                label = "ALL-TIME",
                primary = record,
                modifier = Modifier.weight(1f),
            ) {
                Row {
                    Text(
                        text = Regression.signed(cum.units, 2) + "u",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Regression.roiColor(cum.units),
                    )
                    Text(
                        text = "  ·  ",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = AppColors.appTextSecondary,
                    )
                    Text(
                        text = Regression.signed(cum.roiPct, 1) + "%",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Regression.roiColor(cum.roiPct),
                    )
                }
            }
        }
    }
}

@Composable
private fun RecapRow(r: MLBYesterdayRecap) {
    val bar = when (r.result) {
        "won" -> Regression.winGreen
        "lost" -> Regression.lossRed
        else -> Regression.neutralGray
    }
    RegressionAccentRow(color = bar) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = r.pick,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.appTextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = r.matchup,
                    fontSize = 11.sp,
                    color = AppColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = r.actualScore,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.appTextPrimary,
                )
                Text(
                    text = r.result.uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.5.sp,
                    color = bar,
                )
            }
        }
    }
}
