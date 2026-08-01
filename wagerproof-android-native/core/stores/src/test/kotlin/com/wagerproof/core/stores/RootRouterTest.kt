package com.wagerproof.core.stores

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RootRouterTest {
    @Test
    fun `authenticated account must complete onboarding before ready`() {
        val router = RootRouter()
        val account = AuthStore.Phase.Authenticated("user-1")

        router.resolve(account, onboardingComplete = false)
        assertEquals(RootRouter.Phase.Onboarding, router.phase)

        router.resolve(account, onboardingComplete = true)
        assertEquals(RootRouter.Phase.Ready, router.phase)
    }

    @Test
    fun `secret settings replay forces onboarding and one paywall presentation`() {
        val router = RootRouter()

        router.forceOnboardingForTestingNow()
        assertEquals(RootRouter.Phase.Onboarding, router.phase)
        assertTrue(router.testPaywallOverride)

        router.clearTestPaywallOverride()
        assertFalse(router.testPaywallOverride)
    }
}
