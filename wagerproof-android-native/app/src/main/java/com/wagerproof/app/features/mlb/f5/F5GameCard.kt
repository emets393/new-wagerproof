package com.wagerproof.app.features.mlb.f5

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.mlb.MLBFormatting
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBF5
import com.wagerproof.core.models.MLBF5Game
import com.wagerproof.core.models.MLBF5PitchHand
import com.wagerproof.core.models.MLBF5SplitRow
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.app.features.mlb.MLBTeamLogo

/** One game's First-Five splits comparison card — port of iOS `F5GameCardView`. */
@Composable
fun F5GameCard(
    game: MLBF5Game,
    awaySplit: MLBF5SplitRow?,
    homeSplit: MLBF5SplitRow?,
    modifier: Modifier = Modifier,
) {
    var helpItem by remember { mutableStateOf<F5MetricHelp?>(null) }

    val awayOk = MLBF5.isShowable(awaySplit?.games)
    val homeOk = MLBF5.isShowable(homeSplit?.games)
    val awayDefense = F5Helpers.defenseFor(awaySplit, game.awaySpHand)
    val homeDefense = F5Helpers.defenseFor(homeSplit, game.homeSpHand)
    val recordColors = F5Helpers.betterHigher(awaySplit?.f5WinPct, homeSplit?.f5WinPct)
    val overColors = F5Helpers.betterHigher(awaySplit?.f5OverPct, homeSplit?.f5OverPct)
    val runsColors = F5Helpers.betterHigher(awaySplit?.avgF5Rs, homeSplit?.avgF5Rs)
    val seasonRunsColors = F5Helpers.betterHigher(awaySplit?.seasonAvgF5Rs, homeSplit?.seasonAvgF5Rs)
    val defenseColors = F5Helpers.betterLower(awayDefense?.avgRa, homeDefense?.avgRa)
    val seasonDefenseColors = F5Helpers.betterLower(awaySplit?.seasonAvgF5Ra, homeSplit?.seasonAvgF5Ra)
    val awayQualifier = "${game.awayAbbr} away vs ${MLBF5.pitchHandLabel(game.homeSpHand)}"
    val homeQualifier = "${game.homeAbbr} home vs ${MLBF5.pitchHandLabel(game.awaySpHand)}"

    val shape = RoundedCornerShape(26.dp)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.92f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .padding(14.dp),
    ) {
        Header(game)
        if (game.venueName != null || game.totalLine != null) {
            Text(
                venueLine(game),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.appTextSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 2.dp, bottom = 10.dp),
            )
        }

        TeamsRow(game)

        if (game.homeSpHand == MLBF5PitchHand.LEFT || game.awaySpHand == MLBF5PitchHand.LEFT) {
            Text(
                "* LHP split samples can be thin early in the season. Small samples show real data with caution.",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.appAccentAmber,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
            )
        }

        SectionTitle("⚾ Tonight's pitching matchup")
        CompareRow("⚾ Starting pitcher", "starting_pitcher", { helpItem = it },
            F5Cell.Text(pitcherText(game.awaySpName, game.awaySpHand), null),
            F5Cell.Text(pitcherText(game.homeSpName, game.homeSpHand), null))
        CompareRow("🎯 Opposing starter", "opposing_starter", { helpItem = it },
            F5Cell.Text(pitcherText(game.homeSpName, game.homeSpHand), null),
            F5Cell.Text(pitcherText(game.awaySpName, game.awaySpHand), null))
        CompareRow("📍 Location", "location", { helpItem = it },
            F5Cell.Text("On the Road", null), F5Cell.Text("At Home", null))

        SectionTitle("🔥 First-five offensive performance", "$awayQualifier · $homeQualifier")
        CompareRow("📊 Split W-L", "split_record", { helpItem = it },
            F5Cell.Text(if (awayOk) MLBF5.recordWithPct(awaySplit) else "Not enough", recordColors.first),
            F5Cell.Text(if (homeOk) MLBF5.recordWithPct(homeSplit) else "Not enough", recordColors.second),
            if (awayOk) F5Helpers.sampleText(awaySplit) else null,
            if (homeOk) F5Helpers.sampleText(homeSplit) else null)
        CompareRow("📈 O/U record", "ou_record", { helpItem = it },
            F5Cell.Text(if (awayOk) (awaySplit?.f5OuRecord ?: "-") else "-", overColors.first),
            F5Cell.Text(if (homeOk) (homeSplit?.f5OuRecord ?: "-") else "-", overColors.second),
            if (awayOk) "${MLBF5.formatPct(awaySplit?.f5OverPct)} over" else null,
            if (homeOk) "${MLBF5.formatPct(homeSplit?.f5OverPct)} over" else null)
        CompareRow("⚡ Split runs scored", "split_runs_scored", { helpItem = it },
            F5Cell.Text(if (awayOk) MLBF5.formatNumber(awaySplit?.avgF5Rs) else "-", runsColors.first),
            F5Cell.Text(if (homeOk) MLBF5.formatNumber(homeSplit?.avgF5Rs) else "-", runsColors.second),
            if (awayOk) F5Helpers.sampleText(awaySplit) else null,
            if (homeOk) F5Helpers.sampleText(homeSplit) else null)
        CompareRow("📅 Season runs scored", "season_runs_scored", { helpItem = it },
            F5Cell.Text(if (awayOk) MLBF5.formatNumber(awaySplit?.seasonAvgF5Rs) else "-", seasonRunsColors.first),
            F5Cell.Text(if (homeOk) MLBF5.formatNumber(homeSplit?.seasonAvgF5Rs) else "-", seasonRunsColors.second),
            "all games", "all games")
        CompareRow("↔️ Scoring delta", "scoring_delta", { helpItem = it },
            if (awaySplit != null) F5Cell.Diff(awaySplit.rsDiffVsSeason, false) else F5Cell.Text("-", null),
            if (homeSplit != null) F5Cell.Diff(homeSplit.rsDiffVsSeason, false) else F5Cell.Text("-", null),
            "split vs season", "split vs season")

        SectionTitle("🛡️ First-five defensive performance", "Own starter hand · green = fewer runs allowed")
        CompareRow("🛡️ Avg F5 runs allowed", "runs_allowed", { helpItem = it },
            F5Cell.Text(awayDefense?.let { "${MLBF5.formatNumber(it.avgRa)} (${MLBF5.formatDiff(it.diff)})" } ?: "-", defenseColors.first),
            F5Cell.Text(homeDefense?.let { "${MLBF5.formatNumber(it.avgRa)} (${MLBF5.formatDiff(it.diff)})" } ?: "-", defenseColors.second),
            F5Helpers.defenseSubtext(awaySplit, game.awaySpHand),
            F5Helpers.defenseSubtext(homeSplit, game.homeSpHand))
        CompareRow("📅 Season runs allowed", "season_runs_allowed", { helpItem = it },
            F5Cell.Text(if (awayOk) MLBF5.formatNumber(awaySplit?.seasonAvgF5Ra) else "-", seasonDefenseColors.first),
            F5Cell.Text(if (homeOk) MLBF5.formatNumber(homeSplit?.seasonAvgF5Ra) else "-", seasonDefenseColors.second),
            "all games", "all games")
        CompareRow("↔️ Allowed delta", "allowed_delta", { helpItem = it },
            if (awayDefense != null) F5Cell.Diff(awayDefense.diff, true) else F5Cell.Text("-", null),
            if (homeDefense != null) F5Cell.Diff(homeDefense.diff, true) else F5Cell.Text("-", null),
            "split vs season", "split vs season")
    }

    val help = helpItem
    if (help != null) {
        AlertDialog(
            onDismissRequest = { helpItem = null },
            confirmButton = { TextButton(onClick = { helpItem = null }) { Text("Got it") } },
            title = { Text(help.title) },
            text = { Text(help.body) },
        )
    }
}

