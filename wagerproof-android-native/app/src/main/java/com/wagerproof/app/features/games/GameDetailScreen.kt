package com.wagerproof.app.features.games

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.shared.TodoScreen

/** Per-sport game-detail sheet/screen. iOS per-sport GameSheet views. Placeholder. */
@Composable
fun GameDetailScreen(sport: String, gameId: String, modifier: Modifier = Modifier) {
    TodoScreen(screenName = "Game Detail", detail = "$sport · $gameId", modifier = modifier)
}
