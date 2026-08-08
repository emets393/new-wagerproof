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

    /**
     * Mount-time auto-load gate for stores that outlive the screen reading them
     * (anything hoisted into `AppGraph`). Idle = never loaded; Failed = a stale
     * transient failure the next appearance should retry. Loaded/Loading/
     * Refreshing are left alone — not refetching a list we already have is the
     * whole point of those guards.
     *
     * One predicate rather than an `is Idle` check per call site: the guards sit
     * in four different screens plus the tab shell and drifted apart once
     * already, which turned a single failed launch fetch into a permanently
     * empty surface for the rest of the process.
     */
    val needsInitialLoad: Boolean get() = this is Idle || this is Failed
}
