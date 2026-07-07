package com.wagerproof.core.services

import android.content.Context
import java.math.BigDecimal

/**
 * Meta App Events facade — port of iOS `MetaAnalyticsService.swift`
 * (install→subscribe attribution: fb_mobile_complete_registration,
 * fb_mobile_purchase for trial starts, Subscribe for paid subscriptions).
 *
 * INERT for now: facebook-core is not on this module's classpath. The API
 * surface and parameter semantics match the Swift file exactly so wiring the
 * SDK later is mechanical.
 *
 * Deep links: no `handleAppDelegate(url:)` equivalent is needed on Android —
 * `FacebookActivity` consumes Facebook callbacks automatically once the SDK
 * is installed and declared in the manifest.
 */
// TODO: add com.facebook.android:facebook-core and wire AppEventsLogger
// (logPurchase, EVENT_NAME_COMPLETED_REGISTRATION, EVENT_NAME_SUBSCRIBE,
// getAnonymousAppDeviceGUID); auto-events must stay disabled via manifest
// com.facebook.sdk.AutoLogAppEventsEnabled=false so we only emit explicit
// events — RevenueCat handles server-side Meta CAPI and double-counts otherwise.
@Suppress("UNUSED_PARAMETER", "unused")
object MetaAnalyticsService {

    @Volatile
    private var initialized = false

    /** Boot the Meta SDK. Idempotent. Currently only flips the guard. */
    fun initialize(context: Context) {
        if (initialized) return
        initialized = true
    }

    /**
     * FB anonymous ID — fed to RevenueCat as the `fb_anon_id` subscriber
     * attribute so server-side CAPI events join back to the install.
     * Null until facebook-core lands (callers already treat it as optional).
     */
    fun anonymousId(): String? {
        if (!initialized) return null
        return null
    }

    /** `fb_mobile_complete_registration` after onboarding. [method] = sign-in mechanism ("google", "email"). */
    fun trackCompleteRegistration(method: String) {
        if (!initialized) return
    }

    /** `fb_mobile_purchase` (logPurchase) — trial starts map to Purchase. */
    fun trackPurchase(amount: BigDecimal, currency: String, parameters: Map<String, Any?> = emptyMap()) {
        if (!initialized) return
    }

    /** `Subscribe` for the initial paid subscription; amount goes to valueToSum + `fb_currency` param. */
    fun trackSubscribe(amount: BigDecimal, currency: String, parameters: Map<String, Any?> = emptyMap()) {
        if (!initialized) return
    }

    /** Force-flush queued events after a paywall conversion. */
    fun flush() {
        if (!initialized) return
    }
}
