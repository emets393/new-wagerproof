package com.wagerproof.app.features.onboarding

import com.wagerproof.core.models.SportLeague
import com.wagerproof.core.stores.OnboardingStore
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.runBlocking

class OnboardingFlowContractTest {
    @Test
    fun authoritativeFlowIsEighteenCarouselPagesThenTwoCinematics() {
        val expected = listOf(
            "TERMS", "BETTOR_TYPE", "BETTING_PITFALLS", "PERSONALIZED_VALUE",
            "ACQUISITION_SOURCE", "PRIMARY_GOAL", "AGENT_HQ", "AGENT_VALUE_INTRO",
            "AGENT_VALUE_PROOF", "ATT_PRIMING", "BUILDER_SPORTS", "BUILDER_ARCHETYPE",
            "BUILDER_MINDSET", "BUILDER_BET_STYLE", "BUILDER_DATA_TRUST",
            "BUILDER_SPORT_RULES", "BUILDER_INSIGHTS", "BUILDER_IDENTITY",
            "GENERATION", "REVEAL",
        )
        assertEquals(expected, OnboardingStore.Step.entries.map { it.name })
        assertEquals((1..20).toList(), OnboardingStore.Step.entries.map { it.raw })
        assertEquals(18, OnboardingStore.Step.carouselPageCount)

        OnboardingStore.Step.entries.take(18).forEachIndexed { index, step ->
            assertFalse(step.isCinematic)
            assertEquals(index, step.carouselIndex)
            assertEquals((index + 1) / 18.0, step.progress)
        }
        OnboardingStore.Step.entries.takeLast(2).forEach { step ->
            assertTrue(step.isCinematic)
            assertNull(step.carouselIndex)
            assertNull(step.progress)
        }
    }

    @Test
    fun validationMatchesTheCurrentIosQuestionsAndBuilder() {
        val store = OnboardingStore()

        assertFalse(store.canAdvance(OnboardingStore.Step.TERMS))
        store.setTermsChecked(true)
        assertTrue(store.canAdvance(OnboardingStore.Step.TERMS))

        assertFalse(store.canAdvance(OnboardingStore.Step.BETTOR_TYPE))
        store.setBettorType(OnboardingStore.BettorType.Serious)
        assertTrue(store.canAdvance(OnboardingStore.Step.BETTOR_TYPE))

        // Pitfalls are intentionally optional and multi-select.
        assertTrue(store.canAdvance(OnboardingStore.Step.BETTING_PITFALLS))
        store.toggleBettingPitfall("Tilt Betting")
        store.toggleBettingPitfall("FOMO Bets")
        assertEquals(listOf("Tilt Betting", "FOMO Bets"), store.survey.bettingPitfalls)

        assertFalse(store.canAdvance(OnboardingStore.Step.ACQUISITION_SOURCE))
        store.setAcquisitionSource("Friend/Referral")
        assertTrue(store.canAdvance(OnboardingStore.Step.ACQUISITION_SOURCE))

        assertFalse(store.canAdvance(OnboardingStore.Step.PRIMARY_GOAL))
        store.setMainGoal("Find profitable edges faster")
        assertTrue(store.canAdvance(OnboardingStore.Step.PRIMARY_GOAL))

        assertFalse(store.canAdvance(OnboardingStore.Step.BUILDER_SPORTS))
        store.setAgentSports(listOf(SportLeague.NFL))
        assertTrue(store.canAdvance(OnboardingStore.Step.BUILDER_SPORTS))

        assertFalse(store.canAdvance(OnboardingStore.Step.BUILDER_ARCHETYPE))
        store.setArchetypeChosen()
        assertTrue(store.canAdvance(OnboardingStore.Step.BUILDER_ARCHETYPE))

        assertFalse(store.canAdvance(OnboardingStore.Step.BUILDER_IDENTITY))
        store.setAgentName("The Oracle")
        assertTrue(store.canAdvance(OnboardingStore.Step.BUILDER_IDENTITY))
        store.setAgentName("x".repeat(51))
        assertFalse(store.canAdvance(OnboardingStore.Step.BUILDER_IDENTITY))
    }

    @Test
    fun resetClearsEveryPersistedAndTransientAnswer() {
        val store = OnboardingStore()
        store.setTermsChecked(true)
        store.setTermsScrolledToBottom()
        store.setBettorType(OnboardingStore.BettorType.Professional)
        store.toggleBettingPitfall("Overbetting")
        store.setAcquisitionSource("TikTok")
        store.setMainGoal("Track my performance over time")
        store.setAgentSports(listOf(SportLeague.NBA))
        store.setArchetypeChosen()
        store.setAgentPitchSlide(2)
        store.setAgentName("Reset Me")

        store.resetToStart()

        assertEquals(OnboardingStore.Step.TERMS, store.currentStep)
        assertEquals(OnboardingStore.SurveyAnswers(), store.survey)
        assertEquals(OnboardingStore.AgentDraft(), store.agentDraft)
        assertFalse(store.hasCheckedTerms)
        assertFalse(store.hasScrolledTermsToBottom)
        assertFalse(store.hasChosenArchetype)
        assertEquals(0, store.agentPitchSlide)
    }

    @Test
    fun remoteResetRefusesToMutateWithoutAnAttachedUser() = runBlocking {
        val store = OnboardingStore()
        store.setAgentName("Keep Me")

        val result = store.resetRemoteAndLocal()

        assertTrue(result is OnboardingStore.RemoteResetResult.Failure)
        assertEquals("Keep Me", store.agentDraft.name)
    }
}
