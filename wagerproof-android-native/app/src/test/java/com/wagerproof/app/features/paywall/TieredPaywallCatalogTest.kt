package com.wagerproof.app.features.paywall

import com.wagerproof.core.models.SubscriptionTier
import org.junit.Assert.*
import org.junit.Test

class TieredPaywallCatalogTest {
    @Test fun packagesMatchSavedPlayBasePlans() {
        for (tier in SubscriptionTier.entries) for (yearly in listOf(false,true)) {
            val period = if(yearly) "yearly" else "monthly"
            assertEquals("${tier.slug}_$period", TieredPaywallCatalog.packageId(tier,yearly))
            assertEquals("wp_tiers_${tier.slug}:$period", TieredPaywallCatalog.productId(tier,yearly))
        }
    }
    @Test fun exactPricesAndAnnualComparisonsMatchIos() {
        assertEquals(listOf(1999,2999,7999),SubscriptionTier.entries.map { TieredPaywallCatalog.priceCents(it,false) })
        assertEquals(listOf(19999,29999,35999),SubscriptionTier.entries.map { TieredPaywallCatalog.priceCents(it,true) })
        assertEquals(71988,TieredPaywallCatalog.comparisonCents(SubscriptionTier.PREMIUM,true))
        assertEquals(155988,TieredPaywallCatalog.comparisonCents(SubscriptionTier.PRO,true))
        assertEquals(58,TieredPaywallCatalog.savings(29999,71988))
        assertEquals(77,TieredPaywallCatalog.savings(35999,155988))
    }
    @Test fun checkoutRequiresMatchingAuthenticatedIdentityAndTrustedHost() {
        val uid = "12345678-1234-1234-1234-123456789abc"
        assertEquals("https://pay.rev.cat/test/$uid?currency=USD", TieredPaywallCatalog.hostedUrl("https://pay.rev.cat/test/",uid,uid))
        assertNull(TieredPaywallCatalog.hostedUrl("https://pay.rev.cat/test/", "anonymous", uid))
        for(base in listOf("http://pay.rev.cat/test", "https://example.com/test", "https://user@pay.rev.cat/test", "https://pay.rev.cat/test?package_id=pro", "https://pay.rev.cat/a/b"))
            assertNull(TieredPaywallCatalog.hostedUrl(base,uid,uid))
    }
    @Test fun featureAnchorsAreAssignedToCorrectTier() {
        assertEquals(listOf(4,4,3), SubscriptionTier.entries.map { tier -> TieredPaywallCatalog.features.count { it.tier == tier } })
        assertEquals(SubscriptionTier.PRO,TieredPaywallCatalog.features.single { it.id == "agents" }.tier)
        assertEquals(SubscriptionTier.PREMIUM,TieredPaywallCatalog.features.single { it.id == "props" }.tier)
    }
}
