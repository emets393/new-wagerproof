package com.wagerproof.app.features.agents

import com.wagerproof.app.features.agents.creation.AgentCreationPreflight
import com.wagerproof.app.features.agents.creation.evaluateAgentCreationPreflight
import com.wagerproof.core.stores.AgentEntitlementsStore
import kotlin.test.Test
import kotlin.test.assertIs

class AgentCreationPreflightTest {
    @Test
    fun freeAccountAtActiveLimitIsBlocked() {
        val result = evaluateAgentCreationPreflight(
            isAuthenticated = true,
            isAccessLoading = false,
            isRosterAvailable = true,
            isAdmin = false,
            isPro = false,
            activeCount = AgentEntitlementsStore.FREE_AGENT_LIMIT,
            totalCount = 1,
        )

        assertIs<AgentCreationPreflight.Blocked>(result)
    }

    @Test
    fun proAccountAtTotalLimitIsBlockedEvenWithAnInactiveSlot() {
        val result = evaluateAgentCreationPreflight(
            isAuthenticated = true,
            isAccessLoading = false,
            isRosterAvailable = true,
            isAdmin = false,
            isPro = true,
            activeCount = 0,
            totalCount = AgentEntitlementsStore.PRO_MAX_TOTAL_AGENTS,
        )

        assertIs<AgentCreationPreflight.Blocked>(result)
    }

    @Test
    fun adminBypassesQuotaAfterRosterAndAccessResolve() {
        val result = evaluateAgentCreationPreflight(
            isAuthenticated = true,
            isAccessLoading = false,
            isRosterAvailable = true,
            isAdmin = true,
            isPro = false,
            activeCount = 500,
            totalCount = 500,
        )

        assertIs<AgentCreationPreflight.Allowed>(result)
    }

    @Test
    fun unavailableRosterFailsClosedBeforeQuotaEvaluation() {
        val result = evaluateAgentCreationPreflight(
            isAuthenticated = true,
            isAccessLoading = false,
            isRosterAvailable = false,
            isAdmin = true,
            isPro = true,
            activeCount = 0,
            totalCount = 0,
        )

        assertIs<AgentCreationPreflight.Blocked>(result)
    }
}
