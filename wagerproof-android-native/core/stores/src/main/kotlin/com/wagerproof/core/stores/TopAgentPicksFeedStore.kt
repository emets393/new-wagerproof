package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.TopAgentPickFeedRow
import com.wagerproof.core.services.AgentPicksService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Ports `wagerproof-mobile/components/agents/TopAgentPicksFeed.tsx` +
 * `wagerproof-mobile/hooks/useTopAgentPicksFeed.ts` into a single observable
 * store. Owns the filter mode, search text, pagination cursor, and the
 * resulting [TopAgentPickFeedRow] rows. The feed view reads the rows;
 * bindings flow back through [filterMode] and [searchText].
 *
 * State model:
 *   - [filterMode] defaults to `Top10`. Flipping it via the bindable property
 *     triggers a [refresh] (page reset + new RPC call).
 *   - [searchText] mirrors RN's `searchText` field. Empty string ⇒ no
 *     server-side filter; non-empty calls into the RPC's `p_search_text`.
 *     Search input is debounced via [applySearchText] which the view pumps
 *     from a debounced effect instead of the setter so we don't storm the
 *     network per keystroke.
 *   - [cursor] is RN's pagination handle. When the last visible item reaches
 *     `items.size - 1`, the view calls [loadMore] with the latest cursor.
 *   - [items] is the appended page list. [refresh] clears it before page 1.
 */
@Stable
class TopAgentPicksFeedStore {

    /**
     * RPC filter modes. Wire values match the RPC `p_filter_mode` strings
     * exactly — changing them would break the SQL function.
     */
    enum class FilterMode(val raw: String, val label: String) {
        Top10("top10", "Top 10"),
        Following("following", "Following"),
        Favorites("favorites", "Favorites");

        val emptyMessage: String
            get() = when (this) {
                Top10 -> "No agent picks available for the next few days. Check back later!"
                Following -> "You're not following any agents yet. Visit the Leaderboard tab to discover and follow agents."
                Favorites -> "No favorited agents yet. Long-press an agent to favorite it for the Top Picks feed."
            }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    // MARK: - State

