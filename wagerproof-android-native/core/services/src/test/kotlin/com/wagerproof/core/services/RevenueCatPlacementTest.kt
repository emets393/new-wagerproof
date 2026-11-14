@file:Suppress("INVISIBLE_MEMBER", "INVISIBLE_REFERENCE")

package com.wagerproof.core.services

import com.revenuecat.purchases.Offering
import com.revenuecat.purchases.Offerings
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class RevenueCatPlacementTest {
    private val legacy = Offering("hardPaywall", "Legacy", emptyMap(), emptyList())
    private val tiered = Offering("wagerproof_tiers_v1", "Tiers", emptyMap(), emptyList())
    private fun offerings(placements: Offerings.Placements?) = Offerings(
        legacy, mapOf(legacy.identifier to legacy, tiered.identifier to tiered), placements, null,
    )

    @Test fun explicitNoOfferingDoesNotUseCurrentOrPlacementFallback() {
        val response = offerings(Offerings.Placements(legacy.identifier, mapOf("onboarding" to null)))
        assertNull(RevenueCatService.resolvePlacement(response, "onboarding"))
    }

    @Test fun selectedPlacementKeepsItsAssignedOffering() {
        val response = offerings(Offerings.Placements(legacy.identifier, mapOf("tier_upgrade" to tiered.identifier)))
        assertEquals(tiered.identifier, RevenueCatService.resolvePlacement(response, "tier_upgrade")?.identifier)
    }

    @Test fun sdkFallbackStillAppliesToAnUnassignedPlacement() {
        val response = offerings(Offerings.Placements(legacy.identifier, emptyMap()))
        assertEquals(legacy.identifier, RevenueCatService.resolvePlacement(response, "generic_feature")?.identifier)
    }

    @Test fun noOfferingFallbackDoesNotUseCurrent() {
        val response = offerings(Offerings.Placements(null, emptyMap()))
        assertNull(RevenueCatService.resolvePlacement(response, "generic_feature"))
    }

    @Test fun missingPlacementDataDoesNotInventAnOffering() {
        assertNull(RevenueCatService.resolvePlacement(offerings(null), "onboarding"))
    }
}
