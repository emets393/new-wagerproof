package com.wagerproof.app.features.nba

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.app.features.gamecards.GameEdgeMath
import com.wagerproof.app.features.gamecards.GameRowCard
import com.wagerproof.app.features.gamecards.GameRowCardModel
import com.wagerproof.app.features.gamecards.NBATeams
import com.wagerproof.core.models.GameAgentConsensus
import com.wagerproof.core.models.NBAGame
import java.util.Locale
import kotlin.math.floor

/**
 * NBA game row for the home Games feed — a thin adapter over the shared
 * [GameRowCard], mirroring iOS `NBAGameCard`. NBA ships a `modelFairTotal`, so
 * the O/U row gets the full triplet. Logos are the ESPN marks from [NBATeams].
 */
@Composable
fun NBAGameCard(
    game: NBAGame,
    onPress: () -> Unit,
    modifier: Modifier = Modifier,
    consensus: GameAgentConsensus? = null,
    signalCount: Int = 0,
) {
    val model = GameRowCardModel(
        id = game.id,
        league = "nba",
        dateLabel = GameCardFormatting.formatCompactDate(game.gameDate),
        timeLabel = GameCardFormatting.convertTimeToEST(game.gameTime),
        away = GameRowCardModel.TeamSide(
            abbr = NBATeams.abbreviation(game.awayTeam),
            initials = NBATeams.abbreviation(game.awayTeam),
            moneyline = game.awayMl,
            spread = game.awaySpread,
            logoURL = NBATeams.logoURL(game.awayTeam),
            colors = NBATeams.colorPair(game.awayTeam),
        ),
        home = GameRowCardModel.TeamSide(
            abbr = NBATeams.abbreviation(game.homeTeam),
            initials = NBATeams.abbreviation(game.homeTeam),
            moneyline = game.homeMl,
            spread = game.homeSpread,
            logoURL = NBATeams.logoURL(game.homeTeam),
            colors = NBATeams.colorPair(game.homeTeam),
        ),
        overLine = game.overLine,
        mlEdge = GameEdgeMath.mlEdge(
            modelHomeProb = game.homeAwayMlProb,
            homeMl = game.homeMl,
            awayMl = game.awayMl,
            homeAbbr = NBATeams.abbreviation(game.homeTeam),
            awayAbbr = NBATeams.abbreviation(game.awayTeam),
        ),
        ouEdge = GameEdgeMath.ouEdge(
            modelFairTotal = game.modelFairTotal,
            marketLine = game.overLine,
            ouResultProb = game.ouResultProb,
        ),
        awayTeamFullName = game.awayTeam,
        homeTeamFullName = game.homeTeam,
        oddsBreakdown = oddsBreakdown(game),
        consensus = consensus,
        signalCount = signalCount.takeIf { it > 0 },
    )

    GameRowCard(model = model, onPress = onPress, modifier = modifier)
}

private fun oddsBreakdown(game: NBAGame): GameRowCardModel.OddsBreakdown {
    val hasTotal = game.overLine != null
    val totalText = fmtHalf(game.overLine)
    return GameRowCardModel.OddsBreakdown(
        awaySpread = GameCardFormatting.formatSpread(game.awaySpread),
        homeSpread = GameCardFormatting.formatSpread(game.homeSpread),
        awayML = GameCardFormatting.formatMoneyline(game.awayMl),
        homeML = GameCardFormatting.formatMoneyline(game.homeMl),
        awayTotal = if (hasTotal) "O$totalText" else "—",
        homeTotal = if (hasTotal) "U$totalText" else "—",
    )
}

/** roundToNearestHalf → display string, stripping a trailing ".0". */
private fun fmtHalf(value: Double?): String {
    val rounded = GameCardFormatting.roundToNearestHalf(value) ?: return "—"
    return if (floor(rounded) == rounded) rounded.toInt().toString()
    else String.format(Locale.US, "%.1f", rounded)
}
