package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.AgentLeaderboardEntry
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.services.AgentPerformanceService
import com.wagerproof.core.services.BuildFlags
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Port of iOS `LeaderboardStore.swift` (doc §8.11). Public leaderboard list +
 * its filter pills. Every filter has a `didSet`-style setter that re-fetches
 * (doc §14.5: explicit setter FUNCTIONS, guarded on change).
 *
 * Sort mode / timeframe reuse the service enums directly (iOS typealiases).
 */
@Stable
class LeaderboardStore(
    private val service: AgentPerformanceService = AgentPerformanceService,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    // MARK: - State

    var entries by mutableStateOf<List<AgentLeaderboardEntry>>(emptyList()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var lastRefreshedAt by mutableStateOf<Long?>(null); private set

    /** Active sort mode pill. Setter re-fetches on change. */
    private var _sortMode by mutableStateOf(AgentPerformanceService.LeaderboardSortMode.OVERALL)
    val sortMode: AgentPerformanceService.LeaderboardSortMode get() = _sortMode

    /** Active timeframe pill. */
    private var _timeframe by mutableStateOf(AgentPerformanceService.LeaderboardTimeframe.ALL_TIME)
    val timeframe: AgentPerformanceService.LeaderboardTimeframe get() = _timeframe

    /** Whether to exclude agents with fewer than 10 picks. */
    private var _excludeUnder10Picks by mutableStateOf(false)
    val excludeUnder10Picks: Boolean get() = _excludeUnder10Picks

    /** Optional sport filter (null = all sports). */
    private var _sport by mutableStateOf<AgentSport?>(null)
    val sport: AgentSport? get() = _sport

    fun setSortMode(value: AgentPerformanceService.LeaderboardSortMode) {
        if (value == _sortMode) return
        _sortMode = value
        scope.launch { refresh() }
    }

    fun setTimeframe(value: AgentPerformanceService.LeaderboardTimeframe) {
        if (value == _timeframe) return
        _timeframe = value
        scope.launch { refresh() }
    }

    fun setExcludeUnder10Picks(value: Boolean) {
        if (value == _excludeUnder10Picks) return
        _excludeUnder10Picks = value
        scope.launch { refresh() }
    }

    fun setSport(value: AgentSport?) {
        if (value == _sport) return
        _sport = value
        scope.launch { refresh() }
    }

    val isLoading: Boolean get() = loadState is LoadState.Loading

    val lastError: String? get() = (loadState as? LoadState.Failed)?.message

    /** First-load / pull-to-refresh entry point. */
    suspend fun refresh() {
        loadState = LoadState.Loading
        runCatching {
            service.fetchLeaderboard(
                limit = 100,
                sport = sport,
                sortMode = sortMode,
                excludeUnder10Picks = excludeUnder10Picks,
                timeframe = timeframe,
            )
        }.onSuccess {
            entries = it
            loadState = LoadState.Loaded
            lastRefreshedAt = System.currentTimeMillis()
        }.onFailure { loadState = LoadState.Failed(it.message.orEmpty().ifEmpty { "Unknown error" }) }
    }

    /** Convenience for the Bottom-100 mode used to color-code win rates. */
    val isBottomMode: Boolean
        get() = sortMode == AgentPerformanceService.LeaderboardSortMode.BOTTOM_100

    fun close() = scope.cancel()

    fun debugSet(entries: List<AgentLeaderboardEntry>, state: LoadState = LoadState.Loaded) {
        if (!BuildFlags.isDebugBuild) return
        this.entries = entries
        this.loadState = state
        this.lastRefreshedAt = if (state is LoadState.Loaded) System.currentTimeMillis() else null
    }
}
