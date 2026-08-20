package com.wagerproof.core.services

import android.app.Activity
import android.content.Context
import android.content.Intent
import com.revenuecat.purchases.CustomerInfo
import com.revenuecat.purchases.LogLevel
import com.revenuecat.purchases.Offering
import com.revenuecat.purchases.Package
import com.revenuecat.purchases.PurchaseParams
import com.revenuecat.purchases.PurchaseResult
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration
import com.revenuecat.purchases.WebPurchaseRedemption
import com.revenuecat.purchases.awaitCustomerInfo
import com.revenuecat.purchases.awaitLogIn
import com.revenuecat.purchases.awaitLogOut
import com.revenuecat.purchases.awaitOfferings
import com.revenuecat.purchases.awaitPurchase
import com.revenuecat.purchases.awaitRestore
import com.revenuecat.purchases.awaitSyncPurchases
import com.revenuecat.purchases.interfaces.RedeemWebPurchaseListener
import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.shared.AppGroupKey
import java.util.Locale
import kotlinx.coroutines.CancellationException
import java.util.Date
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * RevenueCat SDK wrapper — port of iOS `RevenueCatService.swift`, which itself
 * mirrors RN `services/revenuecat.ts` (configure / logIn / logOut /
 * getCustomerInfo / getOfferings / restore).
 *
 * Lifecycle: launch → [bootstrap] (null user) → auth completes → [logIn] with
 * the Supabase user id → sign-out → [logOut] back to anonymous.
 */
object RevenueCatService {

    // Public client SDK key for the existing WagerProof Android RevenueCat app.
    // This is intentionally the same value used by the shipping RN client.
    const val REVENUECAT_API_KEY = "goog_cilRlGISDEjNmpNebMglZPXnPLb"

    const val ENTITLEMENT_IDENTIFIER = "WagerProof Pro"

    // Mirrors RN `PAYWALL_PLACEMENTS` — must match the RevenueCat dashboard.
    object Placement {
        const val ONBOARDING = "onboarding"
        const val GENERIC_FEATURE = "generic_feature"
        const val AGENT_FEATURE = "agent_feature"
    }

    data class LoginResult(val customerInfo: CustomerInfo, val created: Boolean)

    /** Signed-in identity forwarded to RevenueCat's attribution integrations. */
    internal data class SubscriberIdentity(
        /** Normalized Supabase uid that owns every PII field below. */
        val userId: String,
        val email: String?,
        val displayName: String?,
        val phoneNumber: String?,
        val authProvider: String?,
        val username: String?,
        val accountCreatedAt: String?,
    )

    @Volatile
    private var configured = false

    @Volatile
    private var subscriberIdentity: SubscriberIdentity? = null

    val isConfigured: Boolean get() = configured

    /**
     * Configure the SDK. Idempotent. Optional [userId] aliases the RC user
     * immediately (matches RN's `initializeRevenueCat(userId)` shape).
     */
    @Synchronized
    fun bootstrap(context: Context, userId: String? = null) {
        if (configured) return
        if (BuildFlags.isDebugBuild) {
            Purchases.logLevel = LogLevel.DEBUG
        }
        Purchases.configure(
            PurchasesConfiguration.Builder(context, REVENUECAT_API_KEY)
                .appUserID(userId)
                .build(),
        )
        configured = true
        // Best-effort device identifier collection — matches RN's fire-and-forget call.
        Purchases.sharedInstance.collectDeviceIdentifiers()
        // `setSubscriberIdentity` is allowed to race bootstrap. The user-id
        // guard inside apply makes this safe for both anonymous and identified
        // configuration paths.
        subscriberIdentity?.let(::applySubscriberIdentity)

        // Hand Meta's anonymous install ID to RevenueCat as the `$fbAnonId`
        // subscriber attribute. RevenueCat's server-side Meta integration sends
        // purchase/trial conversions to the Conversions API, and WITHOUT this ID
        // those server events cannot be joined back to the install — the only
        // attribution path that survives a device with no usable advertising id.
        applyFacebookAnonymousId()
    }

