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
    fun authoritativeFlowIsTwentyOneCarouselPagesThenThreeCinematics() {
        // ATT_PRIMING (no ATT on Android) and PERSONALIZED_VALUE (retired on iOS
        // for unsupported performance claims) are deliberately absent.
        val expected = listOf(
            "TERMS", "BETTOR_TYPE", "BETTING_PITFALLS",
            "ACQUISITION_SOURCE", "PRIMARY_GOAL", "RESEARCH_TIME", "WEEKLY_STAKES",
            "RESEARCH_COST", "RESEARCH_RECLAIM", "AGENT_HQ", "AGENT_VALUE_INTRO",
            "AGENT_VALUE_PROOF", "AGENT_LEADERBOARD", "BUILDER_SPORTS", "BUILDER_ARCHETYPE",
            "BUILDER_MINDSET", "BUILDER_BET_STYLE", "BUILDER_DATA_TRUST",
            "BUILDER_SPORT_RULES", "BUILDER_INSIGHTS", "BUILDER_IDENTITY",
            "GENERATION", "REVEAL", "TIME_SUMMARY",
        )
        assertEquals(expected, OnboardingStore.Step.entries.map { it.name })
        assertEquals((1..24).toList(), OnboardingStore.Step.entries.map { it.raw })
        assertEquals(21, OnboardingStore.Step.carouselPageCount)

        OnboardingStore.Step.entries.take(21).forEachIndexed { index, step ->
            assertFalse(step.isCinematic)
            assertEquals(index, step.carouselIndex)
            assertEquals((index + 1) / 21.0, step.progress)
        }
        OnboardingStore.Step.entries.takeLast(3).forEach { step ->
            assertTrue(step.isCinematic)
            assertNull(step.carouselIndex)
            assertNull(step.progress)
        }
    }

    @Test
    fun validationMatchesTheCurrentIosQuestionsAndBuilder() {
        val store = OnboardingStore()

        assertFalse(store.canAdvance(OnboardingStore.Step.TERMS))
        // Store-level invariant: a direct/a11y/future caller cannot bypass the
        // required terms scroll even if it asks to check the box early.
        store.setTermsChecked(true)
        assertFalse(store.hasCheckedTerms)
        assertFalse(store.canAdvance(OnboardingStore.Step.TERMS))
        store.setTermsScrolledToBottom()
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

        assertFalse(store.canAdvance(OnboardingStore.Step.RESEARCH_TIME))
        store.setResearchTimeBucket("h1to2")
        assertTrue(store.canAdvance(OnboardingStore.Step.RESEARCH_TIME))

        assertFalse(store.canAdvance(OnboardingStore.Step.WEEKLY_STAKES))
        store.setWeeklyStakesBucket("h150to400")
        assertTrue(store.canAdvance(OnboardingStore.Step.WEEKLY_STAKES))

        assertFalse(store.canAdvance(OnboardingStore.Step.RESEARCH_COST))
        store.setCostRevealSeen()
        assertTrue(store.canAdvance(OnboardingStore.Step.RESEARCH_COST))

        assertFalse(store.canAdvance(OnboardingStore.Step.RESEARCH_RECLAIM))
        store.setReclaimRevealSeen()
        assertTrue(store.canAdvance(OnboardingStore.Step.RESEARCH_RECLAIM))

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
    fun changingEitherPersonalizationAnswerInvalidatesBothRevealGates() {
        val store = OnboardingStore()
        store.setResearchTimeBucket("h1to2")
        store.setWeeklyStakesBucket("h150to400")
        store.setCostRevealSeen()
        store.setReclaimRevealSeen()

        // Re-selecting the same answer is idempotent and must not make an
        // already-landed page replay on a harmless repeated event.
        store.setResearchTimeBucket("h1to2")
        assertTrue(store.hasSeenCostReveal)
        assertTrue(store.hasSeenReclaimReveal)

        store.setResearchTimeBucket("h2to3")
        assertFalse(store.hasSeenCostReveal)
        assertFalse(store.hasSeenReclaimReveal)

        store.setCostRevealSeen()
        store.setReclaimRevealSeen()
        store.setWeeklyStakesBucket("h400to1000")
        assertFalse(store.hasSeenCostReveal)
        assertFalse(store.hasSeenReclaimReveal)
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
        store.setResearchTimeBucket("h3to4")
        store.setWeeklyStakesBucket("h400to1000")
        store.setCostRevealSeen()
        store.setReclaimRevealSeen()
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
        assertFalse(store.hasSeenCostReveal)
        assertFalse(store.hasSeenReclaimReveal)
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
