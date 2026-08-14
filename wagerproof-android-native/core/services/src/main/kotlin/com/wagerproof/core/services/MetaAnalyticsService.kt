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
 * Meta App Events fan-out for the install → subscribe funnel. Port of iOS
 * `MetaAnalyticsService.swift`.
 *
 * Events we emit, and why each one exists:
 *   - `fb_mobile_activate_app`          — auto-logged by the SDK; Meta's primary
 *                                         install-attribution signal
 *   - `fb_mobile_complete_registration` — onboarding finish
 *   - `fb_mobile_content_view`          — paywall impression (value optimization
 *                                         sees a dollar signal before the sale)
 *   - `fb_mobile_initiated_checkout`    — purchase button tapped, fires BEFORE
 *                                         Play Billing resolves so abandonment counts
 *   - `StartTrial` / `Subscribe`        — the closed sale, routed by
 *                                         [trackConversionEvent]
 *
 * Plus Advanced Matching ([setAdvancedMatching]) and external ID ([setUserId]),
 * which are the main levers keeping match rates alive when the device has no
 * usable advertising id to join on.
 *
 * Conversion events must only ever be fired through
 * [PaywallConversionTracker] — it dedupes by `fb_order_id`, which is also the
 * key RevenueCat's server-side Facebook integration dedupes against. See
 * .claude/docs/18_meta_attribution.md.
 *
 * Deep links: no `handleAppDelegate(url:)` equivalent is needed on Android —
 * `FacebookActivity` consumes Facebook callbacks automatically once the SDK
 * is installed and declared in the manifest.
 */
object MetaAnalyticsService {

    /**
     * Guards `fb_mobile_complete_registration` to once per install. Onboarding
     * completion can be re-entered (Developer Settings → Reset Onboarding, a
     * re-signup on the same device), and a duplicate registration event inflates
     * the denominator behind Meta's cost-per-registration reporting.
     */
    private const val REGISTRATION_FIRED_KEY = "meta.completeRegistrationFired"

    /** iOS uses the raw key `fb_content_name`; the Android SDK ships no constant for it. */
    private const val PARAM_CONTENT_NAME = "fb_content_name"

    @Volatile
    private var initialized = false
    private var logger: AppEventsLogger? = null
    private var applicationContext: Context? = null

    /**
     * Boot the Meta SDK. Callers pass `BuildConfig.FACEBOOK_APP_ID` /
     * `FACEBOOK_CLIENT_TOKEN`, which app/build.gradle.kts now defaults to the real
     * shared-Meta-app values — the blank guard below is a backstop for a deliberate
     * blank override, not the normal path. It used to be the normal path: nothing
     * supplied the credentials, so this returned here on every launch and every method
     * below no-oped on `initialized`, sending Meta nothing at all.
     */
    @Synchronized
    fun initialize(context: Context, appId: String, clientToken: String) {
        if (initialized) return
        if (appId.isBlank() || clientToken.isBlank()) return
        val appContext = context.applicationContext
        val configuredLogger = runCatching {
            FacebookSdk.setApplicationId(appId.trim())
            FacebookSdk.setClientToken(clientToken.trim())
            // Init stays manual so the SDK can't start before we've confirmed
            // credentials exist (a credential-free local build must stay inert).
            FacebookSdk.setAutoInitEnabled(false)

            @Suppress("DEPRECATION")
            FacebookSdk.sdkInitialize(appContext)
            AppEventsLogger.newLogger(appContext)
        }.getOrNull() ?: return
        applicationContext = appContext
        logger = configuredLogger
        initialized = true

        // Auto-logging and advertiser-ID collection are ON. On Android the
        // advertising id is the primary (non-ATT-gated) join key, so with these
        // off nothing is attributable to a Meta ad and no app event is eligible
        // for AEO optimization.
        //
        // NOT redundant with the manifest values: FBSDK's UserSettingsManager
        // reads its SharedPreferences cache BEFORE the manifest, and shipped
        // builds persisted `false` there — an upgrading install would stay dark
        // forever on a manifest-only change. Setting them explicitly overwrites
        // that cached false, and the auto-logging setter also starts the
        // ActivityLifecycleTracker that emits `fb_mobile_activate_app`
        // (idempotent, so a fresh install where sdkInitialize already started it
        // is fine).
        //
        // AFTER sdkInitialize, and each guarded on its own: the setter
        // dereferences FacebookSdk.applicationContext when passed `true`, so it
        // throws pre-init — and folding it into the block above would mean one
        // throw silently disables the entire integration. (Passing `false`
        // short-circuits that path, which is how the old ordering got away with
        // running before init.)
        runCatching { FacebookSdk.setAutoLogAppEventsEnabled(true) }
        runCatching { FacebookSdk.setAdvertiserIDCollectionEnabled(true) }
        // Empty = no Limited Data Use restriction; same post-init requirement.
        runCatching { FacebookSdk.setDataProcessingOptions(emptyArray()) }
    }

