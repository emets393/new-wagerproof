package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.MLBGame
import com.wagerproof.core.services.BuildFlags

/**
 * Drives the MLB game-detail bottom sheet + holds a vestigial slate cache.
 * Port of iOS `MLBGameSheetStore.swift`.
 *
 * `selectedGame != null` presents the sheet; null dismisses. The real MLB
 * slate lives in `GamesStore`; `games` / `lastFetched` here are only ever
 * populated by the DEBUG parity-screenshot seeding hook.
 *
 * No coroutine scope — this store never launches work of its own.
 */
@Stable
class MLBGameSheetStore {
    var selectedGame by mutableStateOf<MLBGame?>(null)

    var games by mutableStateOf<List<MLBGame>>(emptyList()); private set
    var lastFetched by mutableStateOf<Long?>(null); private set

    fun openGameSheet(game: MLBGame) {
        selectedGame = game
    }

    fun closeGameSheet() {
        selectedGame = null
    }

    /** Test-only seeding hook used by parity-screenshot builds. */
    fun debugSet(games: List<MLBGame>, selected: MLBGame? = null) {
        if (!BuildFlags.isDebugBuild) return
        this.games = games
        this.selectedGame = selected
        this.lastFetched = System.currentTimeMillis()
    }
}
