package com.wagerproof.app.features.nfl

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.components.TeamAuraBackground
import com.wagerproof.app.features.gamecards.CarouselMatchupChip
import com.wagerproof.app.features.gamecards.GameDetailCarousel
import com.wagerproof.app.features.props.NFLPlayerPropSelection
import com.wagerproof.app.features.props.detail.NflPropDetailScreen
import com.wagerproof.core.models.NFLPrediction
import com.wagerproof.core.models.NFLTeamAssets

/**
 * Swipeable carousel over the NFL slate's detail pages — thin wrapper over the
 * shared [GameDetailCarousel] (mirrors iOS `NFLGameCarousel`). Supplies NFL
 * brand colors/logos for the fixed glow + matchup chips; each page is an
 * [NFLGameDetailPage] in transparent (carousel) mode. Owns player-prop
 * drill-down so tapping a digest row pushes [NflPropDetailScreen].
 */
@Composable
fun NFLGameCarousel(
    games: List<NFLPrediction>,
    initialGameId: String,
    modifier: Modifier = Modifier,
) {
    val initialIndex = games.indexOfFirst { it.id == initialGameId || it.gameId == initialGameId }
        .coerceAtLeast(0)
    var selectedProp by remember { mutableStateOf<NFLPlayerPropSelection?>(null) }

    Box(modifier.fillMaxSize()) {
        GameDetailCarousel(
            games = games,
            initialIndex = initialIndex,
            modifier = Modifier.fillMaxSize(),
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
                NFLGameDetailPage(
                    game = game,
                    topInset = topInset,
                    bottomInset = bottomInset,
                    onSelectProp = { selectedProp = it },
                )
            },
        )

        selectedProp?.let { selection ->
            BackHandler { selectedProp = null }
            NflPropDetailScreen(selection = selection, onBack = { selectedProp = null })
        }
    }
}
