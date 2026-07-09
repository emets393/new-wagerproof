package com.wagerproof.app.features.nfl

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
import com.wagerproof.app.features.gamecards.TeamColorPair
import com.wagerproof.app.features.props.nflTeamColors
import com.wagerproof.core.models.NFLPrediction
import com.wagerproof.core.models.NFLTeamAssets
import java.util.Locale
import kotlin.math.floor

/**
 * NFL game row for the home Games feed — a thin adapter over the shared
 * [GameRowCard], mirroring iOS `NFLGameCard`. Dry-run cards hydrate the
 * authoritative `nfl_dryrun_picks` rows; merged game fields remain the loading,
 * legacy, and missing-row fallback.
 */
@Composable
fun NFLGameCard(
    game: NFLPrediction,
    onPress: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var picks by remember(game.gameId) { mutableStateOf<List<NFLDryrunPickRow>>(emptyList()) }
    LaunchedEffect(game.gameId, game.runId) {
        if ((game.runId ?: "").contains("dryrun", ignoreCase = true)) {
            loadNFLSlatePicksResult(game.gameId).onSuccess { picks = it }
        }
    }

    val awayAbbr = game.awayAb ?: NFLTeamAssets.abbr(game.awayTeam)
    val homeAbbr = game.homeAb ?: NFLTeamAssets.abbr(game.homeTeam)

    val model = GameRowCardModel(
        id = game.id,
        league = "nfl",
        dateLabel = GameCardFormatting.formatCompactDate(game.kickoff ?: game.gameDate),
        timeLabel = GameCardFormatting.convertTimeToEST(game.kickoff ?: game.gameTime),
        away = GameRowCardModel.TeamSide(
            abbr = awayAbbr,
            initials = awayAbbr,
            moneyline = game.awayMl,
            spread = game.awaySpread,
            logoURL = NFLTeamAssets.logo(game.awayTeam),
            colors = nflColorPair(game.awayTeam),
        ),
        home = GameRowCardModel.TeamSide(
            abbr = homeAbbr,
            initials = homeAbbr,
            moneyline = game.homeMl,
            spread = game.homeSpread,
            logoURL = NFLTeamAssets.logo(game.homeTeam),
            colors = nflColorPair(game.homeTeam),
        ),
        overLine = game.overLine,
        mlEdge = null,
        // Dry-run pipeline publishes a fair total (pred_total); the legacy
        // pipeline publishes a direction probability instead.
        ouEdge = GameEdgeMath.ouEdge(
            modelFairTotal = game.predTotal,
            marketLine = game.overLine,
            ouResultProb = game.ouResultProb,
        ),
        awayTeamFullName = game.awayTeam,
        homeTeamFullName = game.homeTeam,
        slatePicks = nflSlatePicks(game, picks),
        oddsBreakdown = oddsBreakdown(game),
        isMammoth = nflHasMammothPlay(game, picks),
    )

    GameRowCard(model = model, onPress = onPress, modifier = modifier)
}

/** [TeamColorPair] over the authoritative 32-team brand map. */
private fun nflColorPair(team: String): TeamColorPair {
    val (primary, secondary) = nflTeamColors(team)
    return TeamColorPair(primary, secondary)
}

internal fun nflHasMammothPlay(game: NFLPrediction, picks: List<NFLDryrunPickRow>): Boolean =
    game.mammoth || picks.any { pick ->
        pick.hasPlay == true && (pick.isMammoth == true || pick.conviction.equals("mammoth", ignoreCase = true))
    }

internal fun nflSlatePicks(game: NFLPrediction, picks: List<NFLDryrunPickRow>): GameRowCardModel.SlatePicks {
    val totalPick = picks.firstOrNull { it.cardGroup == "total" }
    val totalDir = pickDirection(totalPick?.pickSide ?: totalPick?.pickLabel ?: game.fgTotalPick)
    val totalLine = totalPick?.let { it.bestLine ?: it.vegasLine } ?: game.fgTotalClose
    val totalLabel = totalDir?.let { "O/U $it ${fmtHalf(totalLine)}" }

    val spreadPick = picks.firstOrNull { it.cardGroup == "spread" }
    val spreadTeam = spreadPick?.pickTeam
        ?: teamName(game, spreadPick?.pickSide)
        ?: teamName(game, game.fgSpreadPick)
    val spreadLogo = spreadTeam?.let { NFLTeamAssets.logo(it) }
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
        game.convictionSummary?.plays.orEmpty().count { (it.conviction ?: "").lowercase(Locale.US) == "high" }
    }
    val signalCount = if (picks.isNotEmpty()) {
        picks.flatMap { it.signalKeys }.filter(String::isNotBlank).toSet().size
    } else {
        game.flagsActive ?: 0
    }

    return GameRowCardModel.SlatePicks(
        totalIsOver = totalDir?.let { it == "OVER" },
        totalLabel = totalLabel,
        spreadLogoURL = spreadLogo,
        spreadLabel = spreadLabel,
        hasMammoth = nflHasMammothPlay(game, picks),
        highCount = highCount,
        signalCount = signalCount,
    )
}

private fun oddsBreakdown(game: NFLPrediction): GameRowCardModel.OddsBreakdown {
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

private fun teamName(game: NFLPrediction, side: String?): String? {
    val upper = (side ?: "").uppercase(Locale.US)
    return when {
        upper.contains("HOME") -> game.homeTeam
        upper.contains("AWAY") -> game.awayTeam
        else -> null
    }
}

private fun fmtHalf(value: Double?): String {
    val rounded = GameCardFormatting.roundToNearestHalf(value) ?: return "—"
    return if (floor(rounded) == rounded) rounded.toInt().toString() else String.format(Locale.US, "%.1f", rounded)
}

private fun pickDirection(raw: String?): String? {
    val u = (raw ?: "").uppercase(Locale.US)
    return when {
        u.contains("UNDER") -> "UNDER"
        u.contains("OVER") -> "OVER"
        else -> null
    }
}
