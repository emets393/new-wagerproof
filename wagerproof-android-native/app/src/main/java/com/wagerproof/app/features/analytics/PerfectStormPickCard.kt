package com.wagerproof.app.features.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBAbbrLogo
import com.wagerproof.core.models.MLBModelBreakdownRow
import com.wagerproof.core.models.MLBPerfectStormRecord
import com.wagerproof.core.models.MLBPerfectStormRecords
import com.wagerproof.core.models.MLBPerfectStormTier
import com.wagerproof.core.models.MLBPickAlignment
import com.wagerproof.core.models.MLBPickAlignmentLevel
import com.wagerproof.core.models.MLBSuggestedPick

/**
 * Season-to-date record card per tier — visible even on days with zero
 * qualifying picks so the track record is always on screen (RN parity).
 */
@Composable
fun PerfectStormTierRecordsGrid(records: MLBPerfectStormRecords, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        MLBPerfectStormTier.entries.chunked(2).forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                pair.forEach { tier ->
                    TierRecordCard(
                        record = records.record(tier),
                        config = PerfectStormTierDisplay.config(tier),
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun TierRecordCard(
    record: MLBPerfectStormRecord,
    config: PerfectStormTierDisplay.Config,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .clip(RoundedCornerShape(8.dp))
            .background(config.color.copy(alpha = 0.05f))
            .border(1.dp, config.color.copy(alpha = 0.33f), RoundedCornerShape(8.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Text(
            text = config.cardLabel.uppercase(),
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = config.color,
        )
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = record.recordString,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.appTextPrimary,
            )
            Text(
                text = record.winPct?.let { Regression.trimmed(it) + "%" } ?: "—",
                fontSize = 10.sp,
                color = AppColors.appTextSecondary,
            )
        }
        Text(
            text = record.roiPct?.let { Regression.signed(it, 1) + "% ROI" } ?: "—",
            fontSize = 10.sp,
            color = if ((record.roiPct ?: 0.0) >= 0) Regression.winGreen else Regression.lossRed,
        )
    }
}

/**
 * One Regression Report suggested pick: tier badge, matchup with logos,
 * edge/bucket stats, per-pick model-alignment context, reasoning quote. Tier
 * color is the only conviction signal. Port of iOS `PerfectStormPickCard`.
 */
@Composable
fun PerfectStormPickCard(
    pick: MLBSuggestedPick,
    reportDate: String,
    breakdownRows: List<MLBModelBreakdownRow>,
    modifier: Modifier = Modifier,
) {
    val tier = PerfectStormTierDisplay.config(pick.perfectStormTier)
    RegressionAccentRow(color = tier.color, dim = pick.locked ?: false, modifier = modifier) {
        Column(Modifier.fillMaxWidth()) {
            TierPill(tier)
            HeaderRow(pick, Modifier.padding(top = 6.dp))
            MatchupRow(pick, Modifier.padding(top = 3.dp))

            Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                RegressionStat("EDGE", edgeText(pick), Modifier.weight(1f))
                RegressionStat("BUCKET", pick.edgeBucket, Modifier.weight(1f))
            }

            AlignmentBox(pick, reportDate, breakdownRows, Modifier.padding(top = 10.dp))

            val reasoning = pick.reasoning
            if (!reasoning.isNullOrEmpty()) {
                Text(
                    text = reasoning,
                    fontSize = 12.sp,
                    fontStyle = FontStyle.Italic,
                    lineHeight = 15.sp,
                    color = AppColors.appTextSecondary,
                    modifier = Modifier
                        .padding(top = 10.dp)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(6.dp))
                        .background(AppColors.appSurfaceMuted.copy(alpha = 0.5f))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                )
            }

            Footer(pick, tier, Modifier.padding(top = 10.dp))
        }
    }
}

@Composable
private fun TierPill(tier: PerfectStormTierDisplay.Config) {
    Row(
        Modifier
            .clip(CircleShape)
            .background(tier.color)
            .padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(
            imageVector = AppIcon.BOLT_FILL.imageVector,
            contentDescription = null,
            tint = Color(0xFF0A0A0A),
            modifier = Modifier.size(9.dp),
        )
        Text(
            text = tier.badge,
            fontSize = 9.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 0.6.sp,
            color = Color(0xFF0A0A0A),
        )
    }
}

@Composable
private fun HeaderRow(pick: MLBSuggestedPick, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Text(
            text = pick.pick,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = AppColors.appTextPrimary,
            maxLines = 2,
            modifier = Modifier.weight(1f),
        )
        val time = Regression.gameTimeET(pick.gameTimeEt)
        if (time != null) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Icon(
                    imageVector = AppIcon.CLOCK.imageVector,
                    contentDescription = null,
                    tint = AppColors.appTextSecondary,
                    modifier = Modifier.size(11.dp),
                )
                Text(text = time, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary)
            }
        }
    }
}

@Composable
private fun MatchupRow(pick: MLBSuggestedPick, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        TeamBadge(pick.awayTeam)
        Text("@", fontSize = 12.sp, color = AppColors.appTextSecondary)
        TeamBadge(pick.homeTeam)

        // Badge BOTH games of a doubleheader; game_number >= 2 is the fallback
        // for picks generated before is_doubleheader existed.
        if (pick.isDoubleheader == true || (pick.gameNumber ?: 1) >= 2) {
            Text(
                text = "GAME ${pick.gameNumber ?: 1} of DH",
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.4.sp,
                color = Regression.warnAmber,
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(Regression.warnAmber.copy(alpha = 0.18f))
                    .border(1.dp, Regression.warnAmber.copy(alpha = 0.4f), RoundedCornerShape(4.dp))
                    .padding(horizontal = 6.dp, vertical = 1.dp),
            )
        }
    }
}

