package com.wagerproof.app.features.nba

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.components.TeamAuraBackground
import com.wagerproof.app.features.gamecards.CarouselMatchupChip
import com.wagerproof.app.features.gamecards.GameDetailCarousel
import com.wagerproof.app.features.gamecards.NBATeams
import com.wagerproof.app.features.gamecards.TeamInitials
import com.wagerproof.core.models.NBAGame

/**
 * Swipeable carousel of the NBA slate's game-detail pages — thin wrapper over
 * the shared [GameDetailCarousel] (mirrors iOS `NBAGameCarousel`). NBA avatars
 * are colors-only ([NBATeams] brand table, no logo URLs).
 */
@Composable
fun NBAGameCarousel(
    games: List<NBAGame>,
    initialGameId: String,
    modifier: Modifier = Modifier,
) {
    val initialIndex = games.indexOfFirst {
        it.id == initialGameId || it.gameId.toString() == initialGameId
    }.coerceAtLeast(0)

    GameDetailCarousel(
        games = games,
        initialIndex = initialIndex,
        modifier = modifier,
        background = { game ->
            // Fixed shared glow behind all pages; cross-fades as pages settle.
            TeamAuraBackground(
                awayPrimary = NBATeams.colorPair(game.awayTeam).primary,
                homePrimary = NBATeams.colorPair(game.homeTeam).primary,
                progress = 0f,
                showBase = false,
                modifier = Modifier.fillMaxSize(),
            )
        },
        chip = { game, selected, onTap ->
            CarouselMatchupChip(
                awayLogoURL = null,
                homeLogoURL = null,
                awayAbbr = TeamInitials.from(game.awayTeam),
                homeAbbr = TeamInitials.from(game.homeTeam),
                selected = selected,
                sport = "nba",
                onTap = onTap,
            )
        },
        page = { game, topInset, bottomInset ->
            NBAGameDetailPage(game = game, topInset = topInset, bottomInset = bottomInset)
        },
    )
}
