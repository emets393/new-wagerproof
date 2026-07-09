package com.wagerproof.app.features.games

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.cfb.CFBGameCarousel
import com.wagerproof.app.features.mlb.MLBGameCarousel
import com.wagerproof.app.features.nba.NBAGameCarousel
import com.wagerproof.app.features.ncaab.NCAABGameCarousel
import com.wagerproof.app.features.nfl.NFLGameCarousel
import com.wagerproof.app.features.shared.TodoScreen
import com.wagerproof.app.nav.LocalAppNavigator
import com.wagerproof.core.design.components.LiquidGlassScene
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

/**
 * Resolves a Games-route payload back to the typed sport slate and mounts the
 * same swipeable detail carousel used by the iOS app. The selected sheet-store
 * game is appended when a cross-surface route (Search/Outliers) opens a game
 * that is not present in the currently cached Games slate.
 */
@Composable
fun GameDetailScreen(sport: String, gameId: String, modifier: Modifier = Modifier) {
    val graph = appGraph()
    val navigator = LocalAppNavigator.current

    // Sheet stores are also the cross-surface routing signal. Clear the signal
    // whenever this route leaves (visible back, system back, or tab re-tap) so
    // choosing the same game again produces a fresh state transition.
    DisposableEffect(sport, gameId) {
        onDispose {
            when (sport.lowercase()) {
                "nfl" -> graph.nflGameSheet.closeGameSheet()
                "cfb" -> graph.cfbGameSheet.closeGameSheet()
                "nba" -> graph.nbaGameSheet.closeGameSheet()
                "ncaab" -> graph.ncaabGameSheet.closeGameSheet()
                "mlb" -> graph.mlbGameSheet.closeGameSheet()
            }
        }
    }

    // One capture scene owns the full detail route: fixed aura, paging content,
    // bottom matchup strip, and floating back control all share the same real
    // Haze source. Never nest another source inside a sport page.
    LiquidGlassScene { sourceModifier ->
        Box(modifier.fillMaxSize().then(sourceModifier).background(AppColors.appSurface)) {
            when (sport.lowercase()) {
                "nfl" -> {
                    val selected = graph.nflGameSheet.selectedGame
                    val games = withSelected(graph.games.sortedNFL(), selected) { it.id }
                    NFLGameCarousel(games = games, initialGameId = gameId)
                }

                "cfb" -> {
                    val selected = graph.cfbGameSheet.selectedGame
                    val games = withSelected(graph.games.sortedCFB(), selected) { it.gameId }
                    CFBGameCarousel(games = games, initialGameId = gameId)
                }

                "nba" -> {
                    val selected = graph.nbaGameSheet.selectedGame
                    val games = withSelected(graph.games.sortedNBA(), selected) { it.id }
                    NBAGameCarousel(games = games, initialGameId = gameId)
                }

                "ncaab" -> {
                    val selected = graph.ncaabGameSheet.selectedGame
                    val games = withSelected(graph.games.sortedNCAAB(), selected) { it.id }
                    NCAABGameCarousel(games = games, initialGameId = gameId)
                }

                "mlb" -> {
                    val selected = graph.mlbGameSheet.selectedGame
                    val games = withSelected(graph.games.sortedMLB(), selected) { it.id }
                    MLBGameCarousel(games = games, initialGameId = gameId)
                }

                else -> TodoScreen(screenName = "Game unavailable", detail = "Unknown sport: $sport")
            }

            IconButton(
                onClick = navigator::popGames,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .statusBarsPadding()
                    .padding(start = 8.dp, top = 8.dp)
                    .size(44.dp)
                    .clip(CircleShape)
                    .liquidGlassBackground(CircleShape),
            ) {
                Icon(
                    imageVector = AppIcon.CHEVRON_LEFT.imageVector,
                    contentDescription = "Back to games",
                    tint = AppColors.appTextPrimary,
                )
            }
        }
    }
}

private inline fun <T> withSelected(
    games: List<T>,
    selected: T?,
    id: (T) -> String,
): List<T> {
    if (selected == null || games.any { id(it) == id(selected) }) return games
    return games + selected
}
