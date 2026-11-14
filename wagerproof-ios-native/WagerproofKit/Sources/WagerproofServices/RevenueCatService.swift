import AppTrackingTransparency
import Foundation
import RevenueCat
import WagerproofModels

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
        public static let tierUpgradePremium = "tier_upgrade_premium"
        public static let tierUpgradePro = "tier_upgrade_pro"
    }

    private var configured = false
    private var subscriberIdentity: SubscriberIdentity?

    private struct SubscriberIdentity {
        let email: String?
        let displayName: String?
        let phoneNumber: String?
        let authProvider: String?
        let username: String?
        let accountCreatedAt: Date?
    }

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
        applyTrackingConsent()
    }

    /// Push every trustworthy signed-in identity field available to RevenueCat.
    /// Standard fields are forwarded to supported attribution integrations
    /// (including Meta), while the WagerProof fields remain useful for RC
    /// customer inspection and targeting.
    public func setSubscriberIdentity(
        email: String?,
        displayName: String?,
        phoneNumber: String?,
        authProvider: String?,
        username: String?,
        accountCreatedAt: Date?
    ) {
        guard configured else { return }
        let identity = SubscriberIdentity(
            email: email,
            displayName: displayName,
            phoneNumber: phoneNumber,
            authProvider: authProvider,
            username: username,
            accountCreatedAt: accountCreatedAt
        )
        subscriberIdentity = identity
        applySubscriberIdentity(identity)
    }

    private func applySubscriberIdentity(_ identity: SubscriberIdentity) {
        guard ATTrackingManager.trackingAuthorizationStatus == .authorized else { return }
        Purchases.shared.attribution.setEmail(Self.nonEmpty(identity.email))
        Purchases.shared.attribution.setDisplayName(Self.nonEmpty(identity.displayName))
        Purchases.shared.attribution.setPhoneNumber(Self.nonEmpty(identity.phoneNumber))

        var attributes: [String: String] = [:]
        if let authProvider = Self.nonEmpty(identity.authProvider) {
            attributes["wagerproof_auth_provider"] = authProvider
        }
        if let username = Self.nonEmpty(identity.username) {
            attributes["wagerproof_username"] = username
        }
        if let accountCreatedAt = identity.accountCreatedAt {
            attributes["wagerproof_account_created_at"] = ISO8601DateFormatter().string(from: accountCreatedAt)
        }
        if !attributes.isEmpty {
            Purchases.shared.attribution.setAttributes(attributes)
        }

        // Re-apply the Meta install identifier after RevenueCat has attached the
        // authenticated App User ID. This makes the linkage robust even when
        // Supabase auth and RevenueCat logIn finish in different orders.
        if let fbAnonymousID = MetaAnalyticsService.shared.anonymousID(), !fbAnonymousID.isEmpty {
            Purchases.shared.attribution.setFBAnonymousID(fbAnonymousID)
        }
        Purchases.shared.attribution.collectDeviceIdentifiers()
    }

    /// Purchase and entitlement management work regardless of ATT. Advertising
    /// identifiers and matching attributes are attached only with authorization.
    private func applyTrackingConsent() {
        guard configured else { return }
        if ATTrackingManager.trackingAuthorizationStatus == .authorized {
            if let subscriberIdentity { applySubscriberIdentity(subscriberIdentity) }
            Purchases.shared.attribution.collectDeviceIdentifiers()
            if let anonymousID = MetaAnalyticsService.shared.anonymousID() {
                Purchases.shared.attribution.setFBAnonymousID(anonymousID)
            }
        } else {
            // Clear attributes saved by older builds or a previous authorization.
            Purchases.shared.attribution.setEmail(nil)
            Purchases.shared.attribution.setDisplayName(nil)
            Purchases.shared.attribution.setPhoneNumber(nil)
            Purchases.shared.attribution.setAttributes([
                "$fbAnonId": "", "$idfa": "", "$idfv": "", "$ip": "",
                "wagerproof_auth_provider": "", "wagerproof_username": "",
                "wagerproof_account_created_at": ""
            ])
        }
    }

    public func refreshAttributionAfterTrackingAuthorization(isAuthorized: Bool) async {
        guard configured else { return }
        // Read the OS again rather than trusting a caller's cached choice.
        applyTrackingConsent()
        do {
            _ = try await Purchases.shared.syncAttributesAndOfferingsIfNeeded()
        } catch {
            #if DEBUG
            print("[RevenueCat] Failed to sync attribution after ATT: \(error.localizedDescription)")
            #endif
        }
    }

    public var isConfigured: Bool { configured }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty else {
            return nil
        }
        return value
    }

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
        // AuthStore and RevenueCatStore observe the same Supabase event
        // independently. Re-applying here makes the destination deterministic
        // whether profile loading or RevenueCat logIn completes first.
        applyTrackingConsent()
        return (result.customerInfo, result.created)
    }

    /// Reset to an anonymous RC user. Called when Supabase auth signs out.
    public func logOut() async {
        subscriberIdentity = nil
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

    /// Sync pending attributes before targeting. The SDK owns default-placement
    /// fallback; nil is an intentional No Offering, never a reason to use current.
    public func offering(forPlacement placementIdentifier: String) async throws -> Offering? {
        guard configured else { throw PlacementError.notConfigured }
        let userID = Purchases.shared.appUserID
        guard let offerings = try await Purchases.shared.syncAttributesAndOfferingsIfNeeded() else {
            throw PlacementError.missingOfferings
        }
        guard userID == Purchases.shared.appUserID else { throw PlacementError.identityChanged }
        return offerings.currentOffering(forPlacement: placementIdentifier)
    }

    public enum PlacementError: LocalizedError {
        case notConfigured, identityChanged, missingOfferings
        public var errorDescription: String? {
            "Subscription options could not be loaded for this account. Please try again."
        }
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

    public func subscriptionTier(_ info: CustomerInfo) -> SubscriptionTier? {
        SubscriptionTier.resolve(activeEntitlementIDs: Set(info.entitlements.active.keys))
    }

    public struct ServerSubscriptionAccess: Decodable, Sendable {
        public let subscriptionTier: SubscriptionTier?
        public let isTieredCustomer: Bool?
    }

    /// The authenticated resolver checks historical uppercase/anonymous RC
    /// identities. A legacy Pro plan on another identity must beat a new lower
    /// tier on the current SDK identity.
    public func serverSubscriptionAccess() async throws -> ServerSubscriptionAccess {
        let client = await MainSupabase.shared.client
        return try await client.functions.invoke("resolve-my-entitlement")
    }

    public func isTieredCustomer(_ info: CustomerInfo) -> Bool {
        SubscriptionTier.isTieredCustomer(productIDs: info.allPurchasedProductIdentifiers,
                                         entitlementIDs: Set(info.entitlements.all.keys))
    }

    private func highestEntitlement(_ info: CustomerInfo) -> EntitlementInfo? {
        guard let tier = subscriptionTier(info) else { return nil }
        return info.entitlements.active[tier.entitlementID]
    }

    /// Map an active entitlement's productIdentifier to a coarse subscription
    /// type. Matches RN's `getActiveSubscriptionType(customerInfo)`.
    public func activeSubscriptionType(_ info: CustomerInfo) -> String? {
        guard let entitlement = highestEntitlement(info) else { return nil }
        let productId = entitlement.productIdentifier.lowercased()
        if productId.contains("lifetime") { return "lifetime" }
        if productId.contains("annual") || productId.contains("yearly") { return "yearly" }
        if productId.contains("monthly") { return "monthly" }
        return nil
    }

    /// Returns the active entitlement's productIdentifier (used by the
    /// secret-settings "Check Offerings" debug action).
    public func activeProductIdentifier(_ info: CustomerInfo) -> String? {
        highestEntitlement(info)?.productIdentifier
    }

    public func activeExpirationDate(_ info: CustomerInfo) -> Date? {
        highestEntitlement(info)?.expirationDate
    }
}
