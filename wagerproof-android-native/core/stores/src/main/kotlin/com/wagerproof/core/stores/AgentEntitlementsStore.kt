package com.wagerproof.core.stores

import androidx.compose.runtime.Stable

/**
 * Port of iOS `AgentEntitlementsStore.swift` (doc §4.3).
 *
 * Freemium/Pro gating for agent creation, pick visibility, and leaderboard
 * ranks. Backed by [ProAccessStore] so RC entitlement changes propagate.
 *
 * Limits: FREE = 1 active agent; PRO = 10 active / 30 total; Admin = unlimited.
 */
@Stable
class AgentEntitlementsStore(
    private val proAccess: ProAccessStore,
) {
    companion object {
        const val FREE_AGENT_LIMIT = 1
        const val PRO_MAX_ACTIVE_AGENTS = 10
        const val PRO_MAX_TOTAL_AGENTS = 30
        const val FREE_LEADERBOARD_MIN_RANK = 6
        const val FREE_LEADERBOARD_MAX_RANK = 10

        /** Hard cap on concurrently-active agents for any tier ("8 desks"). */
        const val MAX_CONCURRENT_ACTIVE_AGENTS = 8
    }

    val isPro: Boolean get() = proAccess.isPro
    val isAdmin: Boolean get() = proAccess.isAdmin
    val isLoading: Boolean get() = proAccess.isLoading

    val canViewAgentPicks: Boolean get() = isPro || isAdmin
    val canCreatePublicAgent: Boolean get() = isPro || isAdmin
    val canUseAutopilot: Boolean get() = isPro || isAdmin

    val maxActiveAgents: Int?
        get() = if (isAdmin) null else if (isPro) PRO_MAX_ACTIVE_AGENTS else FREE_AGENT_LIMIT

    val maxTotalAgents: Int?
        get() = if (isAdmin) null else if (isPro) PRO_MAX_TOTAL_AGENTS else FREE_AGENT_LIMIT

    /** Pro users gate on TOTAL count, free users gate on ACTIVE count. */
    fun canCreateAnotherAgent(activeCount: Int, totalCount: Int): Boolean {
        if (isAdmin) return true
        if (isPro) return totalCount < PRO_MAX_TOTAL_AGENTS
        return activeCount < FREE_AGENT_LIMIT
    }

    /** Free users can preview ranks 6–10 (the "you could be here" tease); Pro/admin see all. */
    fun canViewLeaderboardRank(rank: Int): Boolean {
        if (isPro || isAdmin) return true
        return rank in FREE_LEADERBOARD_MIN_RANK..FREE_LEADERBOARD_MAX_RANK
    }
}
