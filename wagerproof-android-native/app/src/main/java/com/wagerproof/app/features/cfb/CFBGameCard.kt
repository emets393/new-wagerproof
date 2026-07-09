package com.wagerproof.app.features.cfb

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
 * [GameRowCard], mirroring iOS `CFBGameCard`. Dry-run cards hydrate the
 * authoritative `cfb_dryrun_picks` rows; merged game fields remain the loading,
 * legacy, and missing-row fallback.
 */
@Composable
fun CFBGameCard(
    game: CFBPrediction,
    onPress: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var picks by remember(game.gameId) { mutableStateOf<List<CFBDryrunPickRow>>(emptyList()) }
    LaunchedEffect(game.gameId, game.runId) {
        if ((game.runId ?: "").contains("dryrun", ignoreCase = true)) {
            loadCFBSlatePicksResult(game.gameId).onSuccess { picks = it }
        }
    }

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
        slatePicks = cfbSlatePicks(game, picks),
        oddsBreakdown = oddsBreakdown(game, awayAbbr, homeAbbr),
        isMammoth = cfbHasMammothPlay(game, picks),
    )

    GameRowCard(model = model, onPress = onPress, modifier = modifier)
}

internal fun cfbHasMammothPlay(game: CFBPrediction, picks: List<CFBDryrunPickRow>): Boolean =
    game.mammoth || picks.any { pick ->
        pick.hasPlay == true && (pick.isMammoth == true || pick.conviction.equals("mammoth", ignoreCase = true))
    }

internal fun cfbSlatePicks(
    game: CFBPrediction,
    picks: List<CFBDryrunPickRow>,
): GameRowCardModel.SlatePicks {
    val totalPick = picks.firstOrNull { it.normalizedCardGroup == "total" }
    val totalDir = pickDirection(totalPick?.pickSide ?: totalPick?.pickLabel ?: game.fgTotalPick)
    val totalLine = totalPick?.let { it.bestLine ?: it.vegasLine } ?: game.fgTotalClose
    val totalLabel = totalDir?.let { "O/U $it ${fmtHalf(totalLine)}" }

    val spreadPick = picks.firstOrNull { it.normalizedCardGroup == "spread" }
    val spreadTeam = spreadPick?.pickTeam
        ?: teamName(game, spreadPick?.pickSide)
        ?: teamName(game, game.fgSpreadPick)
    val spreadLogo = spreadTeam?.let { CFBTeamAssets.logo(it) }
    val spreadLabel = spreadTeam?.let {
        val line = if (spreadPick != null) {
            spreadPick.bestLine ?: spreadPick.vegasLine
        } else {
            val isHome = it == game.homeTeam
            game.fgSpreadClose?.let { v -> if (isHome) v else -v }
        }
        GameCardFormatting.formatSpread(line)
    }

    val highCount = if (picks.isNotEmpty()) {
        picks.count { it.hasPlay == true && it.conviction.equals("high", ignoreCase = true) }
    } else {
        game.activeFlags.count {
            it.convictionTier == CFBFlagConviction.T1 || it.convictionTier == CFBFlagConviction.MAMMOTH
        }
    }
    val signalCount = if (picks.isNotEmpty()) {
        picks.flatMap { it.signalKeys }.filter(String::isNotBlank).toSet().size
    } else {
        game.nFlagsActive ?: game.activeFlags.size
    }

    return GameRowCardModel.SlatePicks(
        totalIsOver = totalDir?.let { it == "OVER" },
        totalLabel = totalLabel,
        spreadLogoURL = spreadLogo,
        spreadLabel = spreadLabel,
        hasMammoth = cfbHasMammothPlay(game, picks),
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
