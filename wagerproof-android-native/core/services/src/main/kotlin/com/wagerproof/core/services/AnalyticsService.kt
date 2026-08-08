package com.wagerproof.core.services

import android.annotation.SuppressLint
import android.content.Context
import com.mixpanel.android.mpmetrics.MixpanelAPI
import org.json.JSONObject

/**
 * Mixpanel wrapper — mirrors iOS `AnalyticsService.swift` / RN
 * `services/analytics.ts` so event names stay 1:1 across platforms.
 *
 * Until [bootstrap] runs every method below is a no-op, so a missing bootstrap
 * silently discards the entire product funnel. It is called from
 * `AppGraph.bootstrap()`, the Android equivalent of iOS `WagerproofApp.init`.
 */
object AnalyticsService {

    /**
     * Same project token as iOS (`AnalyticsService.swift`), the RN app
     * (`wagerproof-mobile/services/analytics.ts`) and web (`index.html`), so all
     * platforms land in one Mixpanel project. Not a secret — Mixpanel project
     * tokens are write-only and ship inside every client bundle by design.
     */
    const val MIXPANEL_TOKEN = "1346df53bbd034722047aa8a96d5321e"

    // bootstrap() always passes applicationContext; the SDK instance is
    // intentionally process-scoped and never retains an Activity.
    @SuppressLint("StaticFieldLeak")
    @Volatile
    private var mixpanel: MixpanelAPI? = null

    /** Call once at app launch. Idempotent. Automatic events stay off (parity with iOS/RN). */
    @Synchronized
    fun bootstrap(context: Context, token: String = MIXPANEL_TOKEN) {
        if (mixpanel != null) return
        if (token.isBlank()) return
        mixpanel = runCatching {
            MixpanelAPI.getInstance(
                context.applicationContext,
                token,
                /* trackAutomaticEvents = */ false,
            )
        }.getOrNull()
    }

    fun track(event: String, properties: Map<String, Any?> = emptyMap()) {
        val instance = mixpanel ?: return
        val json = JSONObject()
        for ((key, value) in properties) {
            if (value != null) json.put(key, value)
        }
        runCatching { instance.track(event, json) }
    }

    /** distinctId = the Supabase user id (lowercased, matching every other platform). */
    fun identify(userId: String) {
        runCatching { mixpanel?.identify(userId) }
    }

    /** Clear identity on sign-out so the next user doesn't inherit the previous profile. */
    fun reset() {
        runCatching { mixpanel?.reset() }
    }
}
