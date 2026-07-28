import Foundation
import RevenueCat

/// One place where every paywall surface reports its funnel to Meta.
///
/// **Why this exists:** conversion firing used to live inline in
/// `PostOnboardingPaywall`, so the seven other paywall entry points (Settings,
/// Discord, WagerBot Voice, `ProFeatureGate`, `LockedGameCard`, `LockedOverlay`,
/// `ProContentSection`) reported nothing at all — every upgrade outside
/// onboarding was invisible to Meta. Centralizing means a new paywall surface
/// gets attribution by calling three methods rather than by remembering to copy
/// forty lines of parameter-building.
///
/// Mirrors `honeydew-swift`'s `PaywallStore` fan-out, including its dedup-by-order-id
/// behaviour.
public final class PaywallConversionTracker: @unchecked Sendable {
    public static let shared = PaywallConversionTracker()

    /// Order ids we've already reported. RevenueCat can deliver the same
    /// purchase twice (the paywall callback plus a StoreKit-observer catch-up),
    /// and a duplicate `Subscribe` inflates Meta's reported conversions and
    /// corrupts value-optimization bidding.
    private static let firedOrderIdsKey = "meta.firedConversionOrderIds"
    /// Bound the list so it can't grow without limit in UserDefaults. A user
    /// will never have 300 distinct purchases; this is purely a safety valve.
    private static let maxRememberedOrderIds = 300

    private let lock = NSLock()

    private init() {}

    // MARK: - Funnel

    /// `fb_mobile_content_view` — paywall impression.
    ///
    /// Pass `package` whenever the surface knows which plan is actually
    /// highlighted. The offering-derived fallback picks `$rc_annual`, but the
    /// custom paywall deliberately *avoids* that package in some offerings
    /// (it prefers `$rc_yearly_discount` and skips `yearly_intro`), so relying
    /// on the fallback there would send Meta a price the user never saw.
    public func trackPaywallView(source: String, offering: Offering?, package: Package? = nil) {
        let product = package?.storeProduct ?? Self.headlineProduct(in: offering)
        MetaAnalyticsService.shared.trackPaywallView(
            placement: source,
            productId: product?.productIdentifier,
            amount: product?.price,
            currency: product?.currencyCode ?? "USD"
        )
    }

    /// `fb_mobile_initiated_checkout` — the purchase button was tapped. Fires
    /// before StoreKit resolves so an abandoned payment sheet still counts.
    public func trackCheckoutStarted(source: String, package: Package) {
        let product = package.storeProduct
        MetaAnalyticsService.shared.trackInitiateCheckout(
            source: source,
            productId: product.productIdentifier,
            amount: product.price,
            currency: product.currencyCode ?? "USD"
        )
    }

