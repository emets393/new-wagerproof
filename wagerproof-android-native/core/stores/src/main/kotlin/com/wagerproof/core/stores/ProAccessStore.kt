package com.wagerproof.core.stores

import androidx.compose.runtime.Stable

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
    val isPro: Boolean
        get() {
            if (revenueCat.forceFreemiumMode) return false
            if (adminMode.isAdmin) return true
            return revenueCat.entitlementStatus == RevenueCatStore.EntitlementStatus.Granted
        }

    val isAdmin: Boolean get() = adminMode.isAdmin

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
            if (!adminMode.roleResolved) return true
            if (!adminMode.isAdmin && !revenueCat.isEntitlementResolved) return true
            if (revenueCat.isLoading) return true
            return false
        }

    /** Surface the underlying stores so views can present the paywall / customer center directly. */
    val revenueCatStore get() = revenueCat
    val adminModeStore get() = adminMode
}
