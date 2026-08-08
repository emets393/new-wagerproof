package com.wagerproof.core.stores

import android.content.SharedPreferences
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import java.time.Instant
import java.time.ZoneId
import java.util.UUID

/**
 * Collects high-confidence product-value events and turns them into at most one
 * pending Google Play review request.
 *
 * Play decides whether its system prompt appears and does not report whether a
 * rating was submitted. This coordinator therefore records review attempts and
 * explicit Play Store review intent, never a misleading "has reviewed" flag.
 */
@Stable
class ReviewPromptCoordinator internal constructor(
    private val storage: ReviewPromptStorage,
    private val nowMillis: () -> Long,
    private val appVersion: () -> String,
    private val sessionID: String,
    private val requestID: () -> String,
    private val zoneID: ZoneId,
) {
    enum class Trigger(val persistedValue: String) {
        GeneratedPicksViewed("generatedPicksViewed"),
        SystemSaved("systemSaved"),
        ContentShared("contentShared"),
        ResearchDepthReached("researchDepthReached"),
        SecondAgentCreated("secondAgentCreated"),
        CreatedAgentRevisited("createdAgentRevisited"),
    }

    data class Request(
        val id: String,
        val trigger: Trigger,
    )

    var pendingRequest: Request? by mutableStateOf(null)
        private set

    /** Record foreground use once per local calendar day. */
    fun recordAppActive() {
        val day = Instant.ofEpochMilli(nowMillis()).atZone(zoneID).toLocalDate().toString()
        val days = storage.getStringSet(Key.ActiveDays).orEmpty().toMutableSet()
        if (days.add(day)) {
            storage.putStringSet(Key.ActiveDays, days)
        }
        if (storage.getString(Key.LastRecordedSession) != sessionID) {
            storage.putString(Key.LastRecordedSession, sessionID)
        }
    }

    /** Fresh generated-pick reveals become eligible after two completed views. */
    fun recordGeneratedPicksViewed() {
        if (increment(Key.GenerationViews) >= GENERATED_PICKS_THRESHOLD) {
            enqueueIfEligible(Trigger.GeneratedPicksViewed)
        }
    }

    fun recordSystemSaved() {
        increment(Key.SavedSystems)
        enqueueIfEligible(Trigger.SystemSaved)
    }

    /** Call only when the platform can prove that the share completed. */
    fun recordContentShared() {
        increment(Key.CompletedShares)
        enqueueIfEligible(Trigger.ContentShared)
    }

    /** Counts exits from game, prop, and Outliers trend detail surfaces. */
    fun recordResearchDetailViewed() {
        val count = increment(Key.ResearchDetailViews)
        if (count >= RESEARCH_DETAIL_THRESHOLD && activeDayCount >= RESEARCH_ACTIVE_DAY_THRESHOLD) {
            enqueueIfEligible(Trigger.ResearchDepthReached)
        }
    }

    /** Existing agents still count toward the second-agent value threshold. */
    fun recordAgentCreated(agentID: String, totalAgentCount: Int) {
        val trackedCount = maxOf(increment(Key.AgentCount), totalAgentCount)
        storage.putInt(Key.AgentCount, trackedCount)
        storage.putString(Key.LastCreatedAgentID, agentID)
        storage.putString(Key.LastCreatedAgentSession, sessionID)
        storage.remove(Key.RevisitedCreatedAgentID)

        if (trackedCount >= 2) {
            enqueueIfEligible(Trigger.SecondAgentCreated)
        }
    }

    /** Immediate post-create navigation is ignored; a later app session counts. */
    fun recordAgentDetailViewed(agentID: String) {
        if (storage.getString(Key.LastCreatedAgentID) != agentID) return
        if (storage.getString(Key.LastCreatedAgentSession) == sessionID) return
        if (storage.getString(Key.RevisitedCreatedAgentID) == agentID) return

        if (enqueueIfEligible(Trigger.CreatedAgentRevisited)) {
            storage.putString(Key.RevisitedCreatedAgentID, agentID)
        }
    }

    /** A manual Play listing visit suppresses all future automatic requests. */
    fun recordManualReviewLinkOpened() {
        storage.putBoolean(Key.ManualReviewIntent, true)
        pendingRequest = null
    }

    /**
     * Atomically consumes a request immediately before the Play Review API is
     * invoked. This records an attempt even when Play elects not to show UI.
     */
    fun claim(request: Request): Boolean {
        if (pendingRequest != request || !passesGlobalEligibility()) return false
        storage.putString(Key.LastAttemptVersion, appVersion())
        storage.putLong(Key.LastAttemptDate, nowMillis())
        storage.putString(Key.LastAttemptTrigger, request.trigger.persistedValue)
        pendingRequest = null
        return true
    }

    /** Clears a request that became unsafe during the quiet presentation delay. */
    fun cancel(request: Request) {
        if (pendingRequest == request) {
            pendingRequest = null
        }
    }

    private val activeDayCount: Int
        get() = storage.getStringSet(Key.ActiveDays).orEmpty().size

    private fun enqueueIfEligible(trigger: Trigger): Boolean {
        if (pendingRequest != null || !passesGlobalEligibility()) return false
        pendingRequest = Request(id = requestID(), trigger = trigger)
        return true
    }

    private fun passesGlobalEligibility(): Boolean {
        if (storage.getBoolean(Key.ManualReviewIntent) == true) return false
        if (storage.getString(Key.LastAttemptVersion) == appVersion()) return false

        val lastAttempt = storage.getLong(Key.LastAttemptDate) ?: 0L
        if (lastAttempt > 0L && nowMillis() - lastAttempt < MINIMUM_ATTEMPT_INTERVAL_MILLIS) {
            return false
        }
        return true
    }

    private fun increment(key: String): Int {
        val next = (storage.getInt(key) ?: 0) + 1
        storage.putInt(key, next)
        return next
    }

    companion object {
        private const val GENERATED_PICKS_THRESHOLD = 2
        private const val RESEARCH_DETAIL_THRESHOLD = 3
        private const val RESEARCH_ACTIVE_DAY_THRESHOLD = 2
        private const val MILLIS_PER_DAY = 24L * 60L * 60L * 1_000L
        private const val MINIMUM_ATTEMPT_INTERVAL_MILLIS = 120L * MILLIS_PER_DAY

        fun standard(appVersion: () -> String): ReviewPromptCoordinator = ReviewPromptCoordinator(
            storage = SharedPreferencesReviewPromptStorage(StorePrefs.standard),
            nowMillis = System::currentTimeMillis,
            appVersion = appVersion,
            sessionID = UUID.randomUUID().toString(),
            requestID = { UUID.randomUUID().toString() },
            zoneID = ZoneId.systemDefault(),
        )
    }

    private object Key {
        const val ActiveDays = "app-review.active-days"
        const val LastRecordedSession = "app-review.last-recorded-session"
        const val GenerationViews = "app-review.generation-views"
        const val SavedSystems = "app-review.saved-systems"
        const val CompletedShares = "app-review.completed-shares"
        const val ResearchDetailViews = "app-review.research-detail-views"
        const val AgentCount = "app-review.agent-count"
        const val LastCreatedAgentID = "app-review.last-created-agent-id"
        const val LastCreatedAgentSession = "app-review.last-created-agent-session"
        const val RevisitedCreatedAgentID = "app-review.revisited-created-agent-id"
        const val LastAttemptVersion = "app-review.last-attempt-version"
        const val LastAttemptDate = "app-review.last-attempt-date"
        const val LastAttemptTrigger = "app-review.last-attempt-trigger"
        const val ManualReviewIntent = "app-review.manual-review-intent"
    }
}

