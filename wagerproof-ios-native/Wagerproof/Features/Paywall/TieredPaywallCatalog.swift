import Foundation
import WagerproofModels

/// Opt-in experiment. Existing subscribers and the default paywall are unchanged.
enum TieredPaywallConfiguration {
    // Enables the renderer; RevenueCat placement targeting still controls enrollment.
    static let enabled = true
    static let offeringID = "wagerproof_tiers_v1"

    /// Purchase diagnostics are available in development and TestFlight only.
    static var purchaseTestingAvailable: Bool {
        #if DEBUG
        true
        #else
        Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
        #endif
    }

    /// Device-local design testing in the real onboarding host. Never enables
    /// purchases or changes the production placement audience.
    static var onboardingPreviewEnabled: Bool {
        #if DEBUG
        UserDefaults.standard.bool(forKey: "tieredOnboardingPreview")
        #else
        false
        #endif
    }
}

enum PaywallTier: Int, CaseIterable, Identifiable {
    case standard, premium, pro
    var id: Int { rawValue }
    var slug: String { ["standard", "premium", "pro"][rawValue] }
    var title: String { accessTier.title }
    var summary: String {
        ["Know the game. Follow the market.", "Find your edge with deeper research.", "Your strategies. Your team of AI agents."][rawValue]
    }
    func priceCents(yearly: Bool) -> Int {
        (yearly ? [19999, 29999, 35999] : [1999, 2999, 7999])[rawValue]
    }
    func webPriceCents(yearly: Bool) -> Int {
        // Round half-up to the nearest cent, matching the web catalog.
        (priceCents(yearly: yearly) * 70 + 50) / 100
    }
    /// Yearly comparisons annualize the higher USD monthly reference price.
    /// Other storefront currencies must use their own localized comparison.
    func usdCompareAtCents(yearly: Bool) -> Int? {
        let monthly: Int
        switch self {
        case .standard: return nil
        case .premium: monthly = 5999
        case .pro: monthly = 12999
        }
        return monthly * (yearly ? 12 : 1)
    }
    func packageID(yearly: Bool) -> String { "\(slug)_\(yearly ? "yearly" : "monthly")" }
    func productID(yearly: Bool) -> String { "com.wagerproof.mobile.tiers.\(packageID(yearly: yearly))" }
    var accessTier: SubscriptionTier { SubscriptionTier(rawValue: slug)! }
    var entitlementID: String { accessTier.entitlementID }
    static func usd(_ cents: Int) -> String { String(format: "$%.2f", Double(cents) / 100) }
}

struct TieredPaywallFeature: Identifiable {
    let id: String
    let icon: String
    let title: String
    let detail: String
    let tier: PaywallTier

    static let previewFeatures: [Self] = [
        .init(id: "games", icon: "sportscourt", title: "Game Data & Matchups", detail: "Every matchup, key stats, injury reports, and live scores in one place.", tier: .standard),
        .init(id: "predictions", icon: "chart.xyaxis.line", title: "WagerProof Predictions", detail: "Model projections and signals to help you research every game.", tier: .standard),
        .init(id: "markets", icon: "chart.bar.xaxis", title: "Prediction Markets", detail: "Follow market probabilities and see how they compare with our models.", tier: .standard),
        .init(id: "discord", icon: "bubble.left.and.bubble.right", title: "Discord Community", detail: "Join the WagerProof community to discuss games, research, and strategy.", tier: .standard),
        .init(id: "outliers", icon: "bolt.circle", title: "Outliers", detail: "Spot the biggest gaps between model projections and market expectations.", tier: .premium),
        .init(id: "props", icon: "figure.basketball", title: "Player Props", detail: "Research player lines, matchup context, and recent performance.", tier: .premium),
        .init(id: "parlays", icon: "square.stack.3d.up", title: "Parlay God", detail: "Explore curated parlay combinations with the research behind every leg.", tier: .premium),
        .init(id: "cheats", icon: "list.bullet.rectangle", title: "Cheat Sheets", detail: "Find the strongest trends and prop opportunities in a quick, scannable view.", tier: .premium),
        .init(id: "agents", icon: "person.crop.square", title: "Personal AI Agents", detail: "Build up to 30 agents around your strategies, with 8 active in your office.", tier: .pro),
        .init(id: "picks", icon: "checkmark.seal", title: "Agent Picks & Autopilot", detail: "Get picks from your agents and let autopilot handle their daily research.", tier: .pro),
        .init(id: "leaderboard", icon: "trophy", title: "Full Agent Leaderboard", detail: "Explore every rank, compare track records, and follow the agents you trust.", tier: .pro),
    ]
}


/// Shared artwork mapping keeps the paywall and every feature gate consistent.
/// Existing artwork remains the Standard tier; upgrades use sibling assets.
enum TierArtwork {
    static func bolt(for tier: SubscriptionTier) -> String {
        switch tier {
        case .standard: "TieredPaywallBolt"
        case .premium: "TieredPaywallPremiumBolt"
        case .pro: "TieredPaywallProBolt"
        }
    }

    static func background(for tier: SubscriptionTier) -> String {
        switch tier {
        case .standard: "TieredPaywallArtwork"
        case .premium: "TieredPaywallPremiumArtwork"
        case .pro: "TieredPaywallProArtwork"
        }
    }
}
