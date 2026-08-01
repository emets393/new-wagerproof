package com.wagerproof.core.stores

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RootRouterTest {
    private fun router(
        persistence: FakeTestPaywallOverridePersistence = FakeTestPaywallOverridePersistence(),
    ) = RootRouter().also { it.testPaywallOverridePersistence = persistence }

    @Test
    fun `authenticated account must complete onboarding before ready`() {
        val router = router()
        val account = AuthStore.Phase.Authenticated("user-1")

        router.resolve(account, onboardingComplete = false)
        assertEquals(RootRouter.Phase.Onboarding, router.phase)

        router.resolve(account, onboardingComplete = true)
        assertEquals(RootRouter.Phase.Ready, router.phase)
    }

    @Test
    fun `secret settings replay forces onboarding and persists for its owner`() {
        val persistence = FakeTestPaywallOverridePersistence()
        val router = router(persistence)

        router.forceOnboardingForTestingNow(" USER-1 ")
        assertEquals(RootRouter.Phase.Onboarding, router.phase)
        assertTrue(router.testPaywallOverride)
        assertEquals("user-1", persistence.userId)

        val recreated = router(persistence)
        recreated.restoreTestPaywallOverride("user-1")
        recreated.resolve(AuthStore.Phase.Authenticated("user-1"), onboardingComplete = true)
        assertEquals(RootRouter.Phase.Ready, recreated.phase)
        assertTrue(recreated.testPaywallOverride)

        recreated.clearTestPaywallOverride()
        assertFalse(recreated.testPaywallOverride)
        assertEquals(null, persistence.userId)
    }

    @Test
    fun `persisted test replay never crosses account identities`() {
        val persistence = FakeTestPaywallOverridePersistence("user-a")
        val router = router(persistence)

        router.restoreTestPaywallOverride("user-b")

        assertFalse(router.testPaywallOverride)
        assertEquals(null, persistence.userId)
    }

    @Test
    fun `sign out clears persisted test replay`() {
        val persistence = FakeTestPaywallOverridePersistence("user-1")
        val router = router(persistence)
        router.restoreTestPaywallOverride("user-1")

        router.resolve(AuthStore.Phase.Unauthenticated, onboardingComplete = false)

        assertEquals(RootRouter.Phase.Unauthenticated, router.phase)
        assertFalse(router.testPaywallOverride)
        assertEquals(null, persistence.userId)
    }
}

private class FakeTestPaywallOverridePersistence(
    var userId: String? = null,
) : TestPaywallOverridePersistence {
    override fun readUserId(): String? = userId
    override fun writeUserId(userId: String) {
        this.userId = userId
    }
    override fun clear() {
        userId = null
    }
}
