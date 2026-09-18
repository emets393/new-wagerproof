package com.wagerproof.core.models

import kotlin.test.*

class SubscriptionTierTest {
    @Test fun renamedLabelsKeepBillingIds() {
        assertEquals(listOf("Premium", "Premium Plus", "Pro"), SubscriptionTier.entries.map { it.title })
        assertEquals(listOf("WagerProof Standard", "WagerProof Premium", "WagerProof Pro"), SubscriptionTier.entries.map { it.entitlementId })
    }
    @Test fun highestEntitlementWinsAndLegacyProRetainsEverything() {
        assertEquals(SubscriptionTier.PRO, SubscriptionTier.resolve(setOf("WagerProof Pro", "WagerProof Standard")))
        for (minimum in SubscriptionTier.entries) assertTrue(SubscriptionAccessState(SubscriptionTier.PRO, false).hasAccess(minimum))
        assertFalse(SubscriptionTier.isTieredCustomer(setOf("legacy_yearly", "legacy_lifetime"), setOf("WagerProof Pro")))
    }
    @Test fun cumulativeAccessMatrixIncludesExpiredCatalogCustomers() {
        for (tier in listOf(null) + SubscriptionTier.entries) {
            val access = SubscriptionAccessState(tier, true)
            for (minimum in SubscriptionTier.entries) {
                val permitted = tier != null && tier.ordinal >= minimum.ordinal
                assertEquals(permitted, access.hasAccess(minimum))
                assertEquals(!permitted, access.isRestricted(minimum))
            }
        }
    }
    @Test fun newRestrictionsNeverEnrollLegacyFreeUsers() {
        val legacy = SubscriptionAccessState(null, false)
        assertFalse(legacy.hasAccess(SubscriptionTier.STANDARD))
        SubscriptionTier.entries.forEach { assertFalse(legacy.isRestricted(it)) }
    }
    @Test fun expiredTieredProductsRetainCohort() {
        for (product in listOf("wp_tiers_standard:monthly", "wp_tiers_premium:yearly", "wp_tiers_pro_yearly_web", "com.wagerproof.mobile.tiers.pro_monthly")) {
            assertTrue(SubscriptionTier.isTieredCustomer(setOf(product), emptySet()))
        }
    }
    @Test fun previewsCannotAffectReleaseAccessOrGrantAdmin() {
        for (preview in EntitlementPreview.entries) {
            assertEquals(SubscriptionAccessState(SubscriptionTier.STANDARD,true), SubscriptionAccessState.resolve(SubscriptionTier.STANDARD,true,false,false,preview,false))
        }
        assertEquals(SubscriptionAccessState(null,true), SubscriptionAccessState.resolve(SubscriptionTier.PRO,false,true,false,EntitlementPreview.NEW_FREE,true))
    }
    @Test fun forceFreeOverridesAdminWithoutChangingCohort() {
        val free = SubscriptionAccessState.resolve(SubscriptionTier.PRO,false,true,true,EntitlementPreview.ACTUAL,true)
        assertFalse(free.hasAccess(SubscriptionTier.PRO)); assertFalse(free.isTiered)
    }
}
