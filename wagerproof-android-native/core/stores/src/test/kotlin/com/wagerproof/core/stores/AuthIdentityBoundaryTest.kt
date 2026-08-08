package com.wagerproof.core.stores

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AuthIdentityBoundaryTest {

    @Test
    fun freshAttachDoesNotPretendThereIsADepartingAccount() {
        assertFalse(AuthStore.shouldClearForAccountTransition(null, "user-a"))
    }

    @Test
    fun tokenRefreshForSameNormalizedUserKeepsIdentity() {
        assertFalse(AuthStore.shouldClearForAccountTransition(" USER-A ", "user-a"))
        assertFalse(AuthStore.shouldDiscardProfile("USER-A", "user-a"))
    }

    @Test
    fun directAccountReplacementClearsIdentityAndOldProfile() {
        assertTrue(AuthStore.shouldClearForAccountTransition("user-a", "user-b"))
        assertTrue(AuthStore.shouldDiscardProfile("user-a", "user-b"))
    }
}
