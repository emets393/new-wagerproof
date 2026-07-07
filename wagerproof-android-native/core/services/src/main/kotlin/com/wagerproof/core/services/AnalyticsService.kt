package com.wagerproof.core.services

import android.content.Context
import com.mixpanel.android.mpmetrics.MixpanelAPI
import org.json.JSONObject

/**
 * Mixpanel wrapper — mirrors iOS `AnalyticsService.swift` / RN
 * `services/analytics.ts` so event names stay 1:1 across platforms.
 *
 * NOT initialized by default — iOS parity: `WagerproofApp.init` has a
 * "Phase 2" TODO and doesn't call bootstrap with a real token yet. The token
 * is intended to come from BuildConfig/local.properties (RN's
 * EXPO_PUBLIC_MIXPANEL_TOKEN), never hardcoded here.
 */
object AnalyticsService {

    @Volatile
    private var mixpanel: MixpanelAPI? = null

    /** Call once at app launch. Idempotent. Automatic events stay off (parity with iOS/RN). */
    fun bootstrap(context: Context, token: String) {
        if (mixpanel != null) return
        mixpanel = MixpanelAPI.getInstance(context, token, /* trackAutomaticEvents = */ false)
    }

    fun track(event: String, properties: Map<String, Any?> = emptyMap()) {
        val instance = mixpanel ?: return
        val json = JSONObject()
        for ((key, value) in properties) {
            if (value != null) json.put(key, value)
        }
        instance.track(event, json)
    }

    /** distinctId = the Supabase user id. */
    fun identify(userId: String) {
        mixpanel?.identify(userId)
    }

    /** Clear identity on sign-out. */
    fun reset() {
        mixpanel?.reset()
    }
}
