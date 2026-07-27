import Foundation
import Mixpanel

/// Mixpanel fan-out + Apple-native event sinks. Mirrors the RN
/// `services/analytics.ts` surface so event names stay 1:1 across platforms.
public final class AnalyticsService: @unchecked Sendable {
    public static let shared = AnalyticsService()

    /// Same project token as the RN app (`wagerproof-mobile/services/analytics.ts`)
    /// and web (`index.html`), so all three platforms land in one Mixpanel
    /// project. Not a secret — Mixpanel project tokens are write-only and ship
    /// inside every client bundle by design.
    public static let mixpanelToken = "1346df53bbd034722047aa8a96d5321e"

    private var initialized = false

    private init() {}

    /// Call once from `WagerproofApp.init`. Until this runs, every method below
    /// early-returns, so a missing bootstrap silently discards the entire funnel.
    public func bootstrap(token: String) {
        guard !initialized else { return }
        Mixpanel.initialize(token: token, trackAutomaticEvents: false)
        initialized = true
    }

    public func track(_ event: String, properties: [String: any MixpanelType] = [:]) {
        guard initialized else { return }
        Mixpanel.mainInstance().track(event: event, properties: properties)
    }

    public func identify(userId: String) {
        guard initialized else { return }
        Mixpanel.mainInstance().identify(distinctId: userId)
    }

    public func reset() {
        guard initialized else { return }
        Mixpanel.mainInstance().reset()
    }
}
