package com.wagerproof.app.features.analytics.historical

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ShowChart
import androidx.compose.material.icons.rounded.SwapVert
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AnalysisSystemCopy
import com.wagerproof.core.models.AnalysisSystemRecord
import com.wagerproof.core.models.HistoricalAnalysisBetType
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.SystemTemperature

/**
 * Shared chrome for the saved-systems surfaces (Save System sheet, My Systems,
 * Systems Leaderboard). Port of the pieces iOS keeps in
 * `Features/Analytics/SystemsLeaderboardViews.swift`, rendered with Material
 * surfaces instead of Liquid Glass.
 */

/** Market label for a saved row's `bet_type`, falling back to the raw value. */
internal fun systemMarketLabel(betType: String): String =
    HistoricalAnalysisBetType.entries.firstOrNull { it.raw == betType }?.label
        ?: betType.uppercase()

/**
 * Chip labels for a SAVED snapshot. Wrapped because these snapshots come from other
 * platforms and older schema versions — a chip builder that trips on one weird
 * restored blob must not take the whole Systems sheet down with it (web does the
 * same in `analysisSystemsService.filterChipLabels`).
 */
internal fun systemFilterLabels(
    sport: HistoricalAnalysisSport,
    snapshot: HistoricalAnalysisUISnapshot?,
): List<String> {
    if (snapshot == null) return emptyList()
    return runCatching { HistoricalAnalysisCopy.filterChipLabels(sport, snapshot) }.getOrDefault(emptyList())
}

/**
 * A system uses the same rounded-square identity footprint as an agent, but a
 * neutral rules icon keeps the two objects distinct.
 */
@Composable
internal fun SystemGlyph(
    sport: HistoricalAnalysisSport,
    betType: String,
    size: Dp = 44.dp,
) {
    val icon = when {
        AnalysisSystemCopy.isTotalMarket(betType, sport) -> Icons.Rounded.SwapVert
        betType.contains("spread") || betType == "rl" || betType == "f5_rl" -> Icons.Rounded.ShowChart
        else -> Icons.Rounded.Tune
    }
    Box(
        Modifier
            .size(size)
            .clip(RoundedCornerShape(size * 0.27f))
            .background(AppColors.appSurfaceMuted)
            .border(0.5.dp, AppColors.appBorder, RoundedCornerShape(size * 0.27f)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, null, Modifier.size(size * 0.42f), tint = AppColors.appPrimary)
    }
}

/** Elevated card body shared by saved / leaderboard rows and their detail panes. */
@Composable
internal fun SystemCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier
            .clip(RoundedCornerShape(18.dp))
            .background(AppColors.appSurfaceElevated)
            .border(0.5.dp, AppColors.appBorder, RoundedCornerShape(18.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        content = content,
    )
}

/**
 * Compact chip row describing a saved snapshot. Labels come from the one canonical
 * chip builder, so a saved system can never describe itself differently from the
 * screen that produced it.
 */
@Composable
internal fun SystemFilterSummary(labels: List<String>, limit: Int = 2) {
    if (labels.isEmpty()) {
        Text("No extra filters", color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        return
    }
    Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
        labels.take(limit).forEach { label ->
            SystemChip(label)
        }
        if (labels.size > limit) SystemChip("+${labels.size - limit}")
    }
}

@Composable
private fun SystemChip(label: String) {
    Text(
        label,
        color = AppColors.appTextSecondary,
        fontSize = 9.sp,
        fontWeight = FontWeight.Bold,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(AppColors.appSurfaceMuted)
            .padding(horizontal = 7.dp, vertical = 4.dp),
    )
}

/** 🔥 / ❄️ card accent; NEUTRAL renders nothing, same as iOS. */
@Composable
internal fun SystemTemperatureBadge(temperature: SystemTemperature) {
    when (temperature) {
        SystemTemperature.FIRE -> Text("🔥", fontSize = 15.sp)
        SystemTemperature.ICE -> Text("❄️", fontSize = 15.sp)
        SystemTemperature.NEUTRAL -> Unit
    }
}

/** Small labelled stat used by both detail panes. */
@Composable
internal fun SystemMetric(label: String, value: String, valueColor: Color = AppColors.appTextPrimary) {
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(label, color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.5.sp)
        Text(value, color = valueColor, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

internal fun recordRoiText(record: AnalysisSystemRecord?): String =
    record?.roi?.let { "${AnalysisSystemCopy.signedNumber(it)}%" } ?: "—"

internal fun recordUnitsText(record: AnalysisSystemRecord?): String =
    record?.units?.let { "${AnalysisSystemCopy.signedNumber(it)}u" } ?: "—"

internal fun metricTint(value: Double?): Color = when {
    value == null -> AppColors.appTextSecondary
    value >= 0 -> AppColors.appWin
    else -> AppColors.appLoss
}