    /// `fb_mobile_purchase` (trial) or `Subscribe` (paid) — the sale closed.
    ///
    /// - Parameters:
    ///   - transaction: preferred source of the Meta `fb_order_id`. When the
    ///     surface can't supply one (RevenueCatUI's `onPurchaseCompleted` only
    ///     hands back `CustomerInfo`), we synthesize a stable id from the
    ///     entitlement's product + purchase date so dedup still works.
    ///   - package: the purchased package, when the surface knows it. Falls back
    ///     to matching the transaction's product against `offering`.
    public func trackConversion(
        source: String,
        transaction: StoreTransaction?,
        customerInfo: CustomerInfo,
        package: Package?,
        offering: Offering?
    ) {
        let entitlement = customerInfo.entitlements.active[RevenueCatService.entitlementIdentifier]

        // Resolve price + currency. StoreTransaction deliberately doesn't carry
        // price (RevenueCat keeps that on the catalog side), so we have to reach
        // back into the offering for the matching package.
        let resolvedProduct: StoreProduct? = {
            if let package { return package.storeProduct }
            guard let offering else { return nil }
            let targetId = transaction?.productIdentifier ?? entitlement?.productIdentifier
            guard let targetId else { return Self.headlineProduct(in: offering) }
            return offering.availablePackages
                .first(where: { $0.storeProduct.productIdentifier == targetId })?
                .storeProduct
        }()

        // A missing product must NOT drop the conversion. It happens for offer-code
        // redemptions, when the dashboard offering changed between fetch and
        // purchase, or when the offering failed to load at all. In those cases we
        // still know the sale happened and still have the order id, so report it
        // with a zero value rather than telling Meta nothing — a conversion with
        // no revenue attached is far more useful than a silent drop.
        let productId = (
            entitlement?.productIdentifier
                ?? resolvedProduct?.productIdentifier
                ?? transaction?.productIdentifier
                ?? "unknown"
        ).lowercased()
        guard let orderId = Self.orderId(transaction: transaction, entitlement: entitlement, productId: productId) else {
            return
        }
        // Dedup BEFORE building the payload — a repeat delivery must be a
        // complete no-op, not a cheaper no-op.
        guard claimOrderId(orderId) else { return }

        let amount = resolvedProduct?.price ?? 0
        let currency = resolvedProduct?.currencyCode ?? "USD"
        let subscriptionType = Self.subscriptionType(for: productId)
        let isTrial = entitlement?.periodType == .trial
        let packageId = package?.identifier
            ?? offering?.availablePackages.first(where: {
                $0.storeProduct.productIdentifier.lowercased() == productId
            })?.identifier
            ?? "unknown"
        let purchaseDate = transaction?.purchaseDate ?? entitlement?.latestPurchaseDate

        MetaAnalyticsService.shared.trackConversionEvent(
            isTrial: isTrial,
            amount: amount,
            currency: currency,
            parameters: [
                "fb_currency": currency,
                "fb_content_type": "product",
                "fb_content_id": "\(subscriptionType)_subscription",
                "fb_content_name": "WagerProof Pro",
                "fb_num_items": transaction?.quantity ?? 1,
                "fb_order_id": orderId,
                // Coarse LTV multiplier so Meta's optimization model bids against
                // the lifetime value rather than the first billing period. Same
                // multipliers the RN app used.
                "fb_predicted_ltv": NSDecimalNumber(
                    decimal: Self.predictedLTV(amount: amount, subscriptionType: subscriptionType)
                ).stringValue,
                "fb_success": "1",
                "fb_payment_info_available": "1",
                "fb_source": source,
                "wp_source": source,
                "wp_product_id": productId,
                "wp_package_id": packageId,
                "wp_offering_id": offering?.identifier ?? "unknown",
                "wp_subscription_type": subscriptionType,
                "wp_is_trial": isTrial ? "1" : "0",
                "wp_purchase_timestamp": purchaseDate.map {
                    String(Int($0.timeIntervalSince1970))
                } ?? "unknown",
            ]
        )
        MetaAnalyticsService.shared.flush()
    }

    // MARK: - Dedup

    /// Returns `true` if this order id had not been reported before, and marks
    /// it reported. Thread-safe: paywall callbacks and StoreKit observers can
    /// land concurrently.
    private func claimOrderId(_ orderId: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }

        let defaults = UserDefaults.standard
        var fired = defaults.stringArray(forKey: Self.firedOrderIdsKey) ?? []
        guard !fired.contains(orderId) else { return false }
        fired.append(orderId)
        if fired.count > Self.maxRememberedOrderIds {
            fired.removeFirst(fired.count - Self.maxRememberedOrderIds)
        }
        defaults.set(fired, forKey: Self.firedOrderIdsKey)
        return true
    }

    // MARK: - Helpers

    /// Meta requires a non-empty `fb_order_id` on Subscribe — it's the dedup key
    /// on their side too. Prefer the real transaction id; otherwise derive one
    /// that is stable across repeat deliveries of the same purchase.
    private static func orderId(
        transaction: StoreTransaction?,
        entitlement: EntitlementInfo?,
        productId: String
    ) -> String? {
        if let id = transaction?.transactionIdentifier, !id.isEmpty { return id }
        guard let purchaseDate = entitlement?.latestPurchaseDate else { return nil }
        return "\(productId)_\(Int(purchaseDate.timeIntervalSince1970))"
    }

    private static func subscriptionType(for productId: String) -> String {
        if productId.contains("lifetime") { return "lifetime" }
        if productId.contains("annual") || productId.contains("yearly") { return "yearly" }
        if productId.contains("monthly") { return "monthly" }
        return "unknown"
    }

    private static func predictedLTV(amount: Decimal, subscriptionType: String) -> Decimal {
        switch subscriptionType {
        case "monthly": return amount * 4
        case "yearly": return amount * (Decimal(string: "1.3") ?? 1)
        default: return amount
        }
    }

    /// The package whose price best represents the offering for a ViewContent
    /// value signal — RevenueCat's designated default, else the first package.
    private static func headlineProduct(in offering: Offering?) -> StoreProduct? {
        guard let offering else { return nil }
        return (offering.availablePackages.first(where: { $0.identifier == "$rc_annual" })
            ?? offering.availablePackages.first)?.storeProduct
    }
}