    /**
     * Push every trustworthy signed-in identity field to RevenueCat. The standard
     * fields (email / display name / phone) are forwarded to RC's attribution
     * integrations — including its server-side Meta CAPI events, which have
     * nothing to join on without them. The `wagerproof_*` attributes are for RC
     * customer inspection and targeting.
     *
     * Cached so [logIn] can re-apply after RevenueCat attaches the authenticated
     * App User ID — AuthStore and RevenueCatStore observe the same Supabase event
     * independently, so the ordering isn't deterministic.
     */
    fun setSubscriberIdentity(
        userId: String,
        email: String?,
        displayName: String?,
        phoneNumber: String?,
        authProvider: String?,
        username: String?,
        accountCreatedAt: String?,
    ) {
        val identity = SubscriberIdentity(
            userId = normalizeUserId(userId),
            email = email,
            displayName = displayName,
            phoneNumber = phoneNumber,
            authProvider = authProvider,
            username = username,
            accountCreatedAt = accountCreatedAt,
        )
        subscriberIdentity = identity
        if (configured) applySubscriberIdentity(identity)
    }

    private fun applySubscriberIdentity(identity: SubscriberIdentity) {
        val purchases = Purchases.sharedInstance
        // AuthStore and RevenueCatStore observe the same Supabase event on
        // independent coroutines. Never apply a payload merely because it is
        // cached: before/after a direct A → B transition the SDK may still be
        // attached to the other account.
        if (normalizeUserId(purchases.appUserID) != identity.userId) return
        purchases.setEmail(nonEmpty(identity.email))
        purchases.setDisplayName(nonEmpty(identity.displayName))
        purchases.setPhoneNumber(nonEmpty(identity.phoneNumber))

        val attributes = buildMap<String, String> {
            nonEmpty(identity.authProvider)?.let { put("wagerproof_auth_provider", it) }
            nonEmpty(identity.username)?.let { put("wagerproof_username", it) }
            nonEmpty(identity.accountCreatedAt)?.let { put("wagerproof_account_created_at", it) }
        }
        if (attributes.isNotEmpty()) {
            purchases.setAttributes(attributes)
        }

        // Re-apply after the authenticated App User ID is attached so the linkage
        // holds whichever of Supabase auth / RevenueCat logIn finishes first.
        applyFacebookAnonymousId()
        purchases.collectDeviceIdentifiers()
    }

    private fun applyFacebookAnonymousId() {
        val anonymousId = MetaAnalyticsService.anonymousId()
        if (!anonymousId.isNullOrBlank()) {
            Purchases.sharedInstance.setFBAnonymousID(anonymousId)
        }
    }

    private fun nonEmpty(value: String?): String? = value?.trim()?.takeIf { it.isNotEmpty() }

    internal fun matchingSubscriberIdentity(
        identity: SubscriberIdentity?,
        userId: String,
    ): SubscriberIdentity? = identity?.takeIf { it.userId == normalizeUserId(userId) }

    internal fun normalizeUserId(userId: String): String = userId.trim().lowercase(Locale.ROOT)

    /** Synchronous auth-boundary teardown; safe before RevenueCat's network logout. */
    fun clearSubscriberIdentity() {
        subscriberIdentity = null
    }

    /** Identify a known user by Supabase user id → `(customerInfo, created)`. */
    suspend fun logIn(userId: String): LoginResult {
        val result = Purchases.sharedInstance.awaitLogIn(userId)
        matchingSubscriberIdentity(subscriberIdentity, userId)?.let(::applySubscriberIdentity)
        return LoginResult(result.customerInfo, result.created)
    }

