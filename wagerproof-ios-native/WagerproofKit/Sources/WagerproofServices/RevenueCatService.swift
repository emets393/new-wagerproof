import Foundation
import RevenueCat

/// `RevenueCatService` wraps the RevenueCat Swift SDK. It mirrors
/// `wagerproof-mobile/services/revenuecat.ts` byte-for-byte where APIs overlap
/// (configure / logIn / logOut / getCustomerInfo / getOfferings / restore).
///
/// SDK identity: `Purchases.shared` is the singleton entry point. The native
/// Swift SDK takes the same API keys (iOS = `appl_TFQYZRtHkCBrnaILkniTjsulyHK`)
/// and the same entitlement identifier (`"WagerProof Pro"`) as the RN bridge.
///
/// Initialization flow:
///   1. App launch → `bootstrap(userId: nil)` configures the SDK.
///   2. Auth completes → `logIn(userId:)` aliases the anonymous RC user to the
///      authenticated `user.id`.
///   3. Auth sign-out → `logOut()` resets to an anonymous RC user.
public final class RevenueCatService: @unchecked Sendable {
    public static let shared = RevenueCatService()

    public static let apiKey = "appl_TFQYZRtHkCBrnaILkniTjsulyHK"
    public static let entitlementIdentifier = "WagerProof Pro"

    // Mirrors RN `PAYWALL_PLACEMENTS` — these identifiers must match the
    // placements configured in the RevenueCat dashboard.
    public enum Placement {
        public static let onboarding = "onboarding"
        public static let genericFeature = "generic_feature"
        public static let agentFeature = "agent_feature"
    }

    private var configured = false

    private init() {}

    /// Configure the RevenueCat SDK with the iOS API key. Idempotent.
    /// Optional `userId` aliases the RC user immediately (matches RN's
    /// `initializeRevenueCat(userId)` shape).
    public func bootstrap(userId: String? = nil) {
        guard !configured else { return }
        let config = Configuration.Builder(withAPIKey: Self.apiKey)
            .with(appUserID: userId)
            .build()
        Purchases.configure(with: config)
        #if DEBUG
        Purchases.logLevel = .debug
        #endif
        configured = true
        // Best-effort device identifier collection — matches RN's
        // `collectDeviceIdentifiers()` fire-and-forget call.
        Purchases.shared.collectDeviceIdentifiers()
    }

    public var isConfigured: Bool { configured }

    /// Identify a known user by their Supabase user id. Returns the resulting
    /// `CustomerInfo` and whether RC created a brand-new customer (matches
    /// RN's `{ customerInfo, created }` shape).
    @discardableResult
    public func logIn(userId: String) async throws -> (customerInfo: CustomerInfo, created: Bool) {
        let result = try await Purchases.shared.logIn(userId)
        return (result.customerInfo, result.created)
    }

    /// Reset to an anonymous RC user. Called when Supabase auth signs out.
    public func logOut() async {
        do {
            _ = try await Purchases.shared.logOut()
        } catch {
            // RN swallows the error (`console.warn`) — match behavior so a
            // sign-out doesn't block UI.
        }
    }

    public func customerInfo() async throws -> CustomerInfo {
        try await Purchases.shared.customerInfo()
    }

    public func currentOffering() async throws -> Offering? {
        let offerings = try await Purchases.shared.offerings()
        return offerings.current
    }

    /// Returns the placement-specific offering, falling back to the current
    /// offering if RC has no placement attached. Mirrors RN's
    /// `getCurrentOfferingForPlacement(placementId)` fallback behavior.
    public func offering(forPlacement placementIdentifier: String) async throws -> Offering? {
        let offerings = try await Purchases.shared.offerings()
        if let placementOffering = offerings.currentOffering(forPlacement: placementIdentifier) {
            return placementOffering
        }
        return offerings.current
    }

    public func restorePurchases() async throws -> CustomerInfo {
        try await Purchases.shared.restorePurchases()
    }

    public func syncPurchases() async throws -> CustomerInfo {
        try await Purchases.shared.syncPurchases()
    }

    /// Returns `true` when the customer info contains the WagerProof Pro
    /// entitlement in `.active`. Matches RN's
    /// `customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIER] !== undefined`.
    public func hasProEntitlement(_ info: CustomerInfo) -> Bool {
        info.entitlements.active[Self.entitlementIdentifier] != nil
    }

    /// Map an active entitlement's productIdentifier to a coarse subscription
    /// type. Matches RN's `getActiveSubscriptionType(customerInfo)`.
    public func activeSubscriptionType(_ info: CustomerInfo) -> String? {
        guard let entitlement = info.entitlements.active[Self.entitlementIdentifier] else { return nil }
        let productId = entitlement.productIdentifier.lowercased()
        if productId.contains("lifetime") { return "lifetime" }
        if productId.contains("annual") || productId.contains("yearly") { return "yearly" }
        if productId.contains("monthly") { return "monthly" }
        return nil
    }

    /// Returns the active entitlement's productIdentifier (used by the
    /// secret-settings "Check Offerings" debug action).
    public func activeProductIdentifier(_ info: CustomerInfo) -> String? {
        info.entitlements.active[Self.entitlementIdentifier]?.productIdentifier
    }

    public func activeExpirationDate(_ info: CustomerInfo) -> Date? {
        info.entitlements.active[Self.entitlementIdentifier]?.expirationDate
    }
}
