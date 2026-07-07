package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.NBAGame

/**
 * Drives the NBA game detail bottom sheet. Mirrors the iOS `NBAGameSheetStore`
 * (RN `NBAGameSheetContext` + `useNBAGameSheet`) — `selectedGame != nil`
 * presents a [androidx.compose.material3.ModalBottomSheet]; nil-ing it
 * dismisses. See [NFLGameSheetStore] — identical shape, different model.
 */
@Stable
class NBAGameSheetStore {
    var selectedGame by mutableStateOf<NBAGame?>(null)

    fun openGameSheet(game: NBAGame) {
        selectedGame = game
    }

    fun closeGameSheet() {
        selectedGame = null
    }
}
