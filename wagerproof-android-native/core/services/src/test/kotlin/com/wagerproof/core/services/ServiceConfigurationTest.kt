package com.wagerproof.core.services

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ServiceConfigurationTest {
    @Test
    fun revenueCatUsesAndroidPublicSdkKey() {
        assertTrue(RevenueCatService.REVENUECAT_API_KEY.startsWith("goog_"))
        assertFalse(RevenueCatService.REVENUECAT_API_KEY.contains("TODO", ignoreCase = true))
    }

    @Test
    fun googleCredentialAudienceUsesWebClientId() {
        assertTrue(GoogleSignInHelper.GOOGLE_WEB_CLIENT_ID.endsWith(".apps.googleusercontent.com"))
        assertFalse(GoogleSignInHelper.GOOGLE_WEB_CLIENT_ID.contains("TODO", ignoreCase = true))
    }
}
