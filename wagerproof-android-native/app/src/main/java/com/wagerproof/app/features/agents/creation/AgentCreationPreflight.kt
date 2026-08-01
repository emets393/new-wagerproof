package com.wagerproof.app.features.agents.creation

import com.wagerproof.core.stores.AgentEntitlementsStore
import com.wagerproof.core.stores.AgentsStore
import com.wagerproof.core.stores.LoadState

internal sealed interface AgentCreationPreflight {
    data object Allowed : AgentCreationPreflight
    data class Blocked(val message: String) : AgentCreationPreflight
}

/**
 * Refreshes the owned-agent roster before evaluating creation quota. Copy
 * entry points use this before opening the builder, and the builder repeats it
 * immediately before create_agent so a second device or stale screen cannot
 * bypass the same limit.
 */
internal suspend fun runAgentCreationPreflight(
    userId: String?,
    agents: AgentsStore,
    entitlements: AgentEntitlementsStore,
): AgentCreationPreflight {
    val normalizedUserId = userId?.trim()?.lowercase().orEmpty()
    if (normalizedUserId.isEmpty()) {
        return AgentCreationPreflight.Blocked("Sign in before creating an agent.")
    }

    agents.bind(normalizedUserId)
    agents.refresh()
    return evaluateAgentCreationPreflight(
        isAuthenticated = true,
        isAccessLoading = entitlements.isLoading,
        isRosterAvailable = agents.loadState is LoadState.Loaded,
        isAdmin = entitlements.isAdmin,
        isPro = entitlements.isPro,
        activeCount = agents.activeCount,
        totalCount = agents.totalCount,
    )
}

internal fun evaluateAgentCreationPreflight(
    isAuthenticated: Boolean,
    isAccessLoading: Boolean,
    isRosterAvailable: Boolean,
    isAdmin: Boolean,
    isPro: Boolean,
    activeCount: Int,
    totalCount: Int,
): AgentCreationPreflight = when {
    !isAuthenticated -> AgentCreationPreflight.Blocked("Sign in before creating an agent.")
    isAccessLoading -> AgentCreationPreflight.Blocked("Still checking your agent access. Please try again.")
    !isRosterAvailable -> AgentCreationPreflight.Blocked(
        "Couldn't verify your available agent slots. Check your connection and try again.",
    )
    isAdmin -> AgentCreationPreflight.Allowed
    isPro && totalCount >= AgentEntitlementsStore.PRO_MAX_TOTAL_AGENTS ->
        AgentCreationPreflight.Blocked(
            "You've reached the ${AgentEntitlementsStore.PRO_MAX_TOTAL_AGENTS}-agent limit. " +
                "Delete an agent before creating another.",
        )
    !isPro && activeCount >= AgentEntitlementsStore.FREE_AGENT_LIMIT ->
        AgentCreationPreflight.Blocked(
            "Your plan includes ${AgentEntitlementsStore.FREE_AGENT_LIMIT} active agent. " +
                "Pause or delete it before creating another.",
        )
    else -> AgentCreationPreflight.Allowed
}
