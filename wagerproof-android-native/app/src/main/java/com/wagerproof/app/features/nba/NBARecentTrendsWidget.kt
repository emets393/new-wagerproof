package com.wagerproof.app.features.nba

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.GameCardTeamAvatar
import com.wagerproof.app.features.gamecards.NBATeams
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NBAGameTrends
import java.util.Locale
import kotlin.math.roundToInt

/**
 * NBA recent-trends widget — port of iOS `NBARecentTrendsWidget`. Chromeless
 * collapsible 10-metric head-to-head table with directional color coding
 * (better = green/appPrimary, worse = red; `lowerIsBetter` inverts for the
 * defensive-rating trend row; O/U % is intentionally uncolored).
 */
@Composable
fun NBARecentTrendsWidget(
    awayTeam: String,
    homeTeam: String,
    trends: NBAGameTrends?,
    isLoading: Boolean,
    expanded: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxWidth()) {
        when {
            isLoading -> Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
            }
            expanded -> Content(awayTeam, homeTeam, trends)
            else -> Text(
                "Tap to view recent head-to-head trends",
                color = AppColors.appTextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

@Composable
private fun Content(awayTeam: String, homeTeam: String, trends: NBAGameTrends?) {
    if (trends == null) {
        Column(
            Modifier.fillMaxWidth().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AppIcon.fromSystemName("info.circle")?.let {
                Icon(it.imageVector, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(32.dp))
            }
            Text("No trend data available for this matchup", color = AppColors.appTextSecondary, fontSize = 14.sp)
        }
        return
    }
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 12.dp).padding(bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(70.dp), contentAlignment = Alignment.Center) {
                GameCardTeamAvatar(sport = "nba", team = awayTeam, diameter = 32.dp, colors = NBATeams.colorPair(awayTeam))
            }
            Text(
                "METRIC",
                color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center, modifier = Modifier.weight(1f),
            )
            Box(Modifier.width(70.dp), contentAlignment = Alignment.Center) {
                GameCardTeamAvatar(sport = "nba", team = homeTeam, diameter = 32.dp, colors = NBATeams.colorPair(homeTeam))
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(AppColors.appBorder))
        metrics(trends).forEachIndexed { index, metric ->
            MetricRow(metric, index)
        }
    }
}

private class Metric(
    val name: String,
    val awayValue: Double?,
    val homeValue: Double?,
    val format: (Double?) -> String,
    val lowerIsBetter: Boolean = false,
    val noColor: Boolean = false,
)

private fun metrics(t: NBAGameTrends): List<Metric> = listOf(
    Metric("Overall Rating", t.awayOvrRtg, t.homeOvrRtg, ::formatDecimal2),
    Metric("Consistency Rating", t.awayConsistency, t.homeConsistency, ::formatDecimal2),
    Metric("Win Streak", t.awayWinStreak, t.homeWinStreak, ::formatInt),
    Metric("ATS %", t.awayAtsPct, t.homeAtsPct, ::formatPercent),
    Metric("ATS Streak", t.awayAtsStreak, t.homeAtsStreak, ::formatInt),
    Metric("Last Game Score Margin", t.awayLastMargin, t.homeLastMargin, ::formatDecimal1),
    Metric("Over/Under %", t.awayOverPct, t.homeOverPct, ::formatPercent, noColor = true),
    Metric("Pace Trend (Last 3)", t.awayAdjPacePregameL3Trend, t.homeAdjPacePregameL3Trend, ::formatDecimal2),
    Metric("Off. Rating Trend (L3)", t.awayAdjOffRtgPregameL3Trend, t.homeAdjOffRtgPregameL3Trend, ::formatDecimal2),
    Metric("Def. Rating Trend (L3)", t.awayAdjDefRtgPregameL3Trend, t.homeAdjDefRtgPregameL3Trend, ::formatDecimal2, lowerIsBetter = true),
)

@Composable
private fun MetricRow(m: Metric, index: Int) {
    val awayColor = trendColor(m.awayValue, m.homeValue, m.lowerIsBetter, m.noColor)
    val homeColor = trendColor(m.homeValue, m.awayValue, m.lowerIsBetter, m.noColor)
    Row(
        Modifier
            .fillMaxWidth()
            .background(if (index % 2 == 0) AppColors.appTextMuted.copy(alpha = 0.04f) else Color.Transparent)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            m.format(m.awayValue),
            color = awayColor, fontSize = 13.sp, fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center, modifier = Modifier.width(70.dp),
        )
        Text(
            m.name,
            color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center, modifier = Modifier.weight(1f),
        )
        Text(
            m.format(m.homeValue),
            color = homeColor, fontSize = 13.sp, fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center, modifier = Modifier.width(70.dp),
        )
    }
}

private fun trendColor(my: Double?, other: Double?, lowerIsBetter: Boolean, noColor: Boolean): Color {
    if (noColor) return AppColors.appTextPrimary
    if (my == null || other == null) return AppColors.appTextPrimary
    return if (lowerIsBetter) {
        when {
            my < other -> AppColors.appPrimary
            my > other -> AppColors.appAccentRed
            else -> AppColors.appTextPrimary
        }
    } else {
        when {
            my > other -> AppColors.appPrimary
            my < other -> AppColors.appAccentRed
            else -> AppColors.appTextPrimary
        }
    }
}

private fun formatDecimal2(v: Double?): String = v?.let { String.format(Locale.US, "%.2f", it) } ?: "-"
private fun formatDecimal1(v: Double?): String = v?.let { String.format(Locale.US, "%.1f", it) } ?: "-"
private fun formatPercent(v: Double?): String = v?.let { String.format(Locale.US, "%.1f%%", it * 100) } ?: "-"
private fun formatInt(v: Double?): String = v?.let { it.roundToInt().toString() } ?: "-"
