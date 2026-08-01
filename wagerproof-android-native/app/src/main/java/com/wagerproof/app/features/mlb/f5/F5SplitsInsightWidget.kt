package com.wagerproof.app.features.mlb.f5

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamewidgets.InsightExpandFooter
import com.wagerproof.app.features.gamewidgets.InsightVerdictLine
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.F5CompareRow
import com.wagerproof.core.models.F5InsightSummary
import com.wagerproof.core.models.MatchupSide
import com.wagerproof.core.models.MLBF5

private val F5Accent = Color(0xFF0EA5E9)

/**
 * "First-5 Innings" insight widget — port of iOS `F5SplitsInsightWidget`. Renders
 * the `MLBF5Insight` digest (verdict line + qualifier + the three compare rows
 * over tug bars). Expanding presents the full 11-row `F5GameCard` breakdown.
 *
 * FIDELITY-WAIVER #240: iOS composes with `InsightWidgetSection`, which isn't
 * ported — this is the same self-contained digest card the sibling insight
 * widgets use (header + verdict + rows + expand footer).
 */
@Composable
fun F5SplitsInsightWidget(
    summary: F5InsightSummary,
    onExpand: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(18.dp)
    Column(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.92f))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(
                AppIcon.fromSystemName("baseball.diamond.bases")?.imageVector ?: AppIcon.CHART_BAR_FILL.imageVector,
                null, tint = F5Accent, modifier = Modifier.size(16.dp),
            )
            Text("First-5 Innings", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary)
            Box(Modifier.weight(1f))
            val badgeColor = hexColor(summary.badge.tintHex)
            Text(
                summary.badge.text,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.4.sp,
                color = badgeColor,
                modifier = Modifier.clip(CircleShape).background(badgeColor.copy(alpha = 0.16f)).padding(horizontal = 8.dp, vertical = 3.dp),
            )
        }
        Text(
            summary.headline,
            fontSize = 17.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.Bold,
            color = AppColors.appTextPrimary,
            modifier = Modifier.semantics { contentDescription = "First-five summary: ${summary.headline}" },
        )
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Top) {
            Icon(
                AppIcon.SCOPE.imageVector,
                null, tint = AppColors.appTextSecondary, modifier = Modifier.size(12.dp).padding(top = 2.dp),
            )
            Text(
                summary.qualifier,
                fontSize = 11.sp, lineHeight = 15.sp, fontWeight = FontWeight.Medium, color = AppColors.appTextSecondary,
            )
        }
        InsightVerdictLine(summary.verdicts)
        F5EvidenceBoard(summary)
        summary.sampleWarning?.let {
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(AppColors.appAccentAmber.copy(alpha = 0.10f))
                    .padding(horizontal = 10.dp, vertical = 7.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Icon(
                    AppIcon.EXCLAMATION_TRIANGLE.imageVector, null,
                    tint = AppColors.appAccentAmber, modifier = Modifier.size(11.dp).padding(top = 1.dp),
                )
                Text(it, fontSize = 10.sp, lineHeight = 14.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appAccentAmber)
            }
        }
        InsightExpandFooter(label = "Full F5 breakdown", onTap = onExpand)
    }
}

/**
 * The three compare rows under a header that names the columns — port of iOS
 * `F5EvidenceBoard`. Without the abbr + "N games" header the tug bars are
 * anonymous numerals, and the sample size is the whole point: these are matched
 * splits, often only a handful of games per side.
 */
@Composable
private fun F5EvidenceBoard(summary: F5InsightSummary, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.30f))
            .border(0.75.dp, AppColors.appBorder.copy(alpha = 0.45f), shape)
            .padding(horizontal = 12.dp),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "EVIDENCE",
                fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.7.sp,
                color = AppColors.appTextMuted, modifier = Modifier.width(104.dp),
            )
            TeamHeader(summary.awayAbbr, summary.awaySampleSize, Modifier.weight(1f))
            TeamHeader(summary.homeAbbr, summary.homeSampleSize, Modifier.weight(1f))
        }
        summary.rows.forEach { row ->
            Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.45f)))
            F5CompareRowView(row, Modifier.padding(vertical = 10.dp))
        }
    }
}

