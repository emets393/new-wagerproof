package com.wagerproof.app.features.gamecards.sheets

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.app.features.gamecards.GameCardTeamAvatar
import com.wagerproof.app.features.nfl.NFLMatchupHistoryRow
import com.wagerproof.app.features.nfl.NFLTeamColors
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Canonical iOS-parity head-to-head content. The NFL page and modal consume the
 * same `nfl_matchup_history` rows; there is no second `nfl_training_data` query
 * or competing summary implementation.
 */
@Composable
fun H2HHistoryContent(history: List<NFLMatchupHistoryRow>, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (history.isEmpty()) {
            Text(
                "No recent head-to-head games found.",
                color = AppColors.appTextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp),
            )
        } else {
            history.forEach { H2HHistoryRow(it) }
        }
    }
}

/** Modal wrapper for callers that need the same history outside the detail page. */
@Composable
fun H2HModal(
    awayTeam: String,
    homeTeam: String,
    history: List<NFLMatchupHistoryRow>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        SheetTitle(AppIcon.CLOCK_ARROW_2_CIRCLEPATH, "Head to Head", "$awayTeam vs $homeTeam")
        H2HHistoryContent(history)
    }
}

@Composable
private fun H2HHistoryRow(row: NFLMatchupHistoryRow) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.4f), shape)
            .border(1.dp, Color.White.copy(alpha = 0.08f), shape)
            .padding(11.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(historyDate(row), color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.weight(1f))
            if (row.neutralSite == true) Text("Neutral", color = AppColors.appAccentBlue, fontSize = 9.sp, fontWeight = FontWeight.Black)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MatchupTeam(row.awayTeam, row.awayScore)
            Text("@", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Black)
            MatchupTeam(row.homeTeam, row.homeScore)
            Spacer(Modifier.weight(1f))
            Text(
                "Total ${row.totalPoints ?: ((row.awayScore ?: 0) + (row.homeScore ?: 0))}",
                color = AppColors.appTextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            HistoryPill("Winner", row.winnerTeam ?: "—", AppColors.appPrimary)
            HistoryPill("Covered", row.coverTeam ?: row.atsResult ?: "Push", if (row.coverTeam == null) AppColors.appTextSecondary else hexColor(0x22C55E))
            HistoryPill("O/U", row.ouResult ?: "—", ouColor(row.ouResult))
        }
        Text(
            "Spread ${GameCardFormatting.formatSpread(row.closingSpreadHome)}  " +
                "Total ${half(row.closingTotal)}  " +
                "ML ${GameCardFormatting.formatMoneyline(row.closingMlAway)} / ${GameCardFormatting.formatMoneyline(row.closingMlHome)}",
            color = AppColors.appTextSecondary,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
        )
    }
}

@Composable
private fun MatchupTeam(abbr: String, score: Int?) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        GameCardTeamAvatar("nfl", abbr, 24.dp, colors = NFLTeamColors.colorPair(abbr))
        Text(abbr, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Black)
        Text(score?.toString() ?: "—", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun HistoryPill(label: String, value: String, color: Color) {
    Row(
        Modifier.background(color.copy(alpha = 0.1f), CircleShape).padding(horizontal = 7.dp, vertical = 5.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label.uppercase(Locale.US), color = AppColors.appTextSecondary, fontSize = 8.sp, fontWeight = FontWeight.Black)
        Text(value.uppercase(Locale.US), color = color, fontSize = 10.sp, fontWeight = FontWeight.Black)
    }
}

/** Full-height modal surface for an injected line-movement chart. */
@Composable
fun LineMovementModal(title: String, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        SheetTitle(AppIcon.CHART_LINE_UPTREND, title, "Opening-to-current market history")
        content()
    }
}

@Composable
private fun SheetTitle(icon: AppIcon, title: String, subtitle: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(38.dp).background(AppColors.appPrimary.copy(alpha = 0.13f), CircleShape), contentAlignment = Alignment.Center) {
            Icon(icon.imageVector, null, tint = AppColors.appPrimary, modifier = Modifier.size(19.dp))
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, color = AppColors.appTextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
        }
    }
}

private fun historyDate(row: NFLMatchupHistoryRow): String {
    val date = row.date ?: return row.season?.toString() ?: "Recent"
    return runCatching {
        LocalDate.parse(date.take(10)).format(DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US))
    }.getOrDefault(date)
}

private fun half(value: Double?): String = GameCardFormatting.roundToNearestHalf(value)?.let {
    if (it % 1.0 == 0.0) it.toInt().toString() else it.toString()
} ?: "—"

private fun ouColor(raw: String?): Color = when ((raw ?: "").uppercase(Locale.US)) {
    "OVER", "O" -> AppColors.appPrimary
    "UNDER", "U" -> AppColors.appAccentRed
    else -> AppColors.appTextSecondary
}
