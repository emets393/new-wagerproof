import Foundation
import Observation

/// `ProAccessStore` mirrors `wagerproof-mobile/hooks/useProAccess.ts`. It is a
/// thin facade that combines `RevenueCatStore` + `AdminModeStore` into a single
/// reactive "can the user see Pro features?" answer.
///
/// Access priority — identical to the RN hook:
///   1. If `forceFreemiumMode` is on (set on RevenueCatStore via the secret
///      settings toggle), report not-pro regardless of the underlying state.
///   2. If the user is an admin, report Pro (admins always have full access).
///   3. Otherwise, defer to RevenueCat's entitlement status.
///
/// We mark the facade `@Observable` so views can put it in their environment
/// and SwiftUI's observation machinery transitively tracks the underlying
/// stores when a view reads `isPro` / `isAdmin` / `subscriptionType`.
@Observable
@MainActor
public final class ProAccessStore {
    private let revenueCat: RevenueCatStore
    private let adminMode: AdminModeStore

    public init(revenueCat: RevenueCatStore, adminMode: AdminModeStore) {
        self.revenueCat = revenueCat
        self.adminMode = adminMode
    }

    public var isPro: Bool {
        if revenueCat.forceFreemiumMode { return false }
        if adminMode.isAdmin { return true }
        return revenueCat.entitlementStatus == .granted
    }

    public var isAdmin: Bool { adminMode.isAdmin }

    public var subscriptionType: String? {
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
