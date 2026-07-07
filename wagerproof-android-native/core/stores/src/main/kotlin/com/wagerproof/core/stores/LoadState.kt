package com.wagerproof.core.stores

/**
 * Shared load-state for every store, port of the various Swift `LoadState`
 * enums scattered across WagerproofStores. Most stores only use
 * idle/loading/loaded/failed; the few that show a "silent background refresh
 * over populated cache" (GamesStore, NBA/NCAAB trends) also use [Refreshing].
 *
 * Swift enums with associated values → Kotlin sealed interface; `.failed(msg)`
 * carries a user-facing message string.
 */
sealed interface LoadState {
    data object Idle : LoadState
    data object Loading : LoadState
    data object Loaded : LoadState
    data object Refreshing : LoadState
    data class Failed(val message: String) : LoadState

    val isLoading: Boolean get() = this is Loading
    val errorMessage: String? get() = (this as? Failed)?.message
}
