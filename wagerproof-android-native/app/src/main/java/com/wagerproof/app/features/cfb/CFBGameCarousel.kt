package com.wagerproof.app.features.cfb

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.gamecards.CFBTeamColors
import com.wagerproof.app.features.gamecards.CarouselMatchupChip
import com.wagerproof.app.features.gamecards.GameDetailCarousel
import com.wagerproof.app.features.components.TeamAuraBackground
import com.wagerproof.core.models.CFBPrediction
import com.wagerproof.core.models.CFBTeamAssets

/**
 * Swipeable carousel over the CFB slate's detail pages — a thin wrapper over the
 * shared [GameDetailCarousel] (mirrors iOS `CFBGameCarousel`). Supplies CFB
 * colors/logos for the fixed glow + matchup chips; each page is a
 * [CFBGameDetailPage] in transparent (carousel) mode.
 */
@Composable
fun CFBGameCarousel(
    games: List<CFBPrediction>,
    initialGameId: String,
    modifier: Modifier = Modifier,
) {
    val initialIndex = games.indexOfFirst { it.gameId == initialGameId }.coerceAtLeast(0)

    GameDetailCarousel(
        games = games,
        initialIndex = initialIndex,
        modifier = modifier,
        background = { game ->
            // Fixed shared glow behind all pages; cross-fades as pages settle.
            TeamAuraBackground(
                awayPrimary = CFBTeamColors.colorPair(game.awayTeam).primary,
                homePrimary = CFBTeamColors.colorPair(game.homeTeam).primary,
                progress = 0f,
                showBase = false,
                modifier = Modifier.fillMaxSize(),
            )
        },
        chip = { game, selected, onTap ->
            CarouselMatchupChip(
                awayLogoURL = CFBTeamAssets.logo(game.awayTeam),
                homeLogoURL = CFBTeamAssets.logo(game.homeTeam),
                awayAbbr = CFBTeamAssets.abbr(game.awayTeam),
                homeAbbr = CFBTeamAssets.abbr(game.homeTeam),
                selected = selected,
                sport = "cfb",
                onTap = onTap,
            )
        },
        page = { game, topInset, bottomInset ->
            // Transparent page — the carousel's shared glow reads through.
            CFBGameDetailPage(game = game, topInset = topInset, bottomInset = bottomInset)
        },
    )
}
