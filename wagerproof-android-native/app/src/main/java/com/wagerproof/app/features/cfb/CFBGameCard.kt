package com.wagerproof.app.features.cfb

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.app.features.gamecards.GameEdgeMath
import com.wagerproof.app.features.gamecards.GameRowCard
import com.wagerproof.app.features.gamecards.GameRowCardModel
import com.wagerproof.app.features.gamecards.CFBTeamColors
import com.wagerproof.core.models.CFBFlagConviction
import com.wagerproof.core.models.CFBPrediction
import com.wagerproof.core.models.CFBTeamAssets
import java.util.Locale
import kotlin.math.floor

/**
 * CFB game row for the home Games feed — a thin adapter over the shared
 * [GameRowCard], mirroring iOS `CFBGameCard`. Unlike iOS (which re-queries
 * `cfb_dryrun_picks` per card), GamesStore already merges `cfb_dryrun_games` +
 * flags into [CFBPrediction], so the slate pills are derived straight from the
 * model's fg* / tt* / flags / mammoth fields — no per-card Supabase round-trip.
 */
@Composable
fun CFBGameCard(
    game: CFBPrediction,
    onPress: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val awayAbbr = CFBTeamAssets.abbr(game.awayTeam)
    val homeAbbr = CFBTeamAssets.abbr(game.homeTeam)
    val awayColors = CFBTeamColors.colorPair(game.awayTeam)
    val homeColors = CFBTeamColors.colorPair(game.homeTeam)

    val model = GameRowCardModel(
        id = game.id,
        league = "cfb",
        dateLabel = GameCardFormatting.formatCompactDate(game.kickoff ?: game.gameDate),
        timeLabel = GameCardFormatting.convertTimeToEST(game.kickoff ?: game.gameTime),
        away = GameRowCardModel.TeamSide(
            abbr = awayAbbr,
            initials = awayAbbr,
            moneyline = game.awayMl,
            spread = game.awaySpread,
            logoURL = CFBTeamAssets.logo(game.awayTeam),
            colors = awayColors,
        ),
        home = GameRowCardModel.TeamSide(
            abbr = homeAbbr,
            initials = homeAbbr,
            moneyline = game.homeMl,
            spread = game.homeSpread,
            logoURL = CFBTeamAssets.logo(game.homeTeam),
            colors = homeColors,
        ),
        overLine = game.overLine,
        mlEdge = null,
        ouEdge = GameEdgeMath.ouEdge(
            modelFairTotal = game.fgPredTotal ?: game.predTotal,
            marketLine = game.overLine,
            ouResultProb = game.ouResultProb,
        ),
        awayTeamFullName = game.awayTeam,
        homeTeamFullName = game.homeTeam,
        slatePicks = slatePicks(game, awayAbbr, homeAbbr),
        oddsBreakdown = oddsBreakdown(game, awayAbbr, homeAbbr),
        isMammoth = game.mammoth,
    )

    GameRowCard(model = model, onPress = onPress, modifier = modifier)
}

private fun slatePicks(
    game: CFBPrediction,
    awayAbbr: String,
    homeAbbr: String,
): GameRowCardModel.SlatePicks {
    val totalDir = pickDirection(game.fgTotalPick)
    val totalLabel = totalDir?.let { "O/U $it ${fmtHalf(game.fgTotalClose)}" }

    // Spread pill: favorite side from fg_spread_pick, line sign-flipped for away.
    val spreadTeam = teamName(game, game.fgSpreadPick)
    val spreadLogo = spreadTeam?.let { CFBTeamAssets.logo(it) }
    val spreadLabel = spreadTeam?.let {
        val isHome = it == game.homeTeam
        val line = game.fgSpreadClose?.let { v -> if (isHome) v else -v }
        GameCardFormatting.formatSpread(line)
    }

    // Model-derived badges (iOS derives these from the picks table; here the
    // active flags stand in — T1/mammoth flags = "high conviction" plays).
    val active = game.activeFlags
    val highCount = active.count {
        it.convictionTier == CFBFlagConviction.T1 || it.convictionTier == CFBFlagConviction.MAMMOTH
    }
    val signalCount = game.nFlagsActive ?: active.size

    return GameRowCardModel.SlatePicks(
        totalIsOver = totalDir?.let { it == "OVER" },
        totalLabel = totalLabel,
        spreadLogoURL = spreadLogo,
        spreadLabel = spreadLabel,
        hasMammoth = game.mammoth,
        highCount = highCount,
        signalCount = signalCount,
    )
}

private fun oddsBreakdown(
    game: CFBPrediction,
    awayAbbr: String,
    homeAbbr: String,
): GameRowCardModel.OddsBreakdown {
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

private fun teamName(game: CFBPrediction, side: String?): String? {
    val upper = (side ?: "").uppercase(Locale.US)
    return when {
        upper.contains("HOME") -> game.homeTeam
        upper.contains("AWAY") -> game.awayTeam
        else -> null
    }
}
// `pickDirection` and `fmtHalf` are the package-level helpers in CFBMarketBoard.kt.
