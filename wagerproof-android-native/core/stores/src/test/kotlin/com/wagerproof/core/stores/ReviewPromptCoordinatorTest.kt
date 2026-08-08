package com.wagerproof.core.stores

import java.time.ZoneOffset
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ReviewPromptCoordinatorTest {
    @Test
    fun generatedPicksRequireTwoViewsAndOnlyAttemptOncePerVersion() {
        val coordinator = makeCoordinator(FakeReviewPromptStorage())

        coordinator.recordGeneratedPicksViewed()
        assertNull(coordinator.pendingRequest)

        coordinator.recordGeneratedPicksViewed()
        val request = requireNotNull(coordinator.pendingRequest)
        assertEquals(ReviewPromptCoordinator.Trigger.GeneratedPicksViewed, request.trigger)
        assertTrue(coordinator.claim(request))

        coordinator.recordSystemSaved()
        assertNull(coordinator.pendingRequest)
    }

    @Test
    fun saveAndCompletedShareAreImmediateHighConfidenceSignals() {
        val saveCoordinator = makeCoordinator(FakeReviewPromptStorage())
        saveCoordinator.recordSystemSaved()
        assertEquals(ReviewPromptCoordinator.Trigger.SystemSaved, saveCoordinator.pendingRequest?.trigger)

        val shareCoordinator = makeCoordinator(FakeReviewPromptStorage())
        shareCoordinator.recordContentShared()
        assertEquals(ReviewPromptCoordinator.Trigger.ContentShared, shareCoordinator.pendingRequest?.trigger)
    }

    @Test
    fun researchDepthRequiresThreeDetailsAcrossTwoActiveDays() {
        val storage = FakeReviewPromptStorage()
        var now = 1_800_000_000_000L
        val coordinator = makeCoordinator(storage, nowMillis = { now })

        coordinator.recordAppActive()
        coordinator.recordResearchDetailViewed()
        coordinator.recordResearchDetailViewed()
        assertNull(coordinator.pendingRequest)

        now += DAY_MILLIS
        coordinator.recordAppActive()
        coordinator.recordResearchDetailViewed()
        assertEquals(ReviewPromptCoordinator.Trigger.ResearchDepthReached, coordinator.pendingRequest?.trigger)
    }

    @Test
    fun secondExistingAgentAndLaterSessionRevisitAreEligible() {
        val secondAgentCoordinator = makeCoordinator(FakeReviewPromptStorage(), sessionID = "session-a")
        secondAgentCoordinator.recordAgentCreated(agentID = "agent-2", totalAgentCount = 2)
        assertEquals(ReviewPromptCoordinator.Trigger.SecondAgentCreated, secondAgentCoordinator.pendingRequest?.trigger)

        val revisitStorage = FakeReviewPromptStorage()
        val creationCoordinator = makeCoordinator(revisitStorage, sessionID = "creation-session")
        creationCoordinator.recordAgentCreated(agentID = "agent-1", totalAgentCount = 1)
        creationCoordinator.recordAgentDetailViewed(agentID = "agent-1")
        assertNull(creationCoordinator.pendingRequest)

        val returnCoordinator = makeCoordinator(revisitStorage, sessionID = "return-session")
        returnCoordinator.recordAgentDetailViewed(agentID = "agent-1")
        assertEquals(ReviewPromptCoordinator.Trigger.CreatedAgentRevisited, returnCoordinator.pendingRequest?.trigger)
    }

    @Test
    fun manualReviewIntentSuppressesAutomaticRequests() {
        val coordinator = makeCoordinator(FakeReviewPromptStorage())
        coordinator.recordManualReviewLinkOpened()
        coordinator.recordSystemSaved()
        coordinator.recordContentShared()
        assertNull(coordinator.pendingRequest)
    }

    @Test
    fun newVersionStillHonorsOneHundredTwentyDayCooldown() {
        val storage = FakeReviewPromptStorage()
        var now = 1_800_000_000_000L
        var version = "1.0"
        val coordinator = makeCoordinator(storage, nowMillis = { now }, appVersion = { version })

        coordinator.recordSystemSaved()
        assertTrue(coordinator.claim(requireNotNull(coordinator.pendingRequest)))

        version = "1.1"
        now += 30L * DAY_MILLIS
        coordinator.recordContentShared()
        assertNull(coordinator.pendingRequest)

        now += 91L * DAY_MILLIS
        coordinator.recordContentShared()
        assertEquals(ReviewPromptCoordinator.Trigger.ContentShared, coordinator.pendingRequest?.trigger)
    }

    @Test
    fun claimRecordsAnAttemptAndCancelDoesNot() {
        val storage = FakeReviewPromptStorage()
        val coordinator = makeCoordinator(storage)
        coordinator.recordSystemSaved()
        val cancelled = requireNotNull(coordinator.pendingRequest)
        coordinator.cancel(cancelled)
        assertNull(storage.values["app-review.last-attempt-version"])

        coordinator.recordSystemSaved()
        val claimed = requireNotNull(coordinator.pendingRequest)
        assertTrue(coordinator.claim(claimed))
        assertEquals("1.0", storage.values["app-review.last-attempt-version"])
        assertEquals("systemSaved", storage.values["app-review.last-attempt-trigger"])
        assertFalse(coordinator.claim(claimed))
    }

    private fun makeCoordinator(
        storage: ReviewPromptStorage,
        nowMillis: () -> Long = { 1_800_000_000_000L },
        appVersion: () -> String = { "1.0" },
        sessionID: String = "session",
    ): ReviewPromptCoordinator = ReviewPromptCoordinator(
        storage = storage,
        nowMillis = nowMillis,
        appVersion = appVersion,
        sessionID = sessionID,
        requestID = { "request" },
        zoneID = ZoneOffset.UTC,
    )

    private class FakeReviewPromptStorage : ReviewPromptStorage {
        val values = mutableMapOf<String, Any>()

        override fun getInt(key: String): Int? = values[key] as? Int
        override fun getLong(key: String): Long? = values[key] as? Long
        override fun getString(key: String): String? = values[key] as? String
        override fun getBoolean(key: String): Boolean? = values[key] as? Boolean
        @Suppress("UNCHECKED_CAST")
        override fun getStringSet(key: String): Set<String>? = values[key] as? Set<String>
        override fun putInt(key: String, value: Int) { values[key] = value }
        override fun putLong(key: String, value: Long) { values[key] = value }
        override fun putString(key: String, value: String) { values[key] = value }
        override fun putBoolean(key: String, value: Boolean) { values[key] = value }
        override fun putStringSet(key: String, value: Set<String>) { values[key] = value.toSet() }
        override fun remove(key: String) { values.remove(key) }
    }

    private companion object {
        const val DAY_MILLIS = 24L * 60L * 60L * 1_000L
    }
}
