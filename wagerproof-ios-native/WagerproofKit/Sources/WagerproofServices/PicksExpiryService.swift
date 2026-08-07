import Foundation
import WagerproofModels
import WagerproofSharedKit

#if canImport(ActivityKit)
import ActivityKit
#endif

/// Owns the 3-hour hold on a new user's first agent picks — the deadline the
/// paywall pill counts down, and the Live Activity that keeps counting on the
/// Lock Screen and in the Dynamic Island after they close or minimize the paywall.
///
/// One deadline, two renderers. The window is persisted to the App Group so a
/// relaunch resumes the same countdown; the Live Activity derives its clock
/// from the same two dates and needs no updates to tick.
///
/// See .claude/docs/19_picks_expiry_hold.md
@MainActor
public final class PicksExpiryService {
    public static let shared = PicksExpiryService()

    /// Three hours. Long enough to survive a "I'll look later", short enough
    /// that the countdown is still visibly moving when they come back.
    public static let holdDuration: TimeInterval = 3 * 60 * 60

    public struct Window: Equatable, Sendable {
        public let startedAt: Date
        public let expiresAt: Date
        public let pickCount: Int
        public let agentName: String

        public var isExpired: Bool { Date() >= expiresAt }
        /// Convenience for `Text(timerInterval:)`, which wants a closed range.
        public var range: ClosedRange<Date> { startedAt...expiresAt }
    }

    private let defaults = AppGroup.defaults

    private init() {}

    // MARK: - Window

    /// The active hold, or nil when none was ever armed. An EXPIRED window is
    /// still returned — callers that care check `isExpired`, and reconciliation
    /// needs to see it in order to tear the Live Activity down.
    public var window: Window? {
        let raw = defaults.double(forKey: AppGroupKey.picksExpiryStartedAt)
        guard raw > 0 else { return nil }
        let startedAt = Date(timeIntervalSince1970: raw)
        return Window(
            startedAt: startedAt,
            expiresAt: startedAt.addingTimeInterval(Self.holdDuration),
            pickCount: max(1, defaults.integer(forKey: AppGroupKey.picksExpiryPickCount)),
            agentName: defaults.string(forKey: AppGroupKey.picksExpiryAgentName) ?? "Your agent"
        )
    }

    /// Starts a FRESH window, discarding any previous one. Called when a new
    /// set of picks actually lands (end of the onboarding reveal) — new picks
    /// means a new hold, even if the old one hadn't run out.
    @discardableResult
    public func arm(pickCount: Int, agentName: String) -> Window {
        let startedAt = Date()
        defaults.set(startedAt.timeIntervalSince1970, forKey: AppGroupKey.picksExpiryStartedAt)
        defaults.set(max(1, pickCount), forKey: AppGroupKey.picksExpiryPickCount)
        defaults.set(agentName, forKey: AppGroupKey.picksExpiryAgentName)

        let armed = Window(
            startedAt: startedAt,
            expiresAt: startedAt.addingTimeInterval(Self.holdDuration),
            pickCount: max(1, pickCount),
            agentName: agentName
        )
        AnalyticsService.shared.track("picks_hold_armed", properties: [
            "pick_count": armed.pickCount,
            "hold_hours": Int(Self.holdDuration / 3600),
        ])
        return armed
    }

    /// Returns the running window, arming a new one if there is none or the
    /// last one lapsed. Re-arming on lapse is deliberate: agents generate a new
    /// slate every day, so a permanently-expired countdown would be both wrong
    /// and dead weight on the paywall. The reveal's `arm(...)` supplies the real
    /// pick count; the fallback here only applies when the user never saw it
    /// (returning free user, re-presented paywall).
    @discardableResult
    public func ensureWindow(pickCount: Int, agentName: String) -> Window {
        if let existing = window, !existing.isExpired { return existing }
        return arm(pickCount: pickCount, agentName: agentName)
    }

    public func clear() {
        defaults.removeObject(forKey: AppGroupKey.picksExpiryStartedAt)
        defaults.removeObject(forKey: AppGroupKey.picksExpiryPickCount)
        defaults.removeObject(forKey: AppGroupKey.picksExpiryAgentName)
    }

    // MARK: - Live Activity

    /// True when the user has Live Activities enabled for WagerProof. The first
    /// `request` shows the system "Allow Live Activities?" prompt itself, so
    /// there is nothing to ask for up front.
    public var liveActivitiesAvailable: Bool {
        #if canImport(ActivityKit)
        return ActivityAuthorizationInfo().areActivitiesEnabled
        #else
        return false
        #endif
    }

    /// Puts the countdown on the Lock Screen. Called when the user leaves the
    /// paywall without buying, either by dismissing it or minimizing the app.
    ///
    /// Must run with the app in the foreground: ActivityKit refuses a
    /// background `request` without a push token, so minimize requests fire on
    /// the foreground-capable `.inactive` transition rather than `.background`.
    public func startLiveActivity(reason: String) {
        #if canImport(ActivityKit)
        guard let window, !window.isExpired else { return }
        guard liveActivitiesAvailable else {
            AnalyticsService.shared.track("picks_hold_activity_skipped", properties: [
                "reason": "activities_disabled",
            ])
            return
        }
        // Already showing — a second request would stack a duplicate card.
        guard Activity<PicksExpiryAttributes>.activities.isEmpty else { return }

        let attributes = PicksExpiryAttributes(
            agentName: window.agentName,
            pickCount: window.pickCount
        )
        let content = ActivityContent<PicksExpiryAttributes.ContentState>(
            state: PicksExpiryAttributes.ContentState(
                startedAt: window.startedAt,
                expiresAt: window.expiresAt
            ),
            // Past the deadline the activity goes stale on its own and the
            // widget swaps to its expired face — no update call, no runtime.
            staleDate: window.expiresAt
        )

        do {
            _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
            AnalyticsService.shared.track("picks_hold_activity_started", properties: [
                "reason": reason,
                "pick_count": window.pickCount,
                "minutes_left": Int(window.expiresAt.timeIntervalSinceNow / 60),
            ])
        } catch {
            AnalyticsService.shared.track("picks_hold_activity_failed", properties: [
                "reason": reason,
                "error": error.localizedDescription,
            ])
        }
        #endif
    }

    /// Tears the card down. `subscribed` dismisses immediately (the hold is
    /// moot); anything else leaves it up briefly so the user sees why it went.
    public func endLiveActivity(reason: String) {
        #if canImport(ActivityKit)
        let activities = Activity<PicksExpiryAttributes>.activities
        guard !activities.isEmpty else { return }
        AnalyticsService.shared.track("picks_hold_activity_ended", properties: ["reason": reason])
        Task {
            for activity in activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
        #endif
    }

    /// Foreground housekeeping. Ends a card the user can no longer act on —
    /// they subscribed, or the hold ran out while the app was away.
    public func reconcile(isPro: Bool) {
        if isPro {
            clear()
            endLiveActivity(reason: "subscribed")
            return
        }
        if let window, window.isExpired {
            endLiveActivity(reason: "expired")
        }
    }
}