@Composable
private fun Header(game: MLBF5Game) {
    Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                "${MLBFormatting.dateLabel(game.officialDate)} · ${MLBFormatting.gameTime(game.gameTimeEt)}".uppercase(),
                fontSize = 11.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextSecondary,
            )
            Text("${game.awayAbbr} @ ${game.homeAbbr}", fontSize = 18.sp, fontWeight = FontWeight.Black, color = AppColors.appTextPrimary, maxLines = 1)
        }
        Text(
            "F5 O/U ${game.f5TotalLine?.let { MLBF5.formatNumber(it, digits = 1) } ?: "-"}",
            fontSize = 11.sp, fontWeight = FontWeight.Black, color = AppColors.appTextSecondary,
            modifier = Modifier.clip(CircleShape).background(AppColors.appSurfaceMuted.copy(alpha = 0.7f)).padding(horizontal = 10.dp, vertical = 5.dp),
        )
    }
}

private fun venueLine(game: MLBF5Game): String {
    val parts = mutableListOf(game.venueName ?: "Venue TBD")
    game.totalLine?.let { parts.add("Game total ${MLBF5.formatNumber(it, digits = 1)}") }
    return parts.joinToString(" · ")
}

@Composable
private fun TeamsRow(game: MLBF5Game) {
    Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        TeamBlock(game.awayTeamName, game.awayAbbr, game.awaySpName, game.awaySpHand, game.f5AwayMl, Modifier.weight(1f))
        Icon(AppIcon.fromSystemName("at")?.imageVector ?: AppIcon.CHART_BAR_FILL.imageVector, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(16.dp))
        TeamBlock(game.homeTeamName, game.homeAbbr, game.homeSpName, game.homeSpHand, game.f5HomeMl, Modifier.weight(1f))
    }
}

