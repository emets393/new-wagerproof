package com.wagerproof.core.services

import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class RevenueCatSubscriberIdentityTest {

    @Test
    fun cachedIdentityMatchesOnlyItsNormalizedSupabaseUser() {
        val identity = identity(" USER-A ")

        assertNotNull(RevenueCatService.matchingSubscriberIdentity(identity, "user-a"))
        assertNull(RevenueCatService.matchingSubscriberIdentity(identity, "user-b"))
    }

    @Test
    fun missingIdentityNeverMatchesAUser() {
        assertNull(RevenueCatService.matchingSubscriberIdentity(null, "user-a"))
    }

    private fun identity(userId: String) = RevenueCatService.SubscriberIdentity(
        userId = RevenueCatService.normalizeUserId(userId),
        email = "owner@example.com",
        displayName = "Owner",
        phoneNumber = null,
        authProvider = "email",
        username = "owner",
        accountCreatedAt = null,
    )
}
