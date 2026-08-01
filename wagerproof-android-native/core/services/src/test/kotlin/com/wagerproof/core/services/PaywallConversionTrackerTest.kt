package com.wagerproof.core.services

import java.math.BigDecimal
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * The Meta conversion payload is only as good as these four pure helpers: a
 * wrong order id means RevenueCat's server-side event can't dedupe against
 * ours, and a wrong subscription type silently mislabels every LTV signal.
 */
class PaywallConversionTrackerTest {

    // MARK: - Order id

    @Test
    fun `prefers the real Play order id`() {
        assertEquals(
            "GPA.1234-5678-9012-34567",
            PaywallConversionTracker.resolveOrderId(
                transactionOrderId = "GPA.1234-5678-9012-34567",
                productId = "wagerproof_pro_yearly",
                purchaseTimeMillis = 1_700_000_000_000,
            ),
        )
    }

    @Test
    fun `synthesizes a stable id when Play leaves orderId null`() {
        // Play omits orderId for test purchases and some promo flows. Dropping
        // the event there would silently lose the conversion; a synthesized id
        // is stable across repeat deliveries of the SAME purchase.
        val first = PaywallConversionTracker.resolveOrderId(null, "wagerproof_pro_yearly", 1_700_000_000_123)
        val redelivered = PaywallConversionTracker.resolveOrderId(null, "wagerproof_pro_yearly", 1_700_000_000_456)
        assertEquals("wagerproof_pro_yearly_1700000000", first)
        // Same second → same id, so the dedup below catches the redelivery.
        assertEquals(first, redelivered)
    }

    @Test
    fun `treats a blank order id as missing`() {
        assertEquals(
            "wagerproof_pro_monthly_1700000000",
            PaywallConversionTracker.resolveOrderId("   ", "wagerproof_pro_monthly", 1_700_000_000_000),
        )
    }

    @Test
    fun `returns null when there is neither an order id nor a purchase time`() {
        assertNull(PaywallConversionTracker.resolveOrderId(null, "wagerproof_pro_yearly", null))
    }

    // MARK: - Dedup

    @Test
    fun `claim appends a new order id`() {
        val updated = PaywallConversionTracker.claimedOrderIds(listOf("a", "b"), "c", max = 300)
        assertEquals(listOf("a", "b", "c"), updated)
    }

    @Test
    fun `claim rejects an id already reported`() {
        assertNull(PaywallConversionTracker.claimedOrderIds(listOf("a", "b"), "b", max = 300))
    }

    @Test
    fun `claim trims the oldest ids past the cap`() {
        val fired = (1..300).map { "order_$it" }
        val updated = PaywallConversionTracker.claimedOrderIds(fired, "order_301", max = 300)
        assertEquals(300, updated?.size)
        assertFalse(updated!!.contains("order_1"))
        assertTrue(updated.contains("order_301"))
        assertEquals("order_2", updated.first())
    }

    // MARK: - Subscription type + LTV

    @Test
    fun `classifies subscription types the same way iOS does`() {
        assertEquals("lifetime", PaywallConversionTracker.subscriptionType("wagerproof_lifetime"))
        assertEquals("yearly", PaywallConversionTracker.subscriptionType("wagerproof_pro_annual"))
        assertEquals("yearly", PaywallConversionTracker.subscriptionType("WagerProof_Pro_Yearly"))
        assertEquals("monthly", PaywallConversionTracker.subscriptionType("wagerproof_pro_monthly"))
        assertEquals("unknown", PaywallConversionTracker.subscriptionType("wagerproof_promo"))
    }

    @Test
    fun `applies the coarse LTV multipliers`() {
        assertEquals(
            BigDecimal("39.96"),
            PaywallConversionTracker.predictedLtv(BigDecimal("9.99"), "monthly"),
        )
        assertEquals(
            BigDecimal("103.987"),
            PaywallConversionTracker.predictedLtv(BigDecimal("79.99"), "yearly"),
        )
        // Lifetime / unknown pass through untouched — no renewal to project.
        assertEquals(
            BigDecimal("199.99"),
            PaywallConversionTracker.predictedLtv(BigDecimal("199.99"), "lifetime"),
        )
    }

    // MARK: - Product matching + price

    @Test
    fun `matches Play's productId colon basePlanId form against a bare productId`() {
        assertTrue(PaywallConversionTracker.matchesProductId("wagerproof_pro:p1y", "wagerproof_pro"))
        assertTrue(PaywallConversionTracker.matchesProductId("wagerproof_pro", "wagerproof_pro"))
        assertFalse(PaywallConversionTracker.matchesProductId("wagerproof_plus:p1y", "wagerproof_pro"))
    }

    @Test
    fun `converts micros without losing localized currency precision`() {
        assertEquals(BigDecimal("9.99"), PaywallConversionTracker.microsToAmount(9_990_000))
        assertEquals(BigDecimal.ZERO, PaywallConversionTracker.microsToAmount(0))
        assertEquals(BigDecimal("1.005"), PaywallConversionTracker.microsToAmount(1_005_000))
        assertEquals(BigDecimal("1.234"), PaywallConversionTracker.microsToAmount(1_234_000))
    }
}