@Composable
private fun TeamBlock(name: String, abbr: String, sp: String?, hand: MLBF5PitchHand?, ml: Double?, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(3.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        MLBTeamLogo(logoUrl = MLBTeams.info(name)?.logoUrl, abbrev = abbr, name = name, size = 46.dp)
        Text(
            "${sp ?: "Starter TBD"}${if (hand != null) " (${MLBF5.pitchHandLabel(hand)})" else ""}",
            fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary, maxLines = 1,
        )
        Text("F5 ML ${MLBF5.formatMoneyline(ml)}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = AppColors.appAccentBlue)
    }
}

@Composable
private fun SectionTitle(title: String, subtitle: String? = null) {
    Column(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.6f)))
        Spacer(Modifier.height(2.dp))
        Text(title, fontSize = 13.sp, fontWeight = FontWeight.Black, color = AppColors.appTextPrimary, textAlign = TextAlign.Center)
        subtitle?.let { Text(it, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextSecondary, textAlign = TextAlign.Center) }
    }
}

@Composable
private fun CompareRow(
    label: String,
    helpKey: String?,
    onHelp: (F5MetricHelp) -> Unit,
    away: F5Cell,
    home: F5Cell,
    awaySub: String? = null,
    homeSub: String? = null,
) {
    Column(Modifier.fillMaxWidth().padding(top = 9.dp)) {
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.45f)))
        Spacer(Modifier.height(9.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CellView(away, awaySub, Modifier.weight(1f))
            Column(
                Modifier
                    .width(116.dp)
                    .then(if (helpKey != null) Modifier.clickable { F5MetricHelp.all[helpKey]?.let(onHelp) } else Modifier),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextSecondary, textAlign = TextAlign.Center)
                if (helpKey != null) {
                    Icon(AppIcon.INFO_CIRCLE.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(9.dp))
                }
            }
            CellView(home, homeSub, Modifier.weight(1f))
        }
    }
}

@Composable
private fun CellView(cell: F5Cell, sub: String?, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        when (cell) {
            is F5Cell.Text -> Text(
                cell.value, fontSize = 12.sp, fontWeight = FontWeight.Black,
                color = cell.color ?: AppColors.appTextPrimary, textAlign = TextAlign.Center,
            )
            is F5Cell.Diff -> F5DiffText(cell.value, cell.goodWhenNegative)
        }
        sub?.let { Text(it, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextMuted, textAlign = TextAlign.Center) }
    }
}

@Composable
private fun F5DiffText(value: Double?, goodWhenNegative: Boolean) {
    if (value != null && value.isFinite()) {
        val isGood = if (goodWhenNegative) value < 0 else value > 0
        val isBad = if (goodWhenNegative) value > 0 else value < 0
        val color = if (isGood) AppColors.appWin else if (isBad) AppColors.appLoss else AppColors.appTextSecondary
        val icon = when {
            value > 0 -> "arrow.up"
            value < 0 -> "arrow.down"
            else -> "minus"
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            Icon(AppIcon.fromSystemName(icon)?.imageVector ?: AppIcon.CHART_LINE_UPTREND.imageVector, null, tint = color, modifier = Modifier.size(11.dp))
            Text(MLBF5.formatDiff(value), fontSize = 12.sp, fontWeight = FontWeight.Black, color = color)
        }
    } else {
        Text("-", fontSize = 12.sp, fontWeight = FontWeight.Black, color = AppColors.appTextPrimary)
    }
}

private fun pitcherText(name: String?, hand: MLBF5PitchHand?): String =
    "${name ?: "TBD"}${if (hand != null) " (${MLBF5.pitchHandLabel(hand)})" else ""}"

// MARK: - Cell + helpers

