package com.wagerproof.core.services

import android.content.Context
import com.revenuecat.purchases.CustomerInfo
import com.revenuecat.purchases.LogLevel
import com.revenuecat.purchases.Offering
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration
import com.revenuecat.purchases.awaitCustomerInfo
import com.revenuecat.purchases.awaitLogIn
import com.revenuecat.purchases.awaitLogOut
import com.revenuecat.purchases.awaitOfferings
import com.revenuecat.purchases.awaitRestore
import com.revenuecat.purchases.awaitSyncPurchases
import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.shared.AppGroupKey
import java.util.Date

/**
 * RevenueCat SDK wrapper — port of iOS `RevenueCatService.swift`, which itself
 * mirrors RN `services/revenuecat.ts` (configure / logIn / logOut /
 * getCustomerInfo / getOfferings / restore).
 *
 * Lifecycle: launch → [bootstrap] (null user) → auth completes → [logIn] with
 * the Supabase user id → sign-out → [logOut] back to anonymous.
 */
object RevenueCatService {

    // TODO: replace before shipping. iOS uses appl_TFQYZRtHkCBrnaILkniTjsulyHK;
    // Android needs its own goog_ key from the same RevenueCat project dashboard.
    const val REVENUECAT_API_KEY = "goog_TODO_REPLACE_FROM_DASHBOARD"

    const val ENTITLEMENT_IDENTIFIER = "WagerProof Pro"

    // Mirrors RN `PAYWALL_PLACEMENTS` — must match the RevenueCat dashboard.
    object Placement {
        const val ONBOARDING = "onboarding"
        const val GENERIC_FEATURE = "generic_feature"
        const val AGENT_FEATURE = "agent_feature"
    }

    data class LoginResult(val customerInfo: CustomerInfo, val created: Boolean)

    @Volatile
    private var configured = false

    val isConfigured: Boolean get() = configured

    /**
     * Configure the SDK. Idempotent. Optional [userId] aliases the RC user
     * immediately (matches RN's `initializeRevenueCat(userId)` shape).
     */
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
    }

    /** Identify a known user by Supabase user id → `(customerInfo, created)`. */
    suspend fun logIn(userId: String): LoginResult {
        val result = Purchases.sharedInstance.awaitLogIn(userId)
        return LoginResult(result.customerInfo, result.created)
    }

    /** Reset to an anonymous RC user on Supabase sign-out. Errors swallowed so sign-out never blocks UI (matches RN). */
    suspend fun logOut() {
        try {
            Purchases.sharedInstance.awaitLogOut()
        } catch (_: Exception) {
        }
    }

    suspend fun customerInfo(): CustomerInfo =
        Purchases.sharedInstance.awaitCustomerInfo()

    suspend fun currentOffering(): Offering? =
        Purchases.sharedInstance.awaitOfferings().current

    /** Placement offering with fallback to `offerings.current` — mirrors RN's `getCurrentOfferingForPlacement`. */
    suspend fun offering(forPlacement: String): Offering? {
        val offerings = Purchases.sharedInstance.awaitOfferings()
        return offerings.getCurrentOfferingForPlacement(forPlacement) ?: offerings.current
    }

    suspend fun restorePurchases(): CustomerInfo =
        Purchases.sharedInstance.awaitRestore()

    suspend fun syncPurchases(): CustomerInfo =
        Purchases.sharedInstance.awaitSyncPurchases()

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
