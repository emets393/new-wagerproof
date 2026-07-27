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
        // Lowercased for the same case-sensitivity reason as logIn below.
        let config = Configuration.Builder(withAPIKey: Self.apiKey)
            .with(appUserID: userId?.lowercased())
            .build()
        Purchases.configure(with: config)
        #if DEBUG
        Purchases.logLevel = .debug
        #endif
        configured = true
        // Best-effort device identifier collection — matches RN's
        // `collectDeviceIdentifiers()` fire-and-forget call.
        Purchases.shared.collectDeviceIdentifiers()

        // Apple Search Ads attribution token — unrelated to Meta, but this is
        // the only place RC attribution is configured, and it costs nothing.
        Purchases.shared.attribution.enableAdServicesAttributionTokenCollection()

        // Hand Meta's anonymous install ID to RevenueCat as the `$fbAnonId`
        // subscriber attribute. RevenueCat's server-side Meta integration sends
        // purchase/trial conversions to the Conversions API, and WITHOUT this ID
        // those server events cannot be joined back to the install — which is
        // the only attribution path that survives an ATT denial. Closes the open
        // acceptance criterion in docs/wagerproof-migration/tickets/055-meta-sdk-events.md.
        if let fbAnonymousID = MetaAnalyticsService.shared.anonymousID(), !fbAnonymousID.isEmpty {
            Purchases.shared.attribution.setFBAnonymousID(fbAnonymousID)
        }
    }

    /// Push the signed-in user's identity to RevenueCat as subscriber
    /// attributes. RC forwards these to its downstream integrations (Meta CAPI
    /// included) where they act as hashed matching keys — the same role
    /// Advanced Matching plays on the client SDK.
    public func setSubscriberIdentity(email: String?, displayName: String?) {
        guard configured else { return }
        if let email, !email.isEmpty {
            Purchases.shared.attribution.setEmail(email)
        }
        if let displayName, !displayName.isEmpty {
            Purchases.shared.attribution.setDisplayName(displayName)
        }
        Purchases.shared.collectDeviceIdentifiers()
    }

    public var isConfigured: Bool { configured }

    /// Identify a known user by their Supabase user id. Returns the resulting
    /// `CustomerInfo` and whether RC created a brand-new customer (matches
    /// RN's `{ customerInfo, created }` shape).
    @discardableResult
    public func logIn(userId: String) async throws -> (customerInfo: CustomerInfo, created: Bool) {
        // RC app-user-ids are CASE-SENSITIVE. Web/RN/Android and every backend
        // grant use the lowercase Supabase uuid, but Swift's UUID.uuidString is
        // UPPERCASE — logging in with it created a second, entitlement-less RC
        // customer for every iOS user (paywall + locked pages for paying users,
        // incident 2026-07). Normalize here so every caller inherits the fix.
        let result = try await Purchases.shared.logIn(userId.lowercased())
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
