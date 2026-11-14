package com.wagerproof.core.stores

import androidx.compose.runtime.*
import com.wagerproof.core.models.*
import com.wagerproof.core.services.BuildFlags

/**
 * Port of iOS `ProAccessStore.swift` (doc §4.2).
 *
 * Thin reactive facade combining [RevenueCatStore] + [AdminModeStore] into one
 * "can the user see Pro features?" answer. No stored state — every getter reads
 * the underlying stores' snapshot state, so Compose recomposes transitively.
 *
 * Access priority (identical to the RN hook):
 *   1. `forceFreemiumMode` on → not-pro regardless of underlying state.
 *   2. admin → Pro (admins always have full access).
 *   3. otherwise defer to RevenueCat's entitlement status.
 */
@Stable
class ProAccessStore(
    private val revenueCat: RevenueCatStore,
    private val adminMode: AdminModeStore,
) {
    private var previewIdentity = revenueCat.identityRevision
    private var selectedPreview by mutableStateOf(EntitlementPreview.ACTUAL)
    var previewMode: EntitlementPreview
        get() = if (BuildFlags.isDebugBuild && previewIdentity == revenueCat.identityRevision) selectedPreview else EntitlementPreview.ACTUAL
        set(value) { if (BuildFlags.isDebugBuild) { previewIdentity = revenueCat.identityRevision; revenueCat.forceFreemiumMode = false; selectedPreview = value } }
    val isPreviewing get() = previewMode != EntitlementPreview.ACTUAL
    private val access get() = SubscriptionAccessState.resolve(revenueCat.subscriptionTier,
        revenueCat.isTieredCustomer, adminMode.isAdmin, revenueCat.forceFreemiumMode, previewMode, BuildFlags.isDebugBuild)
    val subscriptionTier get() = if (access.isAdmin) SubscriptionTier.PRO else access.tier
    val isTieredCustomer get() = access.isTiered
    val isPro get() = hasAccess(SubscriptionTier.PRO)
    val hasSubscription get() = hasAccess(SubscriptionTier.STANDARD)
    val isAdmin get() = access.isAdmin
    val planTitle get() = if (isPreviewing) previewMode.title else
        if (subscriptionTier == SubscriptionTier.PRO && !isTieredCustomer) "Pro · Existing plan"
        else subscriptionTier?.title ?: "Free"
    fun hasAccess(minimum: SubscriptionTier) = access.hasAccess(minimum)
    fun isTierRestricted(minimum: SubscriptionTier) = access.isRestricted(minimum)

    val subscriptionType: String?
        get() {
            // Admins with no real subscription show as `nil` so the Settings hero
            // card doesn't print "active membership" for a role-flagged user.
            if (adminMode.isAdmin && revenueCat.entitlementStatus != RevenueCatStore.EntitlementStatus.Granted) {
                return null
            }
            return revenueCat.subscriptionType
        }

    /** `true` while still resolving status. Disables Pro-gated CTAs during the resolution window. */
    val isLoading: Boolean
        get() {
            if (isPreviewing) return false
            if (!adminMode.roleResolved) return true
            if (!adminMode.isAdmin && !revenueCat.isEntitlementResolved) return true
            if (revenueCat.isLoading) return true
            return false
        }

    /** Surface the underlying stores so views can present the paywall / customer center directly. */
    val revenueCatStore get() = revenueCat
    val adminModeStore get() = adminMode
}
