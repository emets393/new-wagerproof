import Foundation
import Observation
import RevenueCat
import WagerproofServices
import WagerproofSharedKit

/// `RevenueCatStore` mirrors `wagerproof-mobile/contexts/RevenueCatContext.tsx`.
///
/// Responsibilities:
/// - Bootstrap the `Purchases` SDK on app launch.
/// - Login/logout the RC alias when Supabase auth changes.
/// - Subscribe to `Purchases.shared.customerInfoStream` so we get push
///   updates when entitlements change (renewals, refunds, manual grants).
/// - Cache the granted/denied entitlement state to App Group user defaults so
///   widgets + cold-launch UI don't flash "free" while RC reconciles.
///
/// Trust-downgrade guard mirrors RN: an untrusted (stream) update never
/// overwrites a granted entitlement back to denied — that lockout is the
/// most common bug in subscription apps, so we explicitly bias toward
/// keeping access for paying users until a trusted refresh confirms.
@Observable
@MainActor
public final class RevenueCatStore {
    public enum EntitlementStatus: String, Sendable {
        case unknown
        case granted
        case denied
    }

    public enum CustomerInfoSource: Sendable {
        case login
        case loginRestore
        case refresh
        case purchase
        case restore
        case stream

        var isTrusted: Bool {
            switch self {
            case .login, .loginRestore, .refresh, .purchase, .restore:
                return true
            case .stream:
                return false
            }
        }
    }

    public private(set) var isInitialized: Bool = false
    public private(set) var isLoading: Bool = true
    /// `true` only after `attachUser` / `refreshCustomerInfo` returns a live
    /// customer-info payload for the currently-signed-in user. Set so the
    /// post-onboarding paywall predicate can ignore the stale `.denied`
    /// that RevenueCat's customer-info stream emits from local cache on
    /// cold launch before the live login fetch resolves — without this
    /// gate, paying users see a one-frame paywall flash on every launch.
    public private(set) var hasResolvedActiveUserEntitlement: Bool = false
    public private(set) var customerInfo: CustomerInfo?
    public private(set) var offering: Offering?
    public private(set) var entitlementStatus: EntitlementStatus = .unknown
    public private(set) var subscriptionType: String?
    public private(set) var lastError: String?

    /// When `true`, `isPro` returns `false` regardless of the underlying
    /// entitlement state. Used by the secret-settings "Simulate Freemium"
    /// toggle. Mirrors RN's `forceFreemiumMode`.
    public var forceFreemiumMode: Bool = false {
        didSet {
            AppGroup.defaults.set(forceFreemiumMode, forKey: "rc_force_freemium")
        }
    }

    /// Effective Pro flag. `false` when `forceFreemiumMode` is on, otherwise
    /// driven by the cached entitlement state.
    public var isPro: Bool {
        if forceFreemiumMode { return false }
        return entitlementStatus == .granted
    }

    public var isEntitlementResolved: Bool {
        entitlementStatus != .unknown
    }

    private var streamTask: Task<Void, Never>?
    private var currentUserId: UUID?

    public init() {
        if AppGroup.defaults.bool(forKey: "rc_force_freemium") {
            self.forceFreemiumMode = true
        }
    }

    /// Bootstrap the RevenueCat SDK. Idempotent. Called from
    /// `WagerproofApp.task` at app launch, before any auth lifecycle fires.
    public func bootstrap() {
        guard !isInitialized else { return }
        RevenueCatService.shared.bootstrap(userId: nil)
        isInitialized = RevenueCatService.shared.isConfigured
        // Subscribe to the customer info stream as soon as the SDK is up so
        // we don't miss native StoreKit 2 / Play Billing lifecycle events.
        startCustomerInfoStream()
    }

    /// Identify a Supabase user with RevenueCat. Called from the auth lifecycle
    /// handler whenever a new authenticated session arrives.
    public func attachUser(_ userId: UUID) async {
        guard isInitialized else { return }
        currentUserId = userId
        isLoading = true
        do {
            let (info, _) = try await RevenueCatService.shared.logIn(userId: userId.uuidString)
            apply(info, source: .login)
            await refreshOffering()
            lastError = nil
            // Only flip this true on the success path — a failed login
            // leaves us with whatever stale state we had, and the paywall
            // predicate should keep waiting rather than firing against
            // pre-login cached data.
            hasResolvedActiveUserEntitlement = true
        } catch {
            lastError = error.localizedDescription
            // RN: keep entitlementStatus unchanged on login failure unless we
            // were `unknown`. Paying users should never get downgraded just
            // because the network blipped during sign-in.
            if entitlementStatus == .unknown {
                entitlementStatus = .denied
            }
        }
        isLoading = false
    }

