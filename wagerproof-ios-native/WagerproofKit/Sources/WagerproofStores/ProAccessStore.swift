import Foundation
import Observation
import WagerproofModels

/// `ProAccessStore` mirrors `wagerproof-mobile/hooks/useProAccess.ts`. It is a
/// thin facade that combines `RevenueCatStore` + `AdminModeStore` into a single
/// reactive "can the user see Pro features?" answer.
///
/// Access priority: eligible local preview, legacy force-free toggle, admin,
/// then real RevenueCat access. Preview never changes the underlying stores.
///
/// We mark the facade `@Observable` so views can put it in their environment
/// and SwiftUI's observation machinery transitively tracks the underlying
/// stores when a view reads `isPro` / `isAdmin` / `subscriptionType`.
@Observable
@MainActor
public final class ProAccessStore {
    private let revenueCat: RevenueCatStore
    private let adminMode: AdminModeStore
    private var selectedPreview: EntitlementPreview = .actual

    public static var previewAvailable: Bool {
        #if DEBUG
        true
        #else
        Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
        #endif
    }

    /// Session-only. Reset on restart/sign-out; never alter the real customer.
    public var previewMode: EntitlementPreview {
        get { Self.previewAvailable ? selectedPreview : .actual }
        set {
            guard Self.previewAvailable else { return }
            revenueCat.forceFreemiumMode = false
            selectedPreview = newValue
        }
    }
    public var isPreviewing: Bool { previewMode != .actual }
    private var access: SubscriptionAccessState {
        .resolve(tier: revenueCat.subscriptionTier, isTiered: revenueCat.isTieredCustomer,
                 isAdmin: adminMode.isAdmin, forceFree: revenueCat.forceFreemiumMode,
                 preview: previewMode, previewAvailable: Self.previewAvailable)
    }
    public var subscriptionTier: SubscriptionTier? { access.isAdmin ? .pro : access.tier }
    public var isTieredCustomer: Bool { access.isTiered }
    public var planTitle: String {
        if isPreviewing { return previewMode.title }
        if let tier = subscriptionTier {
            return tier == .pro && !isTieredCustomer ? "Pro · Existing plan" : tier.title
        }
        return "Free"
    }

    public init(revenueCat: RevenueCatStore, adminMode: AdminModeStore) {
        self.revenueCat = revenueCat
        self.adminMode = adminMode
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-uiScreenshotMode"),
           let raw = UserDefaults.standard.string(forKey: "entitlementPreview"),
           let mode = EntitlementPreview(rawValue: raw) {
            selectedPreview = mode
        }
        #endif
    }

    public var isPro: Bool {
        hasAccess(to: .pro)
    }

    public var hasSubscription: Bool { hasAccess(to: .standard) }

    public func hasAccess(to minimum: SubscriptionTier) -> Bool {
        access.hasAccess(to: minimum)
    }

    /// Additional restrictions apply only to customers in the new catalog.
    /// Legacy free previews and all legacy Pro plans keep their old behavior.
    public func isTierRestricted(_ minimum: SubscriptionTier) -> Bool {
        access.isRestricted(minimum)
    }

    public var isAdmin: Bool { access.isAdmin }

    public var subscriptionType: String? {
        if isPreviewing { return nil }
        // Admins with no real subscription show as `nil` — RN matches this so
        // the Settings hero card doesn't print "active monthly membership"
        // when the user is just role-flagged.
        if adminMode.isAdmin && revenueCat.entitlementStatus != .granted {
            return nil
        }
        return revenueCat.subscriptionType
    }

    /// `true` while we're still figuring out the user's status. Used to
    /// disable Pro-gated CTAs during the resolution window. Matches RN's
    /// combined `isRevenueCatLoading || isAdminLoading || !resolved`.
    public var isLoading: Bool {
        if isPreviewing { return false }
        if !adminMode.roleResolved { return true }
        if !adminMode.isAdmin && !revenueCat.isEntitlementResolved { return true }
        if revenueCat.isLoading { return true }
        return false
    }

    /// Surface the underlying store so the view can present the Customer
    /// Center / paywall directly without an extra indirection.
    public var revenueCatStore: RevenueCatStore { revenueCat }
    public var adminModeStore: AdminModeStore { adminMode }
}