@Composable
private fun TeamHeader(abbr: String, sampleSize: Int?, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(1.dp)) {
        Text(abbr, fontSize = 12.sp, fontWeight = FontWeight.Black, color = AppColors.appTextPrimary, maxLines = 1)
        Text(
            sampleSize?.let { "$it games" } ?: "No sample",
            fontSize = 9.sp, fontWeight = FontWeight.Medium, color = AppColors.appTextMuted, maxLines = 1,
        )
    }
}

@Composable
private fun F5CompareRowView(row: F5CompareRow, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(row.title, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.4.sp, color = AppColors.appTextSecondary)
        F5SplitBar(
            awayValue = row.awayValue,
            homeValue = row.homeValue,
            awayNumeral = row.awayNumeral,
            homeNumeral = row.homeNumeral,
            awayTint = tint(row, MatchupSide.AWAY),
            homeTint = tint(row, MatchupSide.HOME),
        )
        if (row.awayDelta != null || row.homeDelta != null) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                DeltaLabel(row.awayDelta, row.goodWhenNegative)
                DeltaLabel(row.homeDelta, row.goodWhenNegative)
            }
        }
    }
}

/** Local split bar with string numerals (the shared bar renders Int numerals). */
@Composable
private fun F5SplitBar(
    awayValue: Double?,
    homeValue: Double?,
    awayNumeral: String,
    homeNumeral: String,
    awayTint: Color,
    homeTint: Color,
) {
    val a = awayValue ?: 0.0
    val h = homeValue ?: 0.0
    val total = (a + h).coerceAtLeast(0.0001)
    val awayFrac = if (awayValue == null || homeValue == null) 0.5f else (a / total).toFloat()
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(awayNumeral, fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = AppColors.appTextSecondary)
        Row(Modifier.weight(1f).height(8.dp).padding(horizontal = 6.dp).clip(CircleShape)) {
            Box(Modifier.weight(awayFrac.coerceIn(0.01f, 0.99f)).fillMaxWidth().height(8.dp).background(awayTint.copy(alpha = 0.85f)))
            Box(Modifier.weight((1f - awayFrac).coerceIn(0.01f, 0.99f)).fillMaxWidth().height(8.dp).background(homeTint.copy(alpha = 0.85f)))
        }
        Text(homeNumeral, fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = AppColors.appTextSecondary)
    }
}

@Composable
private fun DeltaLabel(delta: Double?, goodWhenNegative: Boolean) {
    if (delta == null || !delta.isFinite()) {
        Box(Modifier.size(1.dp))
        return
    }
    val isGood = if (goodWhenNegative) delta < 0 else delta > 0
    val isBad = if (goodWhenNegative) delta > 0 else delta < 0
    val color = if (isGood) AppColors.appWin else if (isBad) AppColors.appLoss else AppColors.appTextSecondary
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        Icon(
            when {
                delta > 0 -> AppIcon.fromSystemName("arrow.up")?.imageVector ?: AppIcon.CHART_LINE_UPTREND.imageVector
                delta < 0 -> AppIcon.fromSystemName("arrow.down")?.imageVector ?: AppIcon.CHART_LINE_UPTREND.imageVector
                else -> AppIcon.fromSystemName("minus")?.imageVector ?: AppIcon.CHART_LINE_UPTREND.imageVector
            },
            null, tint = color, modifier = Modifier.size(9.dp),
        )
        Text("${MLBF5.formatDiff(delta, digits = 1)} vs season", fontSize = 9.sp, fontWeight = FontWeight.SemiBold, color = color)
    }
}

/** winPct halves get their own pct color; runs rows tint the advantaged side. */
private fun tint(row: F5CompareRow, side: MatchupSide): Color {
    val value = if (side == MatchupSide.AWAY) row.awayValue else row.homeValue
    if (value == null) return AppColors.appBorder
    return when (row.metric) {
        F5CompareRow.Metric.WIN_PCT -> trendsPctColor(value)
        F5CompareRow.Metric.RUNS_SCORED, F5CompareRow.Metric.RUNS_ALLOWED ->
            if (row.advantage == side) AppColors.appWin else AppColors.appBorder
    }
}

/** Approximate `trendsPctColor` — pct halves tinted by strength. */
private fun trendsPctColor(v: Double?): Color = when {
    v == null -> AppColors.appBorder
    v >= 55 -> AppColors.appWin
    v <= 45 -> AppColors.appLoss
    else -> AppColors.appTextSecondary
}
