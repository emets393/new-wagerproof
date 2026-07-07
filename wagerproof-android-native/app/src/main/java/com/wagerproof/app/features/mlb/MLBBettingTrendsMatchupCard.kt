package com.wagerproof.app.features.mlb

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.app.features.gamecards.GameCardTeamAvatar
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBGameTrends
import com.wagerproof.core.models.MLBSituationalTrendRow
import com.wagerproof.core.models.MLBTeams

/**
 * Compact matchup row for the MLB Betting Trends list screen — port of iOS
 * `MLBBettingTrendsMatchupCardView`. A 4-stop team-color stripe over away/home
 * avatar columns with the ET tipoff chip between them; tapping routes the parent
 * to `BettingTrendsDetailSheet`.
 */
@Composable
fun MLBBettingTrendsMatchupCard(
    game: MLBGameTrends,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(26.dp)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.92f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .clickable(onClick = onTap),
    ) {
        stripe(game)
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            teamColumn(game.awayTeam, Modifier.weight(1f))
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("@", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary.copy(alpha = 0.5f))
                Text(
                    formatGameTime(game.gameTimeEt),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.appTextSecondary,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(AppColors.appSurfaceMuted)
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }
            teamColumn(game.homeTeam, Modifier.weight(1f))
            Icon(AppIcon.CHEVRON_RIGHT.imageVector, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(14.dp))
        }
    }
}

@Composable
private fun stripe(game: MLBGameTrends) {
    val aw = MLBTeams.colors(game.awayTeam.teamName)
    val hm = MLBTeams.colors(game.homeTeam.teamName)
    Box(
        Modifier
            .fillMaxWidth()
            .height(4.dp)
            .background(
                Brush.horizontalGradient(
                    listOf(hexColor(aw.primary), hexColor(aw.secondary), hexColor(hm.primary), hexColor(hm.secondary)),
                ),
            ),
    )
}

@Composable
private fun teamColumn(team: MLBSituationalTrendRow, modifier: Modifier = Modifier) {
    val abbr = MLBTeams.displayById(team.teamId)?.abbrev ?: fallbackAbbrev(team.teamName)
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        GameCardTeamAvatar(sport = "mlb", team = team.teamName, diameter = 48.dp)
        Text(abbr, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary, maxLines = 1)
    }
}

private fun fallbackAbbrev(name: String): String {
    val last = name.split(" ").lastOrNull() ?: return "—"
    return last.take(3).uppercase()
}

private fun formatGameTime(raw: String?): String {
    if (raw.isNullOrEmpty()) return "TBD"
    return GameCardFormatting.convertTimeToEST(raw)
}