    var items by mutableStateOf<List<TopAgentPickFeedRow>>(emptyList()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var loadMoreState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var cursor by mutableStateOf<String?>(null); private set
    var hasMore by mutableStateOf(false); private set
    var lastRefreshedAt by mutableStateOf<Long?>(null); private set

    /**
     * User-driven filter pill. Bindable from the view; flipping it triggers a
     * refresh. Backed by [_filterMode] because the setter has a side effect —
     * pairing `private set` with an explicit setter would clash on the JVM.
     */
    private var _filterMode by mutableStateOf(FilterMode.Top10)
    var filterMode: FilterMode
        get() = _filterMode
        set(value) {
            if (value == _filterMode) return
            _filterMode = value
            scope.launch { refresh() }
        }

    /**
     * Search input. The view should pump this via a 250ms-debounced effect
     * before calling [applySearchText].
     */
    var searchText by mutableStateOf("")

    /**
     * Currently-applied search query (the one that drove the last RPC). The
     * view uses this to decide if a refresh is needed when [searchText] settles.
     */
    var appliedSearchText by mutableStateOf(""); private set

    /**
     * Optional viewer user id — required for `Following` / `Favorites` modes
     * so the RPC can resolve the user's follow set.
     */
    var viewerUserId by mutableStateOf<String?>(null); private set

    /**
     * Local-favorite ids supplied by `FavoriteAgentsStore`. When the filter
     * mode is `Favorites` and the view passes a non-empty local set in, we OR
     * it with the server-side favorite set. The RPC handles the server side;
     * this is a belt-and-suspenders pass so a user's local favorites still
     * show up when the server-side fan-out hasn't propagated.
     */
    var localFavoriteIds by mutableStateOf<Set<String>>(emptySet())

    /** Convenience flag for the view's empty-state branch. */
    val isLoading: Boolean get() = loadState is LoadState.Loading

    val lastError: String? get() = (loadState as? LoadState.Failed)?.message

    // MARK: - Lifecycle

    fun bind(viewerUserId: String?) {
        if (viewerUserId == this.viewerUserId) return
        this.viewerUserId = viewerUserId
        items = emptyList()
        cursor = null
        hasMore = false
        loadState = LoadState.Idle
    }

    /**
     * Apply the search box's current value as the active query. Called by the
     * view from a debounced effect. If the search text hasn't actually changed
     * this is a no-op.
     */
    suspend fun applySearchText(text: String) {
        val trimmed = text.trim()
        if (trimmed == appliedSearchText) return
        appliedSearchText = trimmed
        refresh()
    }

    /**
     * Pull-to-refresh / filter-flip entry point. Resets pagination and fetches
     * page 1.
     */
    suspend fun refresh() {
        loadState = LoadState.Loading
        cursor = null
        hasMore = false
        items = emptyList()
        try {
            val page = fetchPage(cursor = null)
            items = filterLocally(page)
            cursor = nextCursor(page)
            hasMore = page.isNotEmpty() && page.size >= pageSize
            loadState = LoadState.Loaded
            lastRefreshedAt = System.currentTimeMillis()
        } catch (t: Throwable) {
            loadState = LoadState.Failed(t.message ?: "Unknown error")
        }
    }

    /**
     * Append next page if available. Called by the view when the last visible
     * item changes. Safe to call concurrently — re-entrant invocations
     * short-circuit on `loadMoreState == Loading`.
     */
    suspend fun loadMore() {
        if (!hasMore) return
        if (loadMoreState is LoadState.Loading) return
        loadMoreState = LoadState.Loading
        try {
            val page = fetchPage(cursor = cursor)
            val filtered = filterLocally(page)
            // Dedupe — the RPC's cursor is created_at-based and could overlap
            // on identical timestamps across pages.
            val existingIds = items.map { it.id }.toSet()
            val newRows = filtered.filter { it.id !in existingIds }
            items = items + newRows
            cursor = nextCursor(page)
            hasMore = page.isNotEmpty() && page.size >= pageSize
            loadMoreState = LoadState.Loaded
        } catch (t: Throwable) {
            loadMoreState = LoadState.Failed(t.message ?: "Unknown error")
        }
    }

    /**
     * Grouped output mirrors the RN `groupPicksByAgent` helper — the view
     * renders sections per agent, each holding up to 4 horizontally scrollable
     * picks.
     */
    data class AgentSection(
        val agentId: String,
        val rows: List<TopAgentPickFeedRow>,
    ) {
        val id: String get() = agentId
    }

    val sections: List<AgentSection>
        get() {
            val out = mutableListOf<AgentSection>()
            var currentId: String? = null
            var current = mutableListOf<TopAgentPickFeedRow>()
            for (row in items) {
                if (row.avatarId != currentId) {
                    val id = currentId
                    if (id != null && current.isNotEmpty()) {
                        out.add(AgentSection(agentId = id, rows = current))
                    }
                    currentId = row.avatarId
                    current = mutableListOf(row)
                } else {
                    current.add(row)
                }
            }
            val id = currentId
            if (id != null && current.isNotEmpty()) {
                out.add(AgentSection(agentId = id, rows = current))
            }
            return out
        }

    fun close() = scope.cancel()

    // MARK: - Helpers

    private val pageSize = 50

    private suspend fun fetchPage(cursor: String?): List<TopAgentPickFeedRow> {
        val search = appliedSearchText.ifEmpty { null }
        return AgentPicksService.fetchTopAgentPicksFeed(
            filterMode = filterMode.raw,
            viewerUserId = viewerUserId,
            searchText = search,
            limit = pageSize,
            cursor = cursor,
        )
    }

    /**
     * Last `created_at` in the page = the cursor for the next page. Matches
     * the RPC's cursor contract.
     */
    private fun nextCursor(page: List<TopAgentPickFeedRow>): String? = page.lastOrNull()?.createdAt

    /**
     * Local post-filter. In `Favorites` mode the RPC already applied the
     * server-side favorite set; local favorites can only ADD to it, never
     * subtract — so server rows always win here. iOS expressed this with an
     * always-true predicate; we keep the server result untouched and leave
     * this branch as the seam where a future local-only union would slot in.
     * Local search is applied defensively — the RPC may not honor every search
     * term shape (matchups vary by sport).
     */
    private fun filterLocally(rows: List<TopAgentPickFeedRow>): List<TopAgentPickFeedRow> {
        var out = rows
        if (filterMode == FilterMode.Favorites && localFavoriteIds.isNotEmpty()) {
            // Deliberate no-op on the server result — server favorites win.
        }
        if (appliedSearchText.isNotEmpty()) {
            val q = appliedSearchText.lowercase()
            out = out.filter { row ->
                row.agentName.lowercase().contains(q) ||
                    row.matchup.lowercase().contains(q) ||
                    row.pickSelection.lowercase().contains(q)
            }
        }
        return out
    }

    // MARK: - Debug

    fun debugSet(items: List<TopAgentPickFeedRow>, state: LoadState = LoadState.Loaded) {
        this.items = items
        this.loadState = state
        this.hasMore = false
        this.cursor = null
        this.lastRefreshedAt = if (state is LoadState.Loaded) System.currentTimeMillis() else null
    }
}
