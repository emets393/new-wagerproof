package com.wagerproof.app.nav

import com.wagerproof.core.stores.RootRouter
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RootHostGateTest {
    @Test
    fun `authenticated ready non-Pro lands on post-onboarding paywall`() {
        assertTrue(
            shouldPresentPostOnboardingPaywall(
                phase = RootRouter.Phase.Ready,
                authenticated = true,
                hasResolvedActiveUserEntitlement = true,
                proAccessLoading = false,
                isPro = false,
                paywallDismissed = false,
                testPaywallOverride = false,
            ),
        )
    }

    @Test
    fun `normal Pro or admin access suppresses post-onboarding paywall`() {
        assertFalse(
            shouldPresentPostOnboardingPaywall(
                phase = RootRouter.Phase.Ready,
                authenticated = true,
                hasResolvedActiveUserEntitlement = true,
                proAccessLoading = false,
                isPro = true,
                paywallDismissed = false,
                testPaywallOverride = false,
            ),
        )
    }

    @Test
    fun `explicit test replay shows paywall for Pro admin once`() {
        assertTrue(
            shouldPresentPostOnboardingPaywall(
                phase = RootRouter.Phase.Ready,
                authenticated = true,
                hasResolvedActiveUserEntitlement = true,
                proAccessLoading = false,
                isPro = true,
                paywallDismissed = false,
                testPaywallOverride = true,
            ),
        )
        assertFalse(
            shouldPresentPostOnboardingPaywall(
                phase = RootRouter.Phase.Ready,
                authenticated = true,
                hasResolvedActiveUserEntitlement = true,
                proAccessLoading = false,
                isPro = true,
                paywallDismissed = true,
                testPaywallOverride = true,
            ),
        )
    }

    @Test
    fun `paywall waits for root and access resolution`() {
        assertFalse(
            shouldPresentPostOnboardingPaywall(
                phase = RootRouter.Phase.Onboarding,
                authenticated = true,
                hasResolvedActiveUserEntitlement = true,
                proAccessLoading = false,
                isPro = false,
                paywallDismissed = false,
                testPaywallOverride = false,
            ),
        )
        assertFalse(
            shouldPresentPostOnboardingPaywall(
                phase = RootRouter.Phase.Ready,
                authenticated = true,
                hasResolvedActiveUserEntitlement = false,
                proAccessLoading = false,
                isPro = false,
                paywallDismissed = false,
                testPaywallOverride = false,
            ),
        )
        assertFalse(
            shouldPresentPostOnboardingPaywall(
                phase = RootRouter.Phase.Ready,
                authenticated = true,
                hasResolvedActiveUserEntitlement = true,
                proAccessLoading = true,
                isPro = false,
                paywallDismissed = false,
                testPaywallOverride = false,
            ),
        )
    }

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
