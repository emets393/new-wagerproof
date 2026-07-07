package com.wagerproof.core.stores

/**
 * Port of iOS `AgentPicksSeenStore.swift` (doc §8.7). Device-local "have I seen
 * this agent's latest picks?" ledger, backing the unread badge on the agents
 * list and the auto-play print cinematic. Deliberately NOT server state.
 *
 * Kotlin `object` (no instance), mirroring the Swift static enum. Backed by
 * [StorePrefs.standard] (iOS `UserDefaults.standard`). Comparison is
 * lexicographic — valid because every timestamp here comes from PostgREST's
 * uniform ISO8601 encoding, which sorts correctly as a string.
 */
object AgentPicksSeenStore {
    private fun key(agentId: String): String = "agent_picks_last_seen_$agentId"

    fun lastSeen(agentId: String): String? =
        StorePrefs.standard.getString(key(agentId), null)

    /**
     * Record that everything up to [upTo] has been seen. Monotonic — never
     * moves backwards, so racing loaders can call this freely.
     */
    fun markSeen(agentId: String, upTo: String?) {
        val ts = upTo?.takeIf { it.isNotEmpty() } ?: return
        val existing = lastSeen(agentId) ?: ""
        if (ts > existing) {
            StorePrefs.standard.edit().putString(key(agentId), ts).apply()
        }
    }

    /**
     * True when the agent has produced something newer than the last thing this
     * device saw. A never-opened agent with any activity reads as unread.
     */
    fun hasUnread(agentId: String, latestActivity: String?): Boolean {
        val latest = latestActivity?.takeIf { it.isNotEmpty() } ?: return false
        val seen = lastSeen(agentId) ?: return true
        return latest > seen
    }
}
