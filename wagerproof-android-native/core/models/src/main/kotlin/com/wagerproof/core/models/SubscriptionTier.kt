package com.wagerproof.core.models

/** Marketing names never change permanent billing identifiers. Access is cumulative. */
enum class SubscriptionTier(val title: String, val entitlementId: String) {
    STANDARD("Premium", "WagerProof Standard"),
    PREMIUM("Premium Plus", "WagerProof Premium"),
    PRO("Pro", "WagerProof Pro");
    val slug get() = name.lowercase()
    fun includes(minimum: SubscriptionTier) = ordinal >= minimum.ordinal
    companion object {
        fun resolve(activeIds: Set<String>) = entries.lastOrNull { it.entitlementId in activeIds }
        fun isTieredCustomer(productIds: Set<String>, entitlementIds: Set<String>) =
            STANDARD.entitlementId in entitlementIds || PREMIUM.entitlementId in entitlementIds ||
                productIds.any { it.startsWith("com.wagerproof.mobile.tiers.") || it.startsWith("wp_tiers_") }
    }
}

enum class EntitlementPreview(val title: String, val tier: SubscriptionTier?, val isTiered: Boolean) {
    ACTUAL("Use actual subscription", null, false),
    LEGACY_FREE("Legacy free", null, false),
    NEW_FREE("New plan · Expired / no access", null, true),
    STANDARD("Premium", SubscriptionTier.STANDARD, true),
    PREMIUM("Premium Plus", SubscriptionTier.PREMIUM, true),
    PRO("Pro", SubscriptionTier.PRO, true),
    LEGACY_PRO("Legacy Pro", SubscriptionTier.PRO, false),
}

data class SubscriptionAccessState(val tier: SubscriptionTier?, val isTiered: Boolean, val isAdmin: Boolean = false) {
    fun hasAccess(minimum: SubscriptionTier) = isAdmin || tier?.includes(minimum) == true
    fun isRestricted(minimum: SubscriptionTier) = isTiered && !hasAccess(minimum)
    companion object {
        fun resolve(tier: SubscriptionTier?, tiered: Boolean, admin: Boolean, forceFree: Boolean,
                    preview: EntitlementPreview, previewAvailable: Boolean): SubscriptionAccessState =
            if (previewAvailable && preview != EntitlementPreview.ACTUAL)
                SubscriptionAccessState(preview.tier, preview.isTiered)
            else SubscriptionAccessState(if (forceFree) null else tier, tiered, admin && !forceFree)
    }
}
