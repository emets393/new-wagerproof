package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.NFLPrediction

/**
 * Drives the NFL game detail bottom sheet. Mirrors the iOS `NFLGameSheetStore`
 * — `selectedGame != nil` presents a [androidx.compose.material3.ModalBottomSheet];
 * nil-ing it dismisses.
 */
@Stable
class NFLGameSheetStore {
    var selectedGame by mutableStateOf<NFLPrediction?>(null)

    fun openGameSheet(game: NFLPrediction) {
        selectedGame = game
    }

    fun closeGameSheet() {
        selectedGame = null
    }
}