    /**
     * FB anonymous ID — fed to RevenueCat as the `fb_anon_id` subscriber
     * attribute so server-side CAPI events join back to the install.
     * Null until the SDK is initialized (callers already treat it as optional).
     */
    fun anonymousId(): String? {
        if (!initialized) return null
        val context = applicationContext ?: return null
        return runCatching { AppEventsLogger.getAnonymousAppDeviceGUID(context) }.getOrNull()
    }

    // MARK: - Identity

    /**
     * Stamp our Supabase user id onto every Meta app event as the FB external
     * ID. Combined with [setAdvancedMatching] this is how Meta still matches a
     * conversion when the device graph alone can't.
     */
    fun setUserId(userId: String) {
        if (!initialized) return
        runCatching { AppEventsLogger.setUserID(userId) }
    }

    /**
     * Facebook **Advanced Matching** — attach the user's PII to the Meta SDK so
     * it rides on every event it sends. The SDK SHA-256-hashes each field
     * on-device before upload; raw PII never leaves the phone.
     *
     * **Replaces, does not merge.** The FB SDK rebuilds its whole hashed
     * user-data set from exactly the fields passed here — anything left null is
     * dropped, not preserved. Call it with the complete profile from a single
     * source of truth (`AuthStore.identifyForAnalytics`), never with a partial
     * set from a second call site.
     */
    fun setAdvancedMatching(
        email: String?,
        displayName: String?,
        firstName: String? = null,
        lastName: String? = null,
        phoneNumber: String? = null,
    ) {
        if (!initialized) return
        val (splitFirst, splitLast) = splitDisplayName(displayName)
        runCatching {
            // Positional, not named: FBSDK declares two plain overloads of
            // setUserData (10- and 11-arg) with no Kotlin default values, so the
            // full 10-field form is the only unambiguous call.
            AppEventsLogger.setUserData(
                nonEmpty(email),
                nonEmpty(firstName) ?: splitFirst,
                nonEmpty(lastName) ?: splitLast,
                nonEmpty(phoneNumber),
                /* dateOfBirth = */ null,
                /* gender = */ null,
                /* city = */ null,
                /* state = */ null,
                /* zip = */ null,
                /* country = */ null,
            )
        }
    }

    /**
     * Drop the previous user's hashed PII + external ID on sign-out so events
     * from the next (anonymous or different) user aren't matched to the account
     * that just left.
     */
    fun clearUser() {
        if (!initialized) return
        runCatching {
            AppEventsLogger.clearUserData()
            AppEventsLogger.clearUserID()
        }
        // Release the registration guard as well. It's a per-install flag, so
        // without this a second person signing up on the same device (shared
        // phone, QA handset, a returning user creating a new account) would
        // never report a registration to Meta.
        runCatching { AttributionPrefs.standard.edit().remove(REGISTRATION_FIRED_KEY).apply() }
    }

    // MARK: - Event tracking

    /**
     * `fb_mobile_complete_registration` after onboarding. [method] is the
     * sign-in mechanism ("google", "email"). No-ops if it already fired on this
     * install — see [REGISTRATION_FIRED_KEY].
     */
    fun trackCompleteRegistration(method: String) {
        if (!initialized) return
        val prefs = runCatching { AttributionPrefs.standard }.getOrNull() ?: return
        if (prefs.getBoolean(REGISTRATION_FIRED_KEY, false)) return
        prefs.edit().putBoolean(REGISTRATION_FIRED_KEY, true).apply()

        runCatching {
            logger?.logEvent(
                AppEventsConstants.EVENT_NAME_COMPLETED_REGISTRATION,
                Bundle().apply {
                    putString(AppEventsConstants.EVENT_PARAM_REGISTRATION_METHOD, method)
                    putString(PARAM_CONTENT_NAME, "WagerProof Onboarding")
                    putString(AppEventsConstants.EVENT_PARAM_SUCCESS, "1")
                },
            )
            // Flush so registration lands even if the user immediately backgrounds —
            // the SDK's default batch interval is a full minute.
            logger?.flush()
        }
    }

