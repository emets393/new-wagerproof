package com.wagerproof.app.features.ncaab

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.gamecards.CFBTeamColors
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.app.features.gamecards.GameEdgeMath
import com.wagerproof.app.features.gamecards.GameRowCard
import com.wagerproof.app.features.gamecards.GameRowCardModel
import com.wagerproof.app.features.gamecards.TeamInitials
import com.wagerproof.core.models.NCAABGame

/**
 * NCAAB game row for the home Games feed — thin adapter over the shared
 * [GameRowCard], mirroring iOS `NCAABGameCard`. The fetch pipeline has already
 * joined `ncaab_team_mapping`, so the card uses its ESPN logos/abbreviations
 * and the production client's shared college brand-color resolver.
 */
@Composable
fun NCAABGameCard(
    game: NCAABGame,
    onPress: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val awayAbbr = game.awayTeamAbbrev?.trim().takeUnless { it.isNullOrEmpty() } ?: game.awayTeam
    val homeAbbr = game.homeTeamAbbrev?.trim().takeUnless { it.isNullOrEmpty() } ?: game.homeTeam

    val model = GameRowCardModel(
        id = game.id,
        league = "ncaab",
        dateLabel = GameCardFormatting.formatCompactDate(game.gameDate),
        timeLabel = GameCardFormatting.convertTimeToEST(game.gameTime),
        away = GameRowCardModel.TeamSide(
            abbr = awayAbbr,
            initials = TeamInitials.from(game.awayTeam),
            moneyline = game.awayMl,
            spread = game.awaySpread,
            logoURL = game.awayTeamLogo,
            colors = CFBTeamColors.colorPair(game.awayTeam),
        ),
        home = GameRowCardModel.TeamSide(
            abbr = homeAbbr,
            initials = TeamInitials.from(game.homeTeam),
            moneyline = game.homeMl,
            spread = game.homeSpread,
            logoURL = game.homeTeamLogo,
            colors = CFBTeamColors.colorPair(game.homeTeam),
        ),
        overLine = game.overLine,
        mlEdge = GameEdgeMath.mlEdge(
            modelHomeProb = game.homeAwayMlProb,
            homeMl = game.homeMl,
            awayMl = game.awayMl,
            homeAbbr = homeAbbr,
            awayAbbr = awayAbbr,
        ),
        ouEdge = GameEdgeMath.ouEdge(
            modelFairTotal = game.predTotalPoints,
            marketLine = game.overLine,
            ouResultProb = game.ouResultProb,
        ),
        awayTeamFullName = game.awayTeam,
        homeTeamFullName = game.homeTeam,
        oddsBreakdown = oddsBreakdown(game, awayAbbr, homeAbbr),
    )

    GameRowCard(model = model, onPress = onPress, modifier = modifier)
}

/** Spread / Money / Total scan-line table — Over on the away row, Under on home. */
private fun oddsBreakdown(
    game: NCAABGame,
    awayAbbr: String,
    homeAbbr: String,
): GameRowCardModel.OddsBreakdown {
    val hasTotal = game.overLine != null
    val totalText = GameCardFormatting.roundToNearestHalf(game.overLine)?.let {
        if (it % 1.0 == 0.0) it.toInt().toString() else it.toString()
    } ?: "—"
    return GameRowCardModel.OddsBreakdown(
        awaySpread = GameCardFormatting.formatSpread(game.awaySpread),
        homeSpread = GameCardFormatting.formatSpread(game.homeSpread),
        awayML = GameCardFormatting.formatMoneyline(game.awayMl),
        homeML = GameCardFormatting.formatMoneyline(game.homeMl),
        awayTotal = if (hasTotal) "O$totalText" else "—",
        homeTotal = if (hasTotal) "U$totalText" else "—",
    )
}
