package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.NCAABGame

/**
 * Drives the NCAAB game detail bottom sheet. Mirrors the iOS
 * `NCAABGameSheetStore` (RN `NCAABGameSheetContext` + `useNCAABGameSheet`).
 * See [NFLGameSheetStore] / [CFBGameSheetStore] — identical shape, different
 * model.
 */
@Stable
class NCAABGameSheetStore {
    var selectedGame by mutableStateOf<NCAABGame?>(null)

    fun openGameSheet(game: NCAABGame) {
        selectedGame = game
    }

    fun closeGameSheet() {
        selectedGame = null
    }
}