internal interface ReviewPromptStorage {
    fun getInt(key: String): Int?
    fun getLong(key: String): Long?
    fun getString(key: String): String?
    fun getBoolean(key: String): Boolean?
    fun getStringSet(key: String): Set<String>?
    fun putInt(key: String, value: Int)
    fun putLong(key: String, value: Long)
    fun putString(key: String, value: String)
    fun putBoolean(key: String, value: Boolean)
    fun putStringSet(key: String, value: Set<String>)
    fun remove(key: String)
}

private class SharedPreferencesReviewPromptStorage(
    private val preferences: SharedPreferences,
) : ReviewPromptStorage {
    override fun getInt(key: String): Int? = if (preferences.contains(key)) preferences.getInt(key, 0) else null
    override fun getLong(key: String): Long? = if (preferences.contains(key)) preferences.getLong(key, 0L) else null
    override fun getString(key: String): String? = preferences.getString(key, null)
    override fun getBoolean(key: String): Boolean? =
        if (preferences.contains(key)) preferences.getBoolean(key, false) else null

    override fun getStringSet(key: String): Set<String>? = preferences.getStringSet(key, null)?.toSet()
    override fun putInt(key: String, value: Int) = preferences.edit().putInt(key, value).apply()
    override fun putLong(key: String, value: Long) = preferences.edit().putLong(key, value).apply()
    override fun putString(key: String, value: String) = preferences.edit().putString(key, value).apply()
    override fun putBoolean(key: String, value: Boolean) = preferences.edit().putBoolean(key, value).apply()
    override fun putStringSet(key: String, value: Set<String>) =
        preferences.edit().putStringSet(key, value.toSet()).apply()

    override fun remove(key: String) = preferences.edit().remove(key).apply()
}