    /**
     * `fb_mobile_content_view` on paywall impression. [amount] is the
     * highlighted package's price so Meta's value optimization gets a dollar
     * signal ahead of any purchase.
     *
     * Deliberately does NOT flush: paywall views vastly outnumber conversions,
     * and the flush on the checkout/conversion events that follow carries these
     * along anyway.
     */
    fun trackPaywallView(
        placement: String,
        productId: String?,
        amount: BigDecimal?,
        currency: String,
    ) {
        if (!initialized) return
        runCatching {
            val normalizedCurrency = currencyInstance(currency).currencyCode
            logger?.logEvent(
                AppEventsConstants.EVENT_NAME_VIEWED_CONTENT,
                (amount ?: BigDecimal.ZERO).toDouble(),
                Bundle().apply {
                    putString(AppEventsConstants.EVENT_PARAM_CONTENT_TYPE, "paywall")
                    putString(AppEventsConstants.EVENT_PARAM_CONTENT_ID, placement)
                    putString(PARAM_CONTENT_NAME, "WagerProof Pro")
                    putString(AppEventsConstants.EVENT_PARAM_CURRENCY, normalizedCurrency)
                    putString("wp_source", placement)
                    putString("wp_product_id", productId ?: "unknown")
                },
            )
        }
    }

    /**
     * `fb_mobile_initiated_checkout` when the purchase button is tapped. Runs
     * before Play Billing resolves, so Meta sees checkout intent even when the
     * billing sheet is abandoned — which is the entire point of the event,
     * hence the immediate flush (an abandoning user may force-quit).
     */
    fun trackInitiateCheckout(
        source: String,
        productId: String,
        amount: BigDecimal,
        currency: String,
    ) {
        if (!initialized) return
        runCatching {
            val normalizedCurrency = currencyInstance(currency).currencyCode
            logger?.logEvent(
                AppEventsConstants.EVENT_NAME_INITIATED_CHECKOUT,
                amount.toDouble(),
                Bundle().apply {
                    putString(AppEventsConstants.EVENT_PARAM_CONTENT_TYPE, "subscription")
                    putString(AppEventsConstants.EVENT_PARAM_CONTENT_ID, productId)
                    putString(PARAM_CONTENT_NAME, "WagerProof Pro")
                    putString(AppEventsConstants.EVENT_PARAM_CURRENCY, normalizedCurrency)
                    putInt(AppEventsConstants.EVENT_PARAM_NUM_ITEMS, 1)
                    putString("wp_source", source)
                    putString("wp_product_id", productId)
                },
            )
            logger?.flush()
        }
    }

    /**
     * `StartTrial` when a free trial begins.
     *
     * Previously sent `fb_mobile_purchase` (logPurchase), which split trial
     * starts across two different Meta standard events depending on platform —
     * web and the server-side Conversions API already sent `StartTrial`.
     * Normalized so iOS, Android, web, and CAPI all report the same event.
     */
    fun trackStartTrial(amount: BigDecimal, currency: String, parameters: Map<String, Any?> = emptyMap()) {
        if (!initialized) return
        runCatching {
            val normalizedCurrency = currencyInstance(currency).currencyCode
            logger?.logEvent(
                AppEventsConstants.EVENT_NAME_START_TRIAL,
                amount.toDouble(),
                (parameters + (AppEventsConstants.EVENT_PARAM_CURRENCY to normalizedCurrency)).toBundle(),
            )
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

    /**
     * Route a closed sale to the right Meta event. Kept here (rather than at
     * each call site) so the trial-vs-paid mapping has exactly one definition —
     * getting it wrong silently splits a campaign's conversions across two
     * events.
     *
     * Trials → `StartTrial`, paid first subs → `Subscribe`. This mapping is
     * shared by iOS, Android, the web pixel, and the server-side Conversions
     * API; see .claude/docs/18_meta_attribution.md.
     *
     * Call this ONLY from [PaywallConversionTracker]: it is the single client
     * conversion sender, and it dedupes on `fb_order_id` so RevenueCat's
     * server-side Facebook integration can reconcile rather than double-count.
     */
    fun trackConversionEvent(
        isTrial: Boolean,
        amount: BigDecimal,
        currency: String,
        parameters: Map<String, Any?>,
    ) {
        if (isTrial) {
            trackStartTrial(amount, currency, parameters)
        } else {
            trackSubscribe(amount, currency, parameters)
        }
    }

    /** Force-flush queued events after a paywall conversion. */
    fun flush() {
        if (!initialized) return
        runCatching { logger?.flush() }
    }

    // MARK: - Helpers

    /**
     * Split a display name into `(first, last)` — Meta hashes the two fields
     * separately. Returns `(null, null)` for a blank name so we never hash empties.
     */
    internal fun splitDisplayName(displayName: String?): Pair<String?, String?> {
        val parts = displayName?.trim()?.split(Regex("\\s+")).orEmpty().filter { it.isNotEmpty() }
        val first = parts.firstOrNull() ?: return null to null
        val last = if (parts.size > 1) parts.drop(1).joinToString(" ") else null
        return first to last
    }

    internal fun nonEmpty(value: String?): String? = value?.trim()?.takeIf { it.isNotEmpty() }

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
