package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.AgentStatDatum
import com.wagerproof.core.services.PlatformStatsService
import java.time.Instant
import java.time.OffsetDateTime

/**
 * Holds the whole-population agent distribution rows for the Agents "Platform
 * Statistics" screen. Mirrors `LeaderboardStore`'s shape (LoadState + refresh +
 * debugSet), but deliberately owns NO filter state: the screen's controls
 * (metric / sport / threshold / bin width) are pure view state because they
 * re-bucket the already-loaded rows in memory and never trigger a refetch. This
 * store just fetches the raw set once and exposes cache freshness.
 */
@Stable
class PlatformStatsStore {

    var data: List<AgentStatDatum> by mutableStateOf(emptyList()); private set
    var loadState: LoadState by mutableStateOf(LoadState.Idle); private set
    var lastRefreshedAt: Long? by mutableStateOf(null); private set

    val isLoading: Boolean get() = loadState.isLoading
    val lastError: String? get() = loadState.errorMessage

    /**
     * Most recent `last_calculated_at` across all rows — drives the "Updated …"
     * freshness label (parsed from the ISO strings the RPC returns).
     */
    val lastCalculatedAt: Instant?
        get() = data.mapNotNull { row ->
            val s = row.lastCalculatedAt ?: return@mapNotNull null
            runCatching { OffsetDateTime.parse(s).toInstant() }.getOrNull()
                ?: runCatching { Instant.parse(s) }.getOrNull()
        }.maxOrNull()

    /**
     * First-load / pull-to-refresh. Fetches the broad set (min 1 settled pick);
     * the interactive ≥N threshold is applied client-side by the view.
     */
    suspend fun refresh() {
        loadState = LoadState.Loading
        try {
            data = PlatformStatsService.fetchAgentDistribution(minDecided = 1)
            loadState = LoadState.Loaded
            lastRefreshedAt = System.currentTimeMillis()
        } catch (e: Exception) {
            loadState = LoadState.Failed(e.message ?: e.toString())
        }
    }

    fun debugSet(data: List<AgentStatDatum>, state: LoadState = LoadState.Loaded) {
        this.data = data
        this.loadState = state
        this.lastRefreshedAt = if (state == LoadState.Loaded) System.currentTimeMillis() else null
    }
}
