package com.wagerproof.core.stores

import kotlin.test.*

class AchievementOnboardingTest {
    @Test fun insertionPreservesExistingRawIdsAndCarouselOrder() {
        val steps = OnboardingStore.Step.entries
        val achievement = OnboardingStore.Step.ACHIEVEMENTS
        assertEquals(OnboardingStore.Step.AGENT_LEADERBOARD, steps[achievement.ordinal - 1])
        assertEquals(OnboardingStore.Step.BUILDER_SPORTS, steps[achievement.ordinal + 1])
        assertEquals(25, achievement.raw)
        assertEquals(14, OnboardingStore.Step.BUILDER_SPORTS.raw)
        assertEquals(22, OnboardingStore.Step.GENERATION.raw)
        assertEquals(13, achievement.carouselIndex)
        assertEquals(22, OnboardingStore.Step.carouselPageCount)
        assertEquals(1.0, OnboardingStore.Step.BUILDER_IDENTITY.progress)
        assertNull(OnboardingStore.Step.GENERATION.carouselIndex)
        assertEquals(steps.size, steps.map { it.raw }.toSet().size)
    }
}
