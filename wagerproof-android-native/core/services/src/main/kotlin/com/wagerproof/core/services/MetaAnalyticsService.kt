package com.wagerproof.core.services

import android.content.Context
import android.os.Bundle
import com.facebook.FacebookSdk
import com.facebook.appevents.AppEventsConstants
import com.facebook.appevents.AppEventsLogger
import java.math.BigDecimal
import java.util.Currency
import java.util.Locale

/**
 * Meta App Events facade — port of iOS `MetaAnalyticsService.swift`
 * (install→subscribe attribution: fb_mobile_complete_registration,
 * fb_mobile_purchase for trial starts, Subscribe for paid subscriptions).
 *
 * Deep links: no `handleAppDelegate(url:)` equivalent is needed on Android —
 * `FacebookActivity` consumes Facebook callbacks automatically once the SDK
 * is installed and declared in the manifest.
 */
object MetaAnalyticsService {

    @Volatile
    private var initialized = false
    private var logger: AppEventsLogger? = null
    private var applicationContext: Context? = null

    /** Boot the Meta SDK when out-of-band production credentials are present. */
    @Synchronized
    fun initialize(context: Context, appId: String, clientToken: String) {
        if (initialized) return
        if (appId.isBlank() || clientToken.isBlank()) return
        val appContext = context.applicationContext
        val configuredLogger = runCatching {
            FacebookSdk.setApplicationId(appId.trim())
            FacebookSdk.setClientToken(clientToken.trim())
            FacebookSdk.setAutoInitEnabled(false)
            FacebookSdk.setAutoLogAppEventsEnabled(false)
            FacebookSdk.setAdvertiserIDCollectionEnabled(false)
            @Suppress("DEPRECATION")
            FacebookSdk.sdkInitialize(appContext)
            AppEventsLogger.newLogger(appContext)
        }.getOrNull() ?: return
        applicationContext = appContext
        logger = configuredLogger
        initialized = true
    }

    /**
     * FB anonymous ID — fed to RevenueCat as the `fb_anon_id` subscriber
     * attribute so server-side CAPI events join back to the install.
     * Null until facebook-core lands (callers already treat it as optional).
     */
    fun anonymousId(): String? {
        if (!initialized) return null
        val context = applicationContext ?: return null
        return runCatching { AppEventsLogger.getAnonymousAppDeviceGUID(context) }.getOrNull()
    }

    /** `fb_mobile_complete_registration` after onboarding. [method] = sign-in mechanism ("google", "email"). */
    fun trackCompleteRegistration(method: String) {
        if (!initialized) return
        runCatching {
            logger?.logEvent(
                AppEventsConstants.EVENT_NAME_COMPLETED_REGISTRATION,
                Bundle().apply {
                    putString(AppEventsConstants.EVENT_PARAM_REGISTRATION_METHOD, method)
                    putString(AppEventsConstants.EVENT_PARAM_CONTENT, "WagerProof Onboarding")
                    putString(AppEventsConstants.EVENT_PARAM_SUCCESS, "1")
                },
            )
        }
    }

    /** `fb_mobile_purchase` (logPurchase) — trial starts map to Purchase. */
    fun trackPurchase(amount: BigDecimal, currency: String, parameters: Map<String, Any?> = emptyMap()) {
        if (!initialized) return
        runCatching {
            logger?.logPurchase(amount, currencyInstance(currency), parameters.toBundle())
        }
    }

    /** `Subscribe` for the initial paid subscription; amount goes to valueToSum + `fb_currency` param. */
    fun trackSubscribe(amount: BigDecimal, currency: String, parameters: Map<String, Any?> = emptyMap()) {
        if (!initialized) return
        runCatching {
            val normalizedCurrency = currencyInstance(currency).currencyCode
            logger?.logEvent(
                AppEventsConstants.EVENT_NAME_SUBSCRIBE,
                amount.toDouble(),
                (parameters + (AppEventsConstants.EVENT_PARAM_CURRENCY to normalizedCurrency)).toBundle(),
            )
        }
    }

    /** Force-flush queued events after a paywall conversion. */
    fun flush() {
        if (!initialized) return
        runCatching { logger?.flush() }
    }

    private fun currencyInstance(raw: String): Currency = runCatching {
        Currency.getInstance(raw.trim().uppercase(Locale.ROOT))
    }.getOrElse { Currency.getInstance("USD") }

    private fun Map<String, Any?>.toBundle(): Bundle = Bundle().also { bundle ->
        forEach { (key, value) ->
            when (value) {
                null -> Unit
                is String -> bundle.putString(key, value)
                is Boolean -> bundle.putBoolean(key, value)
                is Int -> bundle.putInt(key, value)
                is Long -> bundle.putLong(key, value)
                is Float -> bundle.putFloat(key, value)
                is Double -> bundle.putDouble(key, value)
                is BigDecimal -> bundle.putDouble(key, value.toDouble())
                else -> bundle.putString(key, value.toString())
            }
        }
    }
}
