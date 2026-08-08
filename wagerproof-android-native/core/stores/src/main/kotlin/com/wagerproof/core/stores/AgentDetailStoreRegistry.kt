package com.wagerproof.core.stores

/**
 * App-scoped cache of [AgentDetailStore] instances, keyed by agent id.
 *
 * Why this exists: a V3 generation run polls for up to ~11 minutes, but
 * `MainScaffold`'s AnimatedContent disposes the detail screen on any back-press
 * or tab switch. When the store was `remember`ed per composition, the store —
 * and the run it owned — went with the screen, so the "picks are ready"
 * notification never fired. Holding the store here lets
 * [AgentDetailStore.startGeneration] run on the store's own scope and finish
 * regardless of what is on screen, and lets the user come back mid-run to the
 * SAME live progress instead of a store that knows nothing about it.
 *
 * Bounded so browsing many agents doesn't accumulate stores forever: the least
 * recently opened are closed once [maxRetained] is exceeded. A store with a run
 * in flight is never evicted — that would defeat the entire point.
 */
class AgentDetailStoreRegistry(private val maxRetained: Int = DEFAULT_MAX_RETAINED) {

    private val lock = Any()

    /** User whose private snapshots/runs may currently live in [stores]. */
    private var boundUserId: String? = null

    /** Insertion-ordered: first entry = least recently opened. */
    private val stores = LinkedHashMap<String, AgentDetailStore>()

    /** The store for [agentId], creating it on first use. */
    fun store(agentId: String): AgentDetailStore = synchronized(lock) {
        // Remove-then-reinsert so the map's iteration order stays "oldest first".
        val store = stores.remove(agentId) ?: AgentDetailStore(agentId)
        stores[agentId] = store
        evictIdle(keep = agentId)
        store
    }

    /** Number of cached stores. Test/diagnostic hook. */
    val size: Int get() = synchronized(lock) { stores.size }

    /**
     * Bind the registry to the active account. A direct A → B auth transition
     * must tear down A's cached snapshots and generation polling even if no
     * intermediate unauthenticated phase is observed.
     */
    fun bindUser(userId: String) = synchronized(lock) {
        if (boundUserId == userId) return@synchronized
        closeStores()
        boundUserId = userId
    }

    /** Tear every store down (sign-out). Runs in flight are cancelled deliberately. */
    fun clear() = synchronized(lock) {
        closeStores()
        boundUserId = null
    }

    private fun closeStores() {
        stores.values.forEach { it.close() }
        stores.clear()
    }

    private fun evictIdle(keep: String) {
        if (stores.size <= maxRetained) return
        val iterator = stores.entries.iterator()
        while (stores.size > maxRetained && iterator.hasNext()) {
            val entry = iterator.next()
            if (entry.key == keep) continue
            // A polling run outranks the cache bound — skip it and try the next.
            if (entry.value.hasRunInFlight) continue
            entry.value.close()
            iterator.remove()
        }
    }

    companion object {
        /**
         * Deep enough to cover leaderboard → detail → back → next-agent browsing
         * without refetching, shallow enough that the cache can't grow unbounded.
         */
        const val DEFAULT_MAX_RETAINED = 4
    }
}