sealed interface F5Cell {
    data class Text(val value: String, val color: Color?) : F5Cell
    data class Diff(val value: Double?, val goodWhenNegative: Boolean) : F5Cell
}

object F5Helpers {
    fun betterHigher(a: Double?, b: Double?): Pair<Color?, Color?> {
        if (a == null || b == null || a == b) return null to null
        return if (a > b) AppColors.appWin to AppColors.appLoss else AppColors.appLoss to AppColors.appWin
    }

    fun betterLower(a: Double?, b: Double?): Pair<Color?, Color?> {
        if (a == null || b == null || a == b) return null to null
        return if (a < b) AppColors.appWin to AppColors.appLoss else AppColors.appLoss to AppColors.appWin
    }

    data class Defense(val games: Int, val avgRa: Double, val diff: Double)

    fun defenseFor(split: MLBF5SplitRow?, ownHand: MLBF5PitchHand?): Defense? {
        if (split == null || ownHand == null) return null
        val games = if (ownHand == MLBF5PitchHand.RIGHT) split.gamesWithOwnRhp else split.gamesWithOwnLhp
        val avgRa = if (ownHand == MLBF5PitchHand.RIGHT) split.avgF5RaWhenOwnRhp else split.avgF5RaWhenOwnLhp
        val diff = if (ownHand == MLBF5PitchHand.RIGHT) split.raDiffVsSeasonWhenOwnRhp else split.raDiffVsSeasonWhenOwnLhp
        if (!MLBF5.isShowable(games) || avgRa == null || diff == null) return null
        return Defense(games, avgRa, diff)
    }

    fun defenseSubtext(row: MLBF5SplitRow?, ownHand: MLBF5PitchHand?): String? {
        if (row == null || ownHand == null) return null
        val games = if (ownHand == MLBF5PitchHand.RIGHT) row.gamesWithOwnRhp else row.gamesWithOwnLhp
        if (!MLBF5.isShowable(games)) return null
        return "${games}g with ${if (ownHand == MLBF5PitchHand.RIGHT) "right" else "left"}-handed starter"
    }

    fun sampleText(row: MLBF5SplitRow?): String? {
        if (row == null) return null
        return if (row.games < MLBF5.Sample.SMALL) "${row.games} games · small sample" else "${row.games} games"
    }
}

/** 11-entry F5 glossary — port of iOS `F5MetricHelp.all`. */
data class F5MetricHelp(val id: String, val title: String, val body: String) {
    companion object {
        val all: Map<String, F5MetricHelp> = listOf(
            F5MetricHelp("starting_pitcher", "Starting pitcher", "The pitcher starting for each team tonight. Their throwing hand helps determine which team split is used."),
            F5MetricHelp("opposing_starter", "Opposing starter", "The pitcher each offense is facing tonight. Away teams are evaluated by away games vs this pitcher hand; home teams by home games vs this pitcher hand."),
            F5MetricHelp("location", "Location", "Shows whether each team is playing on the road or at home. F5 split records are separated by home/away context."),
            F5MetricHelp("split_record", "Split W-L", "First-five inning win-loss-tie record in the matching split: team location plus opposing starter hand."),
            F5MetricHelp("ou_record", "O/U record", "How often that team split went over or under the first-five total. The percent below shows over rate."),
            F5MetricHelp("split_runs_scored", "Split runs scored", "Average runs scored in the first five innings for this exact split: home/away plus opposing starter hand."),
            F5MetricHelp("season_runs_scored", "Season runs scored", "Team season average first-five runs scored across all games. Use it as the baseline for the split."),
            F5MetricHelp("scoring_delta", "Scoring delta", "Difference between split first-five runs scored and season average. Positive means this split scores more than usual."),
            F5MetricHelp("runs_allowed", "Avg F5 runs allowed", "Average first-five runs allowed when this team starts a pitcher with tonight's starter hand. Lower is better."),
            F5MetricHelp("season_runs_allowed", "Season runs allowed", "Team season average first-five runs allowed across all games. Use it as the baseline for the starter-hand split."),
            F5MetricHelp("allowed_delta", "Allowed delta", "Difference between starter-hand split runs allowed and season average. Negative means this team allows fewer first-five runs in this setup."),
        ).associateBy { it.id }

        val glossaryOrder = listOf(
            "starting_pitcher", "opposing_starter", "location",
            "split_record", "ou_record", "split_runs_scored", "season_runs_scored",
            "scoring_delta", "runs_allowed", "season_runs_allowed", "allowed_delta",
        )
    }
}