    /// Reset back to an anonymous RC user. Called on Supabase sign-out.
    public func detachUser() async {
        currentUserId = nil
        await RevenueCatService.shared.logOut()
        customerInfo = nil
        entitlementStatus = .denied
        subscriptionType = nil
        isLoading = false
        // Reset the gate so the next sign-in re-runs the live login fetch
        // before the paywall predicate is allowed to fire.
        hasResolvedActiveUserEntitlement = false
    }

    /// Force-refresh the customer info from RC servers. Trusted source —
    /// allowed to downgrade granted→denied.
    public func refreshCustomerInfo() async {
        guard isInitialized else {
            isLoading = false
            return
        }
        do {
            let info = try await RevenueCatService.shared.customerInfo()
            apply(info, source: .refresh)
            lastError = nil
            // A successful refresh also satisfies the paywall predicate's
            // "live data for the active user" requirement.
            hasResolvedActiveUserEntitlement = true
        } catch {
            lastError = error.localizedDescription
            if entitlementStatus == .unknown { entitlementStatus = .denied }
        }
    }

    /// Restore purchases from the App Store. Trusted source.
    public func restorePurchases() async throws {
        let info = try await RevenueCatService.shared.restorePurchases()
        apply(info, source: .restore)
    }

    /// Force-sync purchases from the App Store. Trusted source.
    public func syncPurchases() async throws {
        let info = try await RevenueCatService.shared.syncPurchases()
        apply(info, source: .refresh)
    }

    /// Fetch the current offering (used for paywall display).
    public func refreshOffering() async {
        do {
            offering = try await RevenueCatService.shared.currentOffering()
        } catch {
            offering = nil
        }
    }

    public func fetchOffering(forPlacement placementId: String) async -> Offering? {
        do {
            return try await RevenueCatService.shared.offering(forPlacement: placementId)
        } catch {
            return nil
        }
    }

    public func clearError() {
        lastError = nil
    }

    // MARK: - Internal

    /// Apply a `CustomerInfo` snapshot to the store. Honors the
    /// trust-downgrade guard so an untrusted stream update can never lock a
    /// paying user out — only an explicit refresh / restore / purchase can.
    private func apply(_ info: CustomerInfo, source: CustomerInfoSource) {
        let hasEntitlement = RevenueCatService.shared.hasProEntitlement(info)
        let nextStatus: EntitlementStatus = hasEntitlement ? .granted : .denied
        let nextType = RevenueCatService.shared.activeSubscriptionType(info)

        // Trust-downgrade guard. The native StoreKit listener fires with
        // stale anonymous-identity data during sign-in; honoring it would
        // strand paying users. Real downgrades arrive via a trusted refresh.
        if entitlementStatus == .granted, nextStatus == .denied, !source.isTrusted {
            return
        }

        customerInfo = info
        entitlementStatus = nextStatus
        subscriptionType = nextType

        // Persist a coarse-grained snapshot to the App Group defaults so
        // widgets + cold launch can render Pro state without waiting for RC.
        AppGroup.defaults.set(hasEntitlement, forKey: AppGroupKey.proEntitlementGranted)
        if let nextType {
            AppGroup.defaults.set(nextType, forKey: AppGroupKey.proSubscriptionType)
        } else {
            AppGroup.defaults.removeObject(forKey: AppGroupKey.proSubscriptionType)
        }
    }

    /// Subscribe to RevenueCat's customer info async stream. Whenever the SDK
    /// emits an update (renewal, refund, purchase from another device) we
    /// re-apply it as an untrusted `.stream` source so the trust-downgrade
    /// guard protects already-granted users.
    private func startCustomerInfoStream() {
        guard streamTask == nil else { return }
        streamTask = Task { [weak self] in
            for await info in Purchases.shared.customerInfoStream {
                guard let self else { return }
                await MainActor.run {
                    self.apply(info, source: .stream)
                }
            }
        }
    }

    // `streamTask` is main-actor isolated; `deinit` runs on the actor that
    // owns the last reference and Swift 6 enforces strict isolation. Mark the
    // deinit `nonisolated` and skip the cancel — the system task will be
    // cleaned up by the runtime when the owning store is dropped. (Fixed
    // inline by B21 implementer to unblock build — pre-existing issue from a
    // parallel batch.)
    deinit { }

    // MARK: - DEBUG

    #if DEBUG
    public func debugSet(
        status: EntitlementStatus,
        subscriptionType: String? = nil,
        isLoading: Bool = false
    ) {
        self.entitlementStatus = status
        self.subscriptionType = subscriptionType
        self.isLoading = isLoading
        self.isInitialized = true
    }
    #endif
}
