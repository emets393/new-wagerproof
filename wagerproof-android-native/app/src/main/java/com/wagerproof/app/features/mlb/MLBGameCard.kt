package com.wagerproof.app.features.mlb

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.gamecards.GameEdgeMath
import com.wagerproof.app.features.gamecards.GameRowCard
import com.wagerproof.app.features.gamecards.GameRowCardModel
import com.wagerproof.core.models.MLBGame
import kotlin.math.abs

/**
 * MLB game row for the home Games feed — a thin adapter over the shared
 * [GameRowCard], mirroring iOS `MLBGameCard`. MLB publishes `homeMlEdgePct` /
 * `awayMlEdgePct` + `ouDirection`/`ouFairTotal`, so we prefer those published
 * columns over recomputing edge from probabilities (falling back to
 * [GameEdgeMath] when a game hasn't been scored yet).
 */
@Composable
fun MLBGameCard(
    game: MLBGame,
    onPress: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val awayDisplayName = game.awayTeamName ?: game.awayTeam ?: "Away"
    val homeDisplayName = game.homeTeamName ?: game.homeTeam ?: "Home"

    val model = GameRowCardModel(
        id = game.id,
        league = "mlb",
        dateLabel = MLBFormatting.dateLabel(game.officialDate),
        timeLabel = MLBFormatting.gameTime(game.gameTimeEt),
        away = GameRowCardModel.TeamSide(
            abbr = game.awayAbbr,
            initials = game.awayAbbr,
            moneyline = game.awayMl,
            spread = game.awaySpread,
            logoURL = game.awayLogoUrl,
            colors = mlbTeamColorPair(awayDisplayName),
        ),
        home = GameRowCardModel.TeamSide(
            abbr = game.homeAbbr,
            initials = game.homeAbbr,
            moneyline = game.homeMl,
            spread = game.homeSpread,
            logoURL = game.homeLogoUrl,
            colors = mlbTeamColorPair(homeDisplayName),
        ),
        overLine = game.totalLine,
        mlEdge = mlbMlEdge(game),
        ouEdge = mlbOuEdge(game),
        awayTeamFullName = awayDisplayName,
        homeTeamFullName = homeDisplayName,
        oddsBreakdown = oddsBreakdown(game),
    )

    GameRowCard(model = model, onPress = onPress, modifier = modifier)
}

/** Run line / ML / shared total table. Total uses O on the away row, U on home. */
private fun oddsBreakdown(game: MLBGame): GameRowCardModel.OddsBreakdown {
    val totalText = MLBFormatting.line(game.totalLine)
    val hasTotal = game.totalLine != null
    return GameRowCardModel.OddsBreakdown(
        awaySpread = MLBFormatting.spread(game.awaySpread),
        homeSpread = MLBFormatting.spread(game.homeSpread),
        awayML = MLBFormatting.moneyline(game.awayMl),
        homeML = MLBFormatting.moneyline(game.homeMl),
        awayTotal = if (hasTotal) "O$totalText" else "—",
        homeTotal = if (hasTotal) "U$totalText" else "—",
    )
}

/** Prefer the published `*MlEdgePct` columns; fall back to the probability calc. */
private fun mlbMlEdge(game: MLBGame): GameRowCardModel.MLEdgeInfo? {
    val homeEdge = game.homeMlEdgePct
    val awayEdge = game.awayMlEdgePct
    if (homeEdge != null && awayEdge != null) {
        return if (homeEdge >= awayEdge) {
            GameRowCardModel.MLEdgeInfo(game.homeAbbr, homeEdge, GameEdgeMath.edgeColor(homeEdge))
        } else {
            GameRowCardModel.MLEdgeInfo(game.awayAbbr, awayEdge, GameEdgeMath.edgeColor(awayEdge))
        }
    }
    return GameEdgeMath.mlEdge(
        modelHomeProb = game.mlHomeWinProb,
        homeMl = game.homeMl,
        awayMl = game.awayMl,
        homeAbbr = game.homeAbbr,
        awayAbbr = game.awayAbbr,
    )
}

/** Prefer the published `ouDirection`/`ouFairTotal`; fall back to fair-vs-market. */
private fun mlbOuEdge(game: MLBGame): GameRowCardModel.OUEdgeInfo? {
    val direction = game.ouDirection
    if (direction != null) {
        val isOver = direction.uppercase() == "OVER"
        val fair = game.ouFairTotal
        val line = game.totalLine
        val delta = if (fair != null && line != null) fair - line else null
        val edgeMag = abs(game.ouEdge ?: 0.0)
        return GameRowCardModel.OUEdgeInfo(
            isOver = isOver,
            delta = delta,
            // MLB does not publish a directional confidence here. Showing a
            // fabricated 50% made every Android row longer and contradicted
            // the iOS card, which intentionally omits this value.
            probability = null,
            color = GameEdgeMath.edgeColor(edgeMag),
        )
    }
    return GameEdgeMath.ouEdge(
        modelFairTotal = game.ouFairTotal,
        marketLine = game.totalLine,
        ouResultProb = null,
    )
}
