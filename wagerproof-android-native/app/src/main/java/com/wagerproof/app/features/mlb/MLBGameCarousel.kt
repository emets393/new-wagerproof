package com.wagerproof.app.features.mlb

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.components.TeamAuraBackground
import com.wagerproof.app.features.gamecards.CarouselMatchupChip
import com.wagerproof.app.features.gamecards.GameDetailCarousel
import com.wagerproof.app.features.props.PlayerPropSelection
import com.wagerproof.app.features.props.detail.PlayerPropDetailScreen
import com.wagerproof.core.models.MLBGame
import com.wagerproof.core.stores.MLBBucketAccuracyStore
import com.wagerproof.core.stores.MLBRegressionReportStore
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

/**
 * Swipeable MLB slate detail — the Android counterpart of iOS
 * `MLBGameCarousel`. Companion datasets are hydrated once for the entire slate,
 * while every page reads the same observable stores by game_pk.
 */
@Composable
fun MLBGameCarousel(
    games: List<MLBGame>,
    initialGameId: String,
    modifier: Modifier = Modifier,
) {
    if (games.isEmpty()) return

    val graph = appGraph()
    val accuracyStore = remember { MLBBucketAccuracyStore() }
    val regressionStore = remember { MLBRegressionReportStore() }
    var selectedProp by remember { mutableStateOf<PlayerPropSelection?>(null) }

    DisposableEffect(Unit) {
        onDispose {
            accuracyStore.close()
            regressionStore.close()
        }
    }

    LaunchedEffect(Unit) {
        coroutineScope {
            val trends = async { graph.mlbBettingTrends.refreshIfNeeded() }
            val f5 = async { graph.mlbF5Splits.refreshIfStale() }
            val accuracy = async { accuracyStore.refreshIfStale() }
            val regression = async { regressionStore.refreshIfStale() }
            val props = async { graph.props.refreshMLB() }
            trends.await()
            f5.await()
            accuracy.await()
            regression.await()
            props.await()
        }
    }

    val initialIndex = games.indexOfFirst {
        it.id == initialGameId || it.gamePk.toString() == initialGameId
    }.coerceAtLeast(0)

    Box(modifier.fillMaxSize()) {
        GameDetailCarousel(
            games = games,
            initialIndex = initialIndex,
            modifier = Modifier.fillMaxSize(),
            background = { game ->
                TeamAuraBackground(
                    awayPrimary = mlbTeamColorPair(game.awayTeamName ?: game.awayTeam ?: game.awayAbbr).primary,
                    homePrimary = mlbTeamColorPair(game.homeTeamName ?: game.homeTeam ?: game.homeAbbr).primary,
                    progress = 0f,
                    showBase = false,
                    modifier = Modifier.fillMaxSize(),
                )
            },
            chip = { game, selected, onTap ->
                CarouselMatchupChip(
                    awayLogoURL = game.awayLogoUrl,
                    homeLogoURL = game.homeLogoUrl,
                    awayAbbr = game.awayAbbr,
                    homeAbbr = game.homeAbbr,
                    selected = selected,
                    sport = "mlb",
                    onTap = onTap,
                )
            },
            page = { game, topInset, bottomInset ->
                MLBGameDetailPage(
                    game = game,
                    topInset = topInset,
                    bottomInset = bottomInset,
                    trendsStore = graph.mlbBettingTrends,
                    f5Store = graph.mlbF5Splits,
                    propsStore = graph.props,
                    accuracyStore = accuracyStore,
                    regressionStore = regressionStore,
                    onSelectProp = { selectedProp = it },
                )
            },
        )

        selectedProp?.let { selection ->
            BackHandler { selectedProp = null }
            PlayerPropDetailScreen(selection = selection, onBack = { selectedProp = null })
        }
    }
}
