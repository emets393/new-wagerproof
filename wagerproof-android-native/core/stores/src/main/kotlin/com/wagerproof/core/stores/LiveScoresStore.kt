package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.LiveGame
import com.wagerproof.core.services.LiveScoresService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * `LiveScoresStore` mirrors the RN `useLiveScores` hook + the surrounding
 * `setInterval(fetchGames, 2 * 60 * 1000)` polling pattern. Pulls from
 * `LiveScoresService.shared.getLiveScores()` every 120 seconds while `start()`
 * is active. `refresh()` is the manual entry point bound to pull-to-refresh.
 */
@Stable
class LiveScoresStore {

    var games: List<LiveGame> by mutableStateOf(emptyList()); private set
    var loadState: LoadState by mutableStateOf(LoadState.Idle); private set
    var lastRefreshedAt: Long? by mutableStateOf(null); private set

    val hasLiveGames: Boolean get() = games.isNotEmpty()
    val isLoading: Boolean get() = loadState.isLoading
    val lastError: String? get() = loadState.errorMessage

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var pollJob: Job? = null

    /**
     * Begin background polling. Safe to call multiple times (idempotent).
     * Cancelled automatically on `stop()`.
     */
    // FIDELITY-WAIVER #011: Polling fires unconditionally; network-state gating
    // (mirrors RN's useNetworkState check) lands in B22 hardening.
    fun start() {
        if (pollJob != null) return
        pollJob = scope.launch {
            // Fire one immediate fetch on start so the UI populates fast.
            refresh()
            while (isActive) {
                delay(POLL_INTERVAL_MS)
                refresh()
            }
        }
    }

    fun stop() {
        pollJob?.cancel()
        pollJob = null
    }

    fun close() = scope.cancel()

    /**
     * Manual refresh — wired to pull-to-refresh in ScoreboardView.
     */
    suspend fun refresh() {
        loadState = LoadState.Loading
        try {
            games = LiveScoresService.shared.getLiveScores()
            loadState = LoadState.Loaded
            lastRefreshedAt = System.currentTimeMillis()
        } catch (e: Exception) {
            // Keep stale games on screen if we have any — only show the error
            // banner; don't blank the board. Matches RN's
            // "try { ... } catch { setError(err) }" with prior games retained.
            loadState = LoadState.Failed(e.message ?: e.toString())
        }
    }

    /**
     * Filter helper used by the scoreboard's league grouping and by the
     * WagerBot suggestion context for "any NBA games tonight?" lookups.
     */
    fun byLeague(league: String): List<LiveGame> {
        val upper = league.uppercase()
        return games.filter { it.league.uppercase() == upper }
    }

    /**
     * Group games by league, returning leagues sorted by the canonical
     * LEAGUE_CONFIG.order (NFL → NCAAF → NBA → NCAAB → NHL → MLB → MLS → EPL).
     */
    fun groupedByLeague(): List<Pair<String, List<LiveGame>>> =
        games.groupBy { it.league }
            .map { (league, gs) -> league to gs }
            .sortedBy { leagueOrder(it.first) }

    // MARK: - Debug-only previews
    //
    // Polling is intentionally NOT started so the previewed state is stable
    // for screenshot capture.

    fun debugSet(games: List<LiveGame>, state: LoadState) {
        this.games = games
        this.loadState = state
        this.lastRefreshedAt = if (state == LoadState.Loaded) System.currentTimeMillis() else null
    }

    companion object {
        /** Refresh cadence. Mirrors RN's hard-coded `2 * 60 * 1000` ms. */
        const val pollInterval: Long = 120
        private const val POLL_INTERVAL_MS: Long = 120_000

        /**
         * Canonical league ordering per RN `LEAGUE_CONFIG`. Unknown leagues
         * fall back to 999 so they sort to the end.
         */
        fun leagueOrder(league: String): Int = when (league.uppercase()) {
            "NFL" -> 1
            "NCAAF", "CFB" -> 2
            "NBA" -> 3
            "NCAAB" -> 4
            "NHL" -> 5
            "MLB" -> 6
            "MLS" -> 7
            "EPL" -> 8
            else -> 999
        }
    }
}
