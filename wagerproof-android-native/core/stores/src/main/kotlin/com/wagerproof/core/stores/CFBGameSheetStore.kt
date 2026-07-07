package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.CFBPrediction

/**
 * Drives the CFB game detail bottom sheet. See [NFLGameSheetStore] — identical
 * shape, different model.
 */
@Stable
class CFBGameSheetStore {
    var selectedGame by mutableStateOf<CFBPrediction?>(null)

    fun openGameSheet(game: CFBPrediction) {
        selectedGame = game
    }

    fun closeGameSheet() {
        selectedGame = null
    }
}