    /** Reset to an anonymous RC user on Supabase sign-out. Errors swallowed so sign-out never blocks UI (matches RN). */
    suspend fun logOut() {
        clearSubscriberIdentity()
        try {
            Purchases.sharedInstance.awaitLogOut()
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (_: Exception) {
        }
    }

    suspend fun customerInfo(): CustomerInfo =
        Purchases.sharedInstance.awaitCustomerInfo()

    /**
     * The RevenueCat customer this device is currently acting as. Needed by the
     * app-to-web checkout link — a web purchase that doesn't carry this id lands
     * on a DIFFERENT customer and its entitlement never reaches the device.
     */
    val appUserId: String
        get() = Purchases.sharedInstance.appUserID

    /**
     * Drop the cached `CustomerInfo` so the next fetch hits the server.
     *
     * Only for the app-to-web return trip: that purchase completes on
     * RevenueCat's servers with nothing pushing it to the device, and the SDK
     * caches customer info for ~5 minutes. Used sparingly — invalidating for any
     * other reason just burns a network round trip.
     */
    fun invalidateCustomerInfoCache() {
        Purchases.sharedInstance.invalidateCustomerInfoCache()
    }

    suspend fun currentOffering(): Offering? =
        Purchases.sharedInstance.awaitOfferings().current

    /** Placement offering with fallback to `offerings.current` — mirrors RN's `getCurrentOfferingForPlacement`. */
    suspend fun offering(forPlacement: String): Offering? {
        val offerings = Purchases.sharedInstance.awaitOfferings()
        return offerings.getCurrentOfferingForPlacement(forPlacement) ?: offerings.current
    }

    /**
     * Buy a package through Play Billing.
     *
     * Needed by the custom paywall, which drives checkout itself instead of
     * handing the offering to RevenueCatUI's template. Throws
     * `PurchasesTransactionException` — callers must branch on its
     * `userCancelled` flag before treating the failure as an error.
     *
     * [activity] must be the CURRENT resumed Activity: Play Billing launches its
     * sheet on it, and a stale reference silently no-ops.
     */
    suspend fun purchase(activity: Activity, pkg: Package): PurchaseResult =
        Purchases.sharedInstance.awaitPurchase(PurchaseParams.Builder(activity, pkg).build())

    suspend fun restorePurchases(): CustomerInfo =
        Purchases.sharedInstance.awaitRestore()

    suspend fun syncPurchases(): CustomerInfo =
        Purchases.sharedInstance.awaitSyncPurchases()

    /**
     * Parse a RevenueCat Web Billing deep link. A null result means the intent
     * is unrelated to RevenueCat and should continue through normal routing.
     */
    fun webPurchaseRedemption(intent: Intent): WebPurchaseRedemption? =
        Purchases.parseAsWebPurchaseRedemption(intent)

    /** Redeem a Web Billing purchase and bridge RevenueCat's callback to coroutines. */
    suspend fun redeemWebPurchase(
        redemption: WebPurchaseRedemption,
    ): RedeemWebPurchaseListener.Result = suspendCancellableCoroutine { continuation ->
        Purchases.sharedInstance.redeemWebPurchase(redemption) { result ->
            if (continuation.isActive) continuation.resume(result)
        }
    }

    // Helpers — mirror RN's entitlement checks so gating stays 1:1 across platforms.

    fun hasProEntitlement(info: CustomerInfo): Boolean =
        info.entitlements.active.containsKey(ENTITLEMENT_IDENTIFIER)

    /** Coarse subscription type from the active entitlement's productIdentifier. */
    fun activeSubscriptionType(info: CustomerInfo): String? {
        val productId = info.entitlements.active[ENTITLEMENT_IDENTIFIER]
            ?.productIdentifier?.lowercase() ?: return null
        return when {
            productId.contains("lifetime") -> "lifetime"
            productId.contains("annual") || productId.contains("yearly") -> "yearly"
            productId.contains("monthly") -> "monthly"
            else -> null
        }
    }

    fun activeProductIdentifier(info: CustomerInfo): String? =
        info.entitlements.active[ENTITLEMENT_IDENTIFIER]?.productIdentifier

    fun activeExpirationDate(info: CustomerInfo): Date? =
        info.entitlements.active[ENTITLEMENT_IDENTIFIER]?.expirationDate

    /**
     * Persist the coarse entitlement snapshot so widgets/cold-launch UI don't
     * flash "free" while RC reconciles. On iOS this write lives in
     * `RevenueCatStore.apply()` after every accepted CustomerInfo — the future
     * :core:stores RevenueCatStore must call this at that same point.
     */
    fun persistEntitlementSnapshot(info: CustomerInfo) {
        val granted = hasProEntitlement(info)
        val type = activeSubscriptionType(info)
        val editor = AppGroup.prefs.edit()
        editor.putBoolean(AppGroupKey.PRO_ENTITLEMENT_GRANTED, granted)
        if (type != null) {
            editor.putString(AppGroupKey.PRO_SUBSCRIPTION_TYPE, type)
        } else {
            editor.remove(AppGroupKey.PRO_SUBSCRIPTION_TYPE)
        }
        editor.apply()
    }
}
