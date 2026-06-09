import Foundation
import Mixpanel

/// Mixpanel fan-out + Apple-native event sinks. Mirrors the RN
/// `services/analytics.ts` surface so event names stay 1:1 across platforms.
public final class AnalyticsService: @unchecked Sendable {
    public static let shared = AnalyticsService()

    private var initialized = false

    private init() {}

    /// Call once from `WagerproofApp.init` with the token built into Secrets.
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
