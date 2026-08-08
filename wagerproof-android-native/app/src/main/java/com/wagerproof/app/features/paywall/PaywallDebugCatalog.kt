package com.wagerproof.app.features.paywall

/**
 * Sample plan catalog so the custom paywall can be **looked at** on a debug
 * build.
 *
 * Google Play resolves subscription products by package name **and** signing
 * certificate, so a locally built, debug-signed APK gets an empty
 * `subscriptionOptions` back no matter what — even with
 * `-PuseProductionApplicationId=true`. The paywall then correctly falls through
 * to [UnavailablePlans], which is exactly the wrong screen when the thing you
 * are trying to review is the plan cards, the savings ribbon and the CTA copy.
 *
 * These products run through the SAME [PaywallPlanResolver] the store catalog
 * does — they are injected at the `PaywallProduct` boundary, not painted as a
 * fake plan row — so the Yearly/entry selection, the savings percentage and the
 * per-month math you see are the real rules, just fed sample prices.
 *
 * Guarded by `BuildConfig.DEBUG` at the single call site in `CustomPaywallView`.
 * `BuildConfig.DEBUG` is a compile-time constant, so R8 removes this branch —
 * and every string below — from release builds.
 *
 * **Nothing here is purchasable.** `CustomPaywallView.buy()` looks the selected
 * plan up in `packagesById`, which is built from the real offering; a fixture id
 * misses and the tap is a no-op. That is deliberate: a debug preview must never
 * open a billing sheet.
 */
internal object PaywallDebugCatalog {

    /** Shown above the plan cards so sample pricing can't be mistaken for live catalog data. */
    const val NOTICE = "DEBUG CATALOG · sample pricing, not purchasable"

    private const val MICROS = 1_000_000L

    /**
     * Yearly + monthly, no intro offers — the shape the onboarding offering ships
     * in production. Prices are illustrative; savings renders as ~44%
     * ((14.99×12 − 99.99) / 14.99×12), which is the range the real offering sits
     * in, so the ribbon is laid out at a realistic width.
     */
    fun products(): List<PaywallProduct> = listOf(
        PaywallProduct(
            // The resolver prefers `$rc_yearly_discount` for the headline card,
            // so use it here or the fixture would exercise the fallback branch.
            packageId = "\$rc_yearly_discount",
            productId = "debug_pro_yearly",
            kind = PaywallPackageKind.ANNUAL,
            formattedPrice = "$99.99",
            priceMicros = 99_99L * MICROS / 100,
            currencyCode = "USD",
            period = PaywallPeriod(value = 1, unit = PaywallPeriodUnit.YEAR),
            introOffer = null,
        ),
        PaywallProduct(
            packageId = "\$rc_monthly",
            productId = "debug_pro_monthly",
            kind = PaywallPackageKind.MONTHLY,
            formattedPrice = "$14.99",
            priceMicros = 14_99L * MICROS / 100,
            currencyCode = "USD",
            period = PaywallPeriod(value = 1, unit = PaywallPeriodUnit.MONTH),
            introOffer = null,
        ),
    )
}
