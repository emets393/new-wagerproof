#if DEBUG
import Foundation
import WagerproofStores

/// Deterministic sample data for the Settings parity screenshots.
/// Not used in production — gated behind `#if DEBUG`.
enum SettingsFixtures {
    static let sampleEmail = "habib225@gmail.com"
    static let sampleUserId = UUID(uuidString: "00000000-0000-0000-0000-000000000042")!
    static let sampleAppVersion = "3.5.5 (46)"

    /// Build an `AdminModeStore` pre-resolved into a non-admin state so the
    /// SettingsView renders without flashing the developer drawer.
    @MainActor
    static func makeAdminMode(isAdmin: Bool = false) -> AdminModeStore {
        let store = AdminModeStore()
        store.debugSet(isAdmin: isAdmin)
        return store
    }

    /// Build a `RevenueCatStore` pre-resolved to the requested entitlement
    /// state. `.granted` = Pro, `.denied` = Free, `.unknown` = still resolving
    /// (drives the hero "VERIFYING ACCESS" copy).
    @MainActor
    static func makeRevenueCat(
        status: RevenueCatStore.EntitlementStatus = .denied,
        subscriptionType: String? = nil
    ) -> RevenueCatStore {
        let store = RevenueCatStore()
        store.debugSet(status: status, subscriptionType: subscriptionType, isLoading: false)
        return store
    }

    /// Build a `SettingsStore` with the requested notification permission so
    /// the Preferences section renders deterministically.
    @MainActor
    static func makeSettings(
        notificationPermission: SettingsStore.NotificationPermission = .granted
    ) -> SettingsStore {
        let store = SettingsStore()
        store.debugSet(notificationPermission: notificationPermission)
        return store
    }

    /// Build a `ProAccessStore` facade wrapping the supplied stores so the
    /// harness's environment matches the production wiring.
    @MainActor
    static func makeProAccess(
        revenueCat: RevenueCatStore,
        adminMode: AdminModeStore
    ) -> ProAccessStore {
        ProAccessStore(revenueCat: revenueCat, adminMode: adminMode)
    }
}
#endif
