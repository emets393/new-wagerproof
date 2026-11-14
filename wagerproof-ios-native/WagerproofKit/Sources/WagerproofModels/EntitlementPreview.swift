import Foundation

/// A local UI preview, never written to RevenueCat or the entitlement cache.
public enum EntitlementPreview: String, CaseIterable, Identifiable, Sendable {
    case actual, legacyFree, newFree, standard, premium, pro, legacyPro
    public var id: String { rawValue }
    public var title: String {
        switch self {
        case .actual: return "Use actual subscription"
        case .legacyFree: return "Legacy free"
        case .newFree: return "New plan · Expired / no access"
        case .standard: return SubscriptionTier.standard.title
        case .premium: return SubscriptionTier.premium.title
        case .pro: return "Pro"
        case .legacyPro: return "Legacy Pro"
        }
    }
    public var detail: String {
        switch self {
        case .actual: return "Use your real subscription and account permissions."
        case .legacyFree: return "Existing free previews, with the original upgrade gates."
        case .newFree: return "New-catalog account without an active subscription."
        case .standard: return "Game data, predictions, prediction markets, and Discord."
        case .premium: return "Premium plus Outliers, Props, Parlay God, and Cheat Sheets."
        case .pro: return "All features, including agents, picks, and the leaderboard."
        case .legacyPro: return "Existing subscriber with full access and no new tier restrictions."
        }
    }
    public var tier: SubscriptionTier? {
        switch self {
        case .standard: return .standard
        case .premium: return .premium
        case .pro, .legacyPro: return .pro
        default: return nil
        }
    }
    public var isTiered: Bool { [.newFree, .standard, .premium, .pro].contains(self) }
}

public struct SubscriptionAccessState: Equatable, Sendable {
    public let tier: SubscriptionTier?
    public let isTiered: Bool
    public let isAdmin: Bool
    public func hasAccess(to minimum: SubscriptionTier) -> Bool { isAdmin || tier?.includes(minimum) == true }
    public func isRestricted(_ minimum: SubscriptionTier) -> Bool { isTiered && !hasAccess(to: minimum) }

    public static func resolve(tier: SubscriptionTier?, isTiered: Bool, isAdmin: Bool,
                               forceFree: Bool, preview: EntitlementPreview, previewAvailable: Bool) -> Self {
        if previewAvailable && preview != .actual {
            return Self(tier: preview.tier, isTiered: preview.isTiered, isAdmin: false)
        }
        return Self(tier: forceFree ? nil : tier, isTiered: isTiered, isAdmin: !forceFree && isAdmin)
    }
}
