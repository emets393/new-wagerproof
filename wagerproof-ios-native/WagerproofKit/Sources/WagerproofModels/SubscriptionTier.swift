import Foundation

/// Cumulative access. Existing monthly, annual, promotional, and lifetime
/// products keep their existing WagerProof Pro entitlement and remain Pro.
public enum SubscriptionTier: String, CaseIterable, Codable, Sendable {
    case standard, premium, pro

    public var title: String {
        switch self {
        case .standard: "Premium"
        case .premium: "Premium Plus"
        case .pro: "Pro"
        }
    }
    public var rank: Int { Self.allCases.firstIndex(of: self)! }
    /// Billing identifiers are permanent and independent of marketing names.
    public var entitlementID: String {
        switch self {
        case .standard: "WagerProof Standard"
        case .premium: "WagerProof Premium"
        case .pro: "WagerProof Pro"
        }
    }
    public func includes(_ minimum: Self) -> Bool { rank >= minimum.rank }

    public static func resolve(activeEntitlementIDs: Set<String>) -> Self? {
        Self.allCases.reversed().first { activeEntitlementIDs.contains($0.entitlementID) }
    }

    /// Do not enroll legacy free accounts simply because the app was updated.
    /// An explicit new-catalog purchase (even subsequently expired) establishes
    /// the cohort. A legacy Pro entitlement always wins while active.
    public static func isTieredCustomer(productIDs: Set<String>, entitlementIDs: Set<String>) -> Bool {
        entitlementIDs.contains(Self.standard.entitlementID)
            || entitlementIDs.contains(Self.premium.entitlementID)
            || productIDs.contains { $0.hasPrefix("com.wagerproof.mobile.tiers.") || $0.hasPrefix("wp_tiers_") }
    }
}
