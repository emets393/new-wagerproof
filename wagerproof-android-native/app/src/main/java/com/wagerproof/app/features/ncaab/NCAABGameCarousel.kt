package com.wagerproof.app.features.ncaab

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.wagerproof.app.features.gamecards.CarouselMatchupChip
import com.wagerproof.app.features.gamecards.FallbackTeamColor
import com.wagerproof.app.features.gamecards.GameDetailCarousel
import com.wagerproof.app.features.gamecards.TeamInitials
import com.wagerproof.app.features.components.TeamAuraBackground
import com.wagerproof.core.models.NCAABGame

/**
 * Swipeable carousel of the NCAAB slate's game-detail pages — thin wrapper over
 * the shared [GameDetailCarousel] (mirrors iOS `NCAABGameCarousel`). NCAAB has
 * no brand table, so team colors come from a stable name hash
 * ([FallbackTeamColor], FIDELITY-WAIVER #008).
 */
@Composable
fun NCAABGameCarousel(
    games: List<NCAABGame>,
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
            TeamAuraBackground(
                awayPrimary = FallbackTeamColor.colorPair(game.awayTeam).primary,
                homePrimary = FallbackTeamColor.colorPair(game.homeTeam).primary,
                progress = 0f,
                showBase = false,
                modifier = Modifier.fillMaxSize(),
            )
        },
        chip = { game, selected, onTap ->
            CarouselMatchupChip(
                awayLogoURL = null,
                homeLogoURL = null,
                awayAbbr = game.awayTeamAbbrev?.trim().takeUnless { it.isNullOrEmpty() }
                    ?: TeamInitials.from(game.awayTeam),
                homeAbbr = game.homeTeamAbbrev?.trim().takeUnless { it.isNullOrEmpty() }
                    ?: TeamInitials.from(game.homeTeam),
                selected = selected,
                sport = "ncaab",
                onTap = onTap,
            )
        },
        page = { game, topInset, bottomInset ->
            // Transparent floor so the carousel's shared glow reads through.
            Box(Modifier.fillMaxSize().background(Color.Transparent)) {
                NCAABGameDetailPage(game = game, topInset = topInset, bottomInset = bottomInset)
            }
        },
    )
}
