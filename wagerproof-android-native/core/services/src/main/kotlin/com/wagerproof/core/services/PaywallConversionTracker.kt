package com.wagerproof.core.services

import com.revenuecat.purchases.CustomerInfo
import com.revenuecat.purchases.Offering
import com.revenuecat.purchases.Package
import com.revenuecat.purchases.PeriodType
import com.revenuecat.purchases.models.StoreProduct
import com.revenuecat.purchases.models.StoreTransaction
import java.math.BigDecimal

/**
 * One place where every paywall surface reports its funnel to Meta. Port of iOS
 * `PaywallConversionTracker.swift`.
 *
 * **Why this exists:** conversion firing used to live inline in
 * `PostOnboardingPaywall`, so the other paywall entry points (Settings,
 * Developer Settings, `ProFeatureGate`, `ProContentSection`, `LockedGameCard`,
 * `LockedOverlay` — all of which funnel through `PaywallScreen`) reported
 * nothing at all: no impression, no checkout intent, and no conversion. Every
 * upgrade outside onboarding was invisible to Meta.
 *
 * **This is the single client-side conversion sender.** RevenueCat's
 * server-side Facebook integration also reports the sale; the two reconcile on
 * `fb_order_id` + `fb_anon_id`, which is why [trackConversion] refuses to emit
 * without an order id and why the fired ids are persisted. Never fire
 * `StartTrial`/`Subscribe` from anywhere else — a second sender has no shared
 * key and double-counts every subscription. See .claude/docs/18_meta_attribution.md.
 */
object PaywallConversionTracker {

    /**
     * Order ids we've already reported. RevenueCat can deliver the same
     * purchase twice (the paywall callback plus a billing-listener catch-up),
     * and a duplicate `Subscribe` inflates Meta's reported conversions and
     * corrupts value-optimization bidding.
     */
    private const val FIRED_ORDER_IDS_KEY = "meta.firedConversionOrderIds"

    /**
     * Bound the list so it can't grow without limit in SharedPreferences. A user
     * will never have 300 distinct purchases; this is purely a safety valve.
     */
    private const val MAX_REMEMBERED_ORDER_IDS = 300

    /** Order ids can't contain a newline, so this is a safe ordered encoding. */
    private const val ORDER_ID_SEPARATOR = "\n"

    private val lock = Any()

    // MARK: - Funnel

    /**
     * `fb_mobile_content_view` — paywall impression.
     *
     * Pass [pkg] whenever the surface knows which plan is actually highlighted.
     * The offering-derived fallback picks the annual package, which is only
     * right for surfaces that let RevenueCat's template choose.
     */
    fun trackPaywallView(source: String, offering: Offering?, pkg: Package? = null) {
        val product = pkg?.product ?: headlineProduct(offering)
        MetaAnalyticsService.trackPaywallView(
            placement = source,
            productId = product?.id,
            amount = product?.let { priceAmount(it) },
            currency = product?.price?.currencyCode.orEmpty().ifBlank { "USD" },
        )
    }

    /**
     * `fb_mobile_initiated_checkout` — the purchase button was tapped. Fires
     * before Play Billing resolves so an abandoned billing sheet still counts.
     */
    fun trackCheckoutStarted(source: String, pkg: Package) {
        val product = pkg.product
        MetaAnalyticsService.trackInitiateCheckout(
            source = source,
            productId = product.id,
            amount = priceAmount(product),
            currency = product.price.currencyCode.ifBlank { "USD" },
        )
    }

    /**
     * `StartTrial` (trial) or `Subscribe` (paid) — the sale closed.
     *
     * @param transaction preferred source of the Meta `fb_order_id`. Play leaves
     *   `orderId` null for test purchases and some promo flows, so we synthesize
     *   a stable id from the product + purchase time when it's missing —
     *   otherwise the dedup key RevenueCat reconciles against is silently absent.
     * @param pkg the purchased package when the surface knows it; otherwise we
     *   match the transaction's product against [offering].
     */
    fun trackConversion(
        source: String,
        transaction: StoreTransaction?,
        customerInfo: CustomerInfo,
        pkg: Package?,
        offering: Offering?,
    ) {
        val entitlement = customerInfo.entitlements.active[RevenueCatService.ENTITLEMENT_IDENTIFIER]
        val transactionProductId = transaction?.productIds?.firstOrNull()

        // Resolve price + currency. StoreTransaction deliberately doesn't carry
        // price (RevenueCat keeps that on the catalog side), so we have to reach
        // back into the offering for the matching package.
        val resolvedProduct: StoreProduct? = when {
            pkg != null -> pkg.product
            offering == null -> null
            else -> {
                val targetId = transactionProductId ?: entitlement?.productIdentifier
                if (targetId == null) {
                    headlineProduct(offering)
                } else {
                    offering.availablePackages
                        .firstOrNull { matchesProductId(it.product.id, targetId) }
                        ?.product
                }
            }
        }

        // A missing product must NOT drop the conversion. It happens for promo
        // redemptions, when the dashboard offering changed between fetch and
        // purchase, or when the offering failed to load at all. In those cases we
        // still know the sale happened and still have the order id, so report it
        // with a zero value rather than telling Meta nothing — a conversion with
        // no revenue attached is far more useful than a silent drop.
        val productId = (
            entitlement?.productIdentifier
                ?: resolvedProduct?.id
                ?: transactionProductId
                ?: "unknown"
            ).lowercase()

        val purchaseTimeMillis = transaction?.purchaseTime ?: entitlement?.latestPurchaseDate?.time
        val orderId = resolveOrderId(
            transactionOrderId = transaction?.orderId,
            productId = productId,
            purchaseTimeMillis = purchaseTimeMillis,
        ) ?: return

        // Dedup BEFORE building the payload — a repeat delivery must be a
        // complete no-op, not a cheaper no-op.
        if (!claimOrderId(orderId)) return

        val amount = resolvedProduct?.let { priceAmount(it) } ?: BigDecimal.ZERO
        val currency = resolvedProduct?.price?.currencyCode.orEmpty().ifBlank { "USD" }
        val subscriptionType = subscriptionType(productId)
        val isTrial = entitlement?.periodType == PeriodType.TRIAL
        val packageId = pkg?.identifier
            ?: offering?.availablePackages
                ?.firstOrNull { matchesProductId(it.product.id.lowercase(), productId) }
                ?.identifier
            ?: "unknown"

        MetaAnalyticsService.trackConversionEvent(
            isTrial = isTrial,
            amount = amount,
            currency = currency,
            parameters = mapOf(
                "fb_currency" to currency,
                "fb_content_type" to "product",
                "fb_content_id" to "${subscriptionType}_subscription",
                "fb_content_name" to "WagerProof Pro",
                "fb_num_items" to 1,
                "fb_order_id" to orderId,
                // Coarse LTV multiplier so Meta's optimization model bids against
                // the lifetime value rather than the first billing period. Same
                // multipliers iOS, RN and the web pixel use.
                "fb_predicted_ltv" to predictedLtv(amount, subscriptionType).toPlainString(),
                "fb_success" to "1",
                "fb_payment_info_available" to "1",
                "fb_source" to source,
                "wp_source" to source,
                "wp_product_id" to productId,
                "wp_package_id" to packageId,
                "wp_offering_id" to (offering?.identifier ?: "unknown"),
                "wp_subscription_type" to subscriptionType,
                "wp_is_trial" to if (isTrial) "1" else "0",
                "wp_purchase_timestamp" to (
                    purchaseTimeMillis?.let { (it / 1000L).toString() } ?: "unknown"
                    ),
            ),
        )
        MetaAnalyticsService.flush()
    }

