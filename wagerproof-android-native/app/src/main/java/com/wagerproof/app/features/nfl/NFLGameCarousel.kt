package com.wagerproof.app.features.nfl

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.components.TeamAuraBackground
import com.wagerproof.app.features.gamecards.CarouselMatchupChip
import com.wagerproof.app.features.gamecards.GameDetailCarousel
import com.wagerproof.core.models.NFLPrediction
import com.wagerproof.core.models.NFLTeamAssets

/**
 * Swipeable carousel over the NFL slate's detail pages — thin wrapper over the
 * shared [GameDetailCarousel] (mirrors iOS `NFLGameCarousel`). Supplies NFL
 * brand colors/logos for the fixed glow + matchup chips; each page is an
 * [NFLGameDetailPage] in transparent (carousel) mode.
 */
@Composable
fun NFLGameCarousel(
    games: List<NFLPrediction>,
    initialGameId: String,
    modifier: Modifier = Modifier,
) {
    val initialIndex = games.indexOfFirst { it.id == initialGameId || it.gameId == initialGameId }
        .coerceAtLeast(0)

    GameDetailCarousel(
        games = games,
        initialIndex = initialIndex,
        modifier = modifier,
        background = { game ->
            // Fixed shared glow behind all pages; cross-fades as pages settle.
            TeamAuraBackground(
                awayPrimary = NFLTeamColors.colorPair(game.awayTeam).primary,
                homePrimary = NFLTeamColors.colorPair(game.homeTeam).primary,
                progress = 0f,
                showBase = false,
                modifier = Modifier.fillMaxSize(),
            )
        },
        chip = { game, selected, onTap ->
            CarouselMatchupChip(
                awayLogoURL = NFLTeamAssets.logo(game.awayTeam),
                homeLogoURL = NFLTeamAssets.logo(game.homeTeam),
                awayAbbr = game.awayAb ?: NFLTeamAssets.abbr(game.awayTeam),
                homeAbbr = game.homeAb ?: NFLTeamAssets.abbr(game.homeTeam),
                selected = selected,
                sport = "nfl",
                onTap = onTap,
            )
        },
        page = { game, topInset, bottomInset ->
            NFLGameDetailPage(game = game, topInset = topInset, bottomInset = bottomInset)
        },
    )
}