@Composable
private fun TeamBadge(teamName: String) {
    val abbr = MLBPickAlignment.teamNameToGameLogAbbr(teamName)
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        val url = MLBAbbrLogo.url(abbr)
        if (url != null) {
            RemoteImage(url = url, contentDescription = abbr, modifier = Modifier.size(16.dp))
        }
        Text(text = abbr ?: teamName, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
    }
}

private fun edgeText(pick: MLBSuggestedPick): String {
    val sign = if (pick.edgeAtSuggestion > 0) "+" else ""
    val suffix = if (pick.betType.contains("ml")) "%" else ""
    return sign + Regression.trimmed(pick.edgeAtSuggestion) + suffix
}

@Composable
private fun AlignmentBox(
    pick: MLBSuggestedPick,
    reportDate: String,
    breakdownRows: List<MLBModelBreakdownRow>,
    modifier: Modifier = Modifier,
) {
    // Older picks lack game_time_et — fall back to the report date so the
    // day-of-week lookup still works.
    val align = MLBPickAlignment.compute(
        betType = pick.betType,
        pick = pick.pick,
        homeTeam = pick.homeTeam,
        awayTeam = pick.awayTeam,
        gameTimeEt = pick.gameTimeEt ?: reportDate,
        rows = breakdownRows,
    )
    if (align.level == MLBPickAlignmentLevel.NEUTRAL && align.dow == null && align.teams.isEmpty()) return

    val display = alignmentDisplay(align.level)
    val dowFallback = (align.dowLabel?.let { "$it " } ?: "") + "data unavailable"
    val dowLine = formatAlignmentRow("Day trend", align.dow, dowFallback)
    val teamLines = align.teams.map { formatAlignmentRow("Team", it, "Unavailable").replace("Team: ", "") }

    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(display.color.copy(alpha = 0.1f))
            .border(1.dp, display.color.copy(alpha = 0.33f), RoundedCornerShape(6.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text("${display.emoji} ${display.label}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = display.color)
        Text(
            "Model context: this compares this pick to historical win rate and ROI for the same bet type.",
            fontSize = 11.sp,
            color = AppColors.appTextSecondary,
        )
        Text(dowLine, fontSize = 11.sp, color = AppColors.appTextSecondary)
        Text("Team Trends", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextSecondary)
        if (teamLines.isEmpty()) {
            Text("No team trend data available for this pick", fontSize = 11.sp, color = AppColors.appTextSecondary)
        } else {
            teamLines.forEach { Text(it, fontSize = 11.sp, color = AppColors.appTextSecondary) }
        }
        Text(
            "Higher Win% and positive ROI strengthen alignment; weak trends lower confidence.",
            fontSize = 10.sp,
            color = AppColors.appTextSecondary,
        )
    }
}

private data class AlignmentDisplay(val label: String, val emoji: String, val color: Color)

private fun alignmentDisplay(level: MLBPickAlignmentLevel): AlignmentDisplay = when (level) {
    MLBPickAlignmentLevel.STRONG -> AlignmentDisplay("Strong alignment", "★", Color(0xFF22C55E))
    MLBPickAlignmentLevel.ALIGNED -> AlignmentDisplay("Aligned", "✓", Color(0xFF86EFAC))
    MLBPickAlignmentLevel.NEUTRAL -> AlignmentDisplay("Neutral", "·", Color(0xFF94A3B8))
    MLBPickAlignmentLevel.MIXED -> AlignmentDisplay("Mixed signals", "~", Color(0xFFFACC15))
    MLBPickAlignmentLevel.CONCERN -> AlignmentDisplay("Concerning trends", "⚠", Color(0xFFEF4444))
}

private fun formatAlignmentRow(label: String, row: MLBModelBreakdownRow?, fallback: String): String {
    if (row == null) return "$label: $fallback"
    val record = "${row.wins}-${row.losses}" + if (row.pushes > 0) "-${row.pushes}" else ""
    val roi = (if (row.roiPct > 0) "+" else "") + Regression.trimmed(row.roiPct) + "%"
    return "$label: ${row.breakdownValue} • $record • ${Regression.trimmed(row.winPct)}% W • $roi ROI"
}

@Composable
private fun Footer(pick: MLBSuggestedPick, tier: PerfectStormTierDisplay.Config, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = Regression.betTypeLabel(pick.betType),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = tier.color,
            modifier = Modifier
                .clip(RoundedCornerShape(5.dp))
                .background(tier.color.copy(alpha = 0.1f))
                .padding(horizontal = 7.dp, vertical = 3.dp),
        )
        if (pick.locked == true) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Icon(
                    imageVector = AppIcon.LOCK_FILL.imageVector,
                    contentDescription = null,
                    tint = AppColors.appTextSecondary,
                    modifier = Modifier.size(9.dp),
                )
                Text("LOCKED", fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.5.sp, color = AppColors.appTextSecondary)
            }
        }
        Spacer(Modifier.weight(1f))
    }
}
