package com.wagerproof.app.nav

import com.wagerproof.core.stores.RootRouter
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RootHostGateTest {
    @Test
    fun `ready authenticated shell stays blocked until access is fully resolved`() {
        assertTrue(
            requiresSubscriptionResolution(
                phase = RootRouter.Phase.Ready,
                authenticated = true,
                hasResolvedActiveUserEntitlement = false,
                proAccessLoading = false,
            ),
        )
        assertTrue(
            requiresSubscriptionResolution(
                phase = RootRouter.Phase.Ready,
                authenticated = true,
                hasResolvedActiveUserEntitlement = true,
                proAccessLoading = true,
            ),
        )
        assertFalse(
            requiresSubscriptionResolution(
                phase = RootRouter.Phase.Ready,
                authenticated = true,
                hasResolvedActiveUserEntitlement = true,
                proAccessLoading = false,
            ),
        )
    }

    @Test
    fun `auth and onboarding phases never show the subscription resolver`() {
        RootRouter.Phase.entries
            .filterNot { it == RootRouter.Phase.Ready }
            .forEach { phase ->
                assertFalse(
                    requiresSubscriptionResolution(
                        phase = phase,
                        authenticated = phase != RootRouter.Phase.Unauthenticated,
                        hasResolvedActiveUserEntitlement = false,
                        proAccessLoading = true,
                    ),
                )
            }
    }
}
