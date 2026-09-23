import AppTrackingTransparency
import Observation
import UIKit

/// One device-level permission flow shared by onboarding and returning accounts.
/// Presenting an explanation never requests permission; only an explicit tap does.
@Observable
@MainActor
public final class TrackingAuthorizationService {
    public static let shared = TrackingAuthorizationService(
        readStatus: { ATTrackingManager.trackingAuthorizationStatus },
        isActive: { UIApplication.shared.applicationState == .active },
        requestAuthorization: { await ATTrackingManager.requestTrackingAuthorization() },
        applyConsent: { status in
            MetaAnalyticsService.shared.updateTrackingAuthorization()
            await RevenueCatService.shared.refreshAttributionAfterTrackingAuthorization(
                isAuthorized: status == .authorized
            )
        }
    )

    public private(set) var status: ATTrackingManager.AuthorizationStatus
    public private(set) var isRequesting = false
    private let readStatus: () -> ATTrackingManager.AuthorizationStatus
    private let isActive: () -> Bool
    private let requestAuthorization: () async -> ATTrackingManager.AuthorizationStatus
    private let applyConsent: (ATTrackingManager.AuthorizationStatus) async -> Void

    init(
        readStatus: @escaping () -> ATTrackingManager.AuthorizationStatus,
        isActive: @escaping () -> Bool,
        requestAuthorization: @escaping () async -> ATTrackingManager.AuthorizationStatus,
        applyConsent: @escaping (ATTrackingManager.AuthorizationStatus) async -> Void
    ) {
        self.readStatus = readStatus
        self.isActive = isActive
        self.requestAuthorization = requestAuthorization
        self.applyConsent = applyConsent
        self.status = readStatus()
    }

    /// Also picks up changes made in Settings. Does not show a system prompt.
    public func refresh() async {
        guard !isRequesting else { return }
        let current = readStatus()
        status = current
        await applyConsent(current)
    }

    /// False means no decision was available (inactive app, concurrent request,
    /// or another system prompt). Keep the explanation visible and allow retry.
    /// Denied and restricted are completed choices, just like authorized.
    @discardableResult
    public func request() async -> Bool {
        guard !isRequesting, isActive() else { return false }
        isRequesting = true
        defer { isRequesting = false }
        let current = readStatus()
        let result = current == .notDetermined ? await requestAuthorization() : current
        await applyConsent(result)
        status = result
        return result != .notDetermined
    }
}