    // MARK: - Dedup

    /**
     * Returns `true` if this order id had not been reported before, and marks it
     * reported. Synchronized: the paywall callback and a billing-listener
     * catch-up can land concurrently.
     *
     * Fails OPEN (returns true) when prefs are unavailable — an un-deduped event
     * is recoverable, a silently dropped conversion is not.
     */
    private fun claimOrderId(orderId: String): Boolean = synchronized(lock) {
        val prefs = runCatching { AttributionPrefs.standard }.getOrNull()
            ?: return@synchronized true
        val existing = prefs.getString(FIRED_ORDER_IDS_KEY, null)
            ?.split(ORDER_ID_SEPARATOR)
            ?.filter { it.isNotEmpty() }
            .orEmpty()
        val updated = claimedOrderIds(existing, orderId, MAX_REMEMBERED_ORDER_IDS)
            ?: return@synchronized false
        prefs.edit()
            .putString(FIRED_ORDER_IDS_KEY, updated.joinToString(ORDER_ID_SEPARATOR))
            .apply()
        true
    }

    // MARK: - Pure helpers (unit-tested in PaywallConversionTrackerTest)

    /**
     * Append [orderId] to the fired list, trimming the oldest entries past [max].
     * Returns null when the id was already present — i.e. a duplicate delivery.
     */
    internal fun claimedOrderIds(fired: List<String>, orderId: String, max: Int): List<String>? {
        if (fired.contains(orderId)) return null
        val appended = fired + orderId
        return if (appended.size > max) appended.takeLast(max) else appended
    }

    /**
     * Meta requires a non-empty `fb_order_id` on Subscribe — it's the dedup key
     * on their side too. Prefer Play's real order id; otherwise derive one that
     * is stable across repeat deliveries of the same purchase.
     */
    internal fun resolveOrderId(
        transactionOrderId: String?,
        productId: String,
        purchaseTimeMillis: Long?,
    ): String? {
        val real = transactionOrderId?.trim()?.takeIf { it.isNotEmpty() }
        if (real != null) return real
        val seconds = purchaseTimeMillis?.let { it / 1000L } ?: return null
        return "${productId}_$seconds"
    }

    internal fun subscriptionType(productId: String): String {
        val id = productId.lowercase()
        return when {
            id.contains("lifetime") -> "lifetime"
            id.contains("annual") || id.contains("yearly") -> "yearly"
            id.contains("monthly") -> "monthly"
            else -> "unknown"
        }
    }

    internal fun predictedLtv(amount: BigDecimal, subscriptionType: String): BigDecimal =
        when (subscriptionType) {
            "monthly" -> amount.multiply(BigDecimal(4))
            "yearly" -> amount.multiply(BigDecimal("1.3"))
            else -> amount
        }

    /**
     * Play Billing StoreProduct ids are `"productId:basePlanId"`, but a
     * StoreTransaction carries the bare productId — match on either form.
     */
    internal fun matchesProductId(storeProductId: String, targetId: String): Boolean =
        storeProductId == targetId || storeProductId.substringBefore(":") == targetId

    internal fun microsToAmount(amountMicros: Long): BigDecimal =
        BigDecimal.valueOf(amountMicros, 6).stripTrailingZeros()

    private fun priceAmount(product: StoreProduct): BigDecimal =
        microsToAmount(product.price.amountMicros)

    /**
     * The package whose price best represents the offering for a ViewContent
     * value signal — RevenueCat's designated annual package, else the first one.
     */
    private fun headlineProduct(offering: Offering?): StoreProduct? {
        if (offering == null) return null
        return (offering.annual ?: offering.availablePackages.firstOrNull())?.product
    }
}
