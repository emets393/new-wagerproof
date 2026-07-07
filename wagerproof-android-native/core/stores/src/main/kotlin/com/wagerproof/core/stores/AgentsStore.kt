package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.AgentWithPerformance
import com.wagerproof.core.models.TopAgentPickFeedRow
import com.wagerproof.core.services.AgentPicksService
import com.wagerproof.core.services.AgentService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

/**
 * `AgentsStore` is the source of truth for the My Agents inner tab on the
 * agents hub. Ports the React-Query trio in
 * `wagerproof-mobile/hooks/useAgents.ts` (useUserAgents + useUpdateAgent +
 * useDeleteAgent) into a single observable.
 *
 * State model:
 *   - `loadState` mirrors RN's `isLoading`/`error` pair (sum type instead).
 *   - `agents` is sorted by `net_units` descending (best-first), matching
 *     the `sortedAgents` memo in `agents/index.tsx:215-218`.
 *   - The `userId` is set via `bind(userId:)` once `AuthStore` resolves; the
 *     store no-ops every refresh until then so we never make an unscoped
 *     query against the user's RLS-protected rows.
 *
 * FIDELITY-WAIVER #070: The Top Agent Picks inner tab is hosted on this
 * store too — it fetches the cross-agent RPC feed lazily on first activation.
 */
@Stable
class AgentsStore {

    /** Inner-tab selector for the agents hub. */
    enum class InnerTab(val raw: String, val label: String) {
        MyAgents("myAgents", "My Agents"),
        Leaderboard("leaderboard", "Leaderboard"),
        TopPicks("topPicks", "Top Picks"),
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    // MARK: - State

    var agents by mutableStateOf<List<AgentWithPerformance>>(emptyList()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var topPicks by mutableStateOf<List<TopAgentPickFeedRow>>(emptyList()); private set
    var topPicksLoadState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var lastRefreshedAt by mutableStateOf<Long?>(null); private set

    var activeTab by mutableStateOf(InnerTab.MyAgents)

    var userId by mutableStateOf<String?>(null); private set

    val isLoading: Boolean get() = loadState.isLoading

    val lastError: String? get() = loadState.errorMessage

    // MARK: - Lifecycle

    /**
     * Set the active user. Called by the view from `.task` once it can read
     * `AuthStore.phase`. Resets state when the user changes.
     */
    fun bind(userId: String?) {
        if (userId == this.userId) return
        this.userId = userId
        agents = emptyList()
        topPicks = emptyList()
        loadState = LoadState.Idle
        topPicksLoadState = LoadState.Idle
    }

    /**
     * Pull-to-refresh / first-load. Re-fetches `avatar_profiles` for the
     * active user. Mirrors `useUserAgents.refetch`.
     */
    suspend fun refresh() {
        val uid = userId
        if (uid == null) {
            // No user yet — leave state idle so the view shows skeleton.
            loadState = LoadState.Idle
            return
        }
        loadState = LoadState.Loading
        try {
            val fetched = AgentService.fetchUserAgents(userId = uid)
            // Sort best-first by net_units; agents without performance sink to
            // the bottom (-inf treatment matches RN's sortedAgents memo).
            agents = fetched.sortedByDescending { it.performance?.netUnits ?: Double.NEGATIVE_INFINITY }
            loadState = LoadState.Loaded
            lastRefreshedAt = System.currentTimeMillis()
        } catch (t: Throwable) {
            loadState = LoadState.Failed(message(t))
        }
    }

    /**
     * Lazy fetch for the Top Agent Picks inner tab. Idempotent — only runs
     * once per session unless `forceRefresh` is true.
     */
    suspend fun refreshTopPicks(forceRefresh: Boolean = false) {
        if (!forceRefresh && topPicksLoadState is LoadState.Loaded) return
        topPicksLoadState = LoadState.Loading
        try {
            topPicks = AgentPicksService.fetchTopAgentPicksFeed(
                filterMode = "top10",
                viewerUserId = userId,
                limit = 50,
            )
            topPicksLoadState = LoadState.Loaded
        } catch (t: Throwable) {
            topPicksLoadState = LoadState.Failed(message(t))
        }
    }

    // MARK: - Mutations

    /**
     * Optimistically delete an agent locally, then call the service. If the
     * service throws we restore the pre-mutation snapshot.
     */
    suspend fun delete(agentId: String): Boolean {
        val snapshot = agents
        agents = agents.filterNot { it.id == agentId }
        return try {
            AgentService.delete(agentId = agentId)
            true
        } catch (t: Throwable) {
            agents = snapshot
            loadState = LoadState.Failed(message(t))
            false
        }
    }

    /** Flip `is_active` (autopilot pause). Optimistic — restore on failure. */
    suspend fun setActive(agentId: String, isActive: Boolean): Boolean {
        val snapshot = agents
        agents = agents.map {
            if (it.id == agentId) it.copy(agent = it.agent.copy(isActive = isActive)) else it
        }
        return try {
            AgentService.setActive(agentId = agentId, isActive = isActive)
            true
        } catch (t: Throwable) {
            agents = snapshot
            false
        }
    }

    /** Flip `auto_generate` (autopilot on/off). Same optimistic pattern. */
    suspend fun setAutoGenerate(agentId: String, autoGenerate: Boolean): Boolean {
        val snapshot = agents
        agents = agents.map {
            if (it.id == agentId) it.copy(agent = it.agent.copy(autoGenerate = autoGenerate)) else it
        }
        return try {
            AgentService.setAutoGenerate(agentId = agentId, autoGenerate = autoGenerate)
            true
        } catch (t: Throwable) {
            agents = snapshot
            false
        }
    }

    /** Toggle `is_public`. Same optimistic pattern. */
    suspend fun setPublic(agentId: String, isPublic: Boolean): Boolean {
        val snapshot = agents
        agents = agents.map {
            if (it.id == agentId) it.copy(agent = it.agent.copy(isPublic = isPublic)) else it
        }
        return try {
            AgentService.setPublic(agentId = agentId, isPublic = isPublic)
            true
        } catch (t: Throwable) {
            agents = snapshot
            false
        }
    }

    // MARK: - Derived

    val totalCount: Int get() = agents.size
    val activeCount: Int get() = agents.count { it.agent.isActive }
    val hasAgents: Boolean get() = agents.isNotEmpty()

    // MARK: - Lifecycle teardown

    fun close() = scope.cancel()

    // MARK: - Debug

    fun debugSet(agents: List<AgentWithPerformance>, state: LoadState = LoadState.Loaded) {
        this.agents = agents
        this.loadState = state
        this.lastRefreshedAt = if (state is LoadState.Loaded) System.currentTimeMillis() else null
    }

    // MARK: - Helpers

    private fun message(t: Throwable): String =
        t.message?.takeIf { it.isNotEmpty() } ?: "Unknown error"
}
