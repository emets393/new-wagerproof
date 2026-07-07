package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
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
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.TrendsInsightSummary
import com.wagerproof.core.models.TrendsSignal
import kotlin.math.roundToInt

// FIDELITY-WAIVER #240: iOS BettingTrendsInsightWidget composes with
// InsightWidgetSection / InsightVerdictLine / TrendSignalRow — none of which are
// ported yet. This is a self-contained collapsed "Betting Trends" digest card
// (title + purple trend icon + verdict chips + top-3 signal rows or the quiet
// empty state + a "See all N situations" expander) matching the doc's contract.

/**
 * Collapsed "Betting Trends" digest for the game detail sheets (MLB, NBA,
 * NCAAB). The host owns the full-matrix presentation via [onExpand].
 */
@Composable
fun BettingTrendsInsightWidget(
    summary: TrendsInsightSummary,
    awayAbbr: String,
    homeAbbr: String,
    accent: Color,
    onExpand: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(18.dp)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .liquidGlassBackground(shape, hairline = true)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Header: purple trend icon + title + summary badge capsule.
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(
                outlierSymbol("chart.line.uptrend.xyaxis"),
                null,
                tint = hexColor(0x8B5CF6L),
                modifier = Modifier.size(16.dp),
            )
            Text("Betting Trends", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary)
            Box(Modifier.weight(1f))
            val badgeColor = hexColor(summary.badge.tintHex)
            Text(
                summary.badge.text,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.4.sp,
                color = badgeColor,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(badgeColor.copy(alpha = 0.16f))
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            )
        }

        // Verdict line — 1-2 short verdict chips.
        if (summary.verdicts.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                summary.verdicts.forEach { verdict ->
                    Text(
                        verdict.text,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = accent,
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(accent.copy(alpha = 0.12f))
                            .padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
            }
        }

        if (summary.signals.isEmpty()) {
            // Present-but-quiet: zero qualifying signals is information too.
            Text(
                "No situational edge in today's data",
                fontSize = 12.sp,
                color = AppColors.appTextSecondary,
                modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
            )
        } else {
            summary.signals.take(3).forEach { signal ->
                TrendSignalRow(signal, awayAbbr, homeAbbr)
            }
        }

        // Expander footer.
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .clickable(onClick = onExpand)
                .padding(vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("See all ${summary.totalSituations} situations", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = accent)
            Icon(outlierSymbol("chevron.right"), null, tint = accent, modifier = Modifier.size(12.dp))
        }
    }
}

@Composable
private fun TrendSignalRow(signal: TrendsSignal, awayAbbr: String, homeAbbr: String) {
    val (tint, lead) = when (val kind = signal.kind) {
        is TrendsSignal.Kind.Side -> hexColor(0x22C55EL) to "${kind.abbr} +${kind.gap.roundToInt()}"
        is TrendsSignal.Kind.Over -> hexColor(0x22C55EL) to "OVER"
        is TrendsSignal.Kind.Under -> hexColor(0x3B82F6L) to "UNDER"
    }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            lead,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            color = tint,
            modifier = Modifier
                .clip(CircleShape)
                .background(tint.copy(alpha = 0.16f))
                .padding(horizontal = 7.dp, vertical = 3.dp),
        )
        Column(Modifier.weight(1f)) {
            Text(signal.situationTitle, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary, maxLines = 1)
            Text(
                "${signal.metricLabel}: $awayAbbr ${pct(signal.awayPct)} · $homeAbbr ${pct(signal.homePct)}",
                fontSize = 10.sp,
                color = AppColors.appTextSecondary,
                maxLines = 1,
            )
        }
    }
}

private fun pct(v: Double?): String = if (v == null) "—" else "${v.roundToInt()}%"
