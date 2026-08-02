import Foundation
import Observation

/// Collects high-confidence product-value events and turns them into at most one
/// pending StoreKit review request.
///
/// StoreKit decides whether the system prompt actually appears and doesn't tell
/// the app whether a rating was submitted. For that reason this coordinator
/// records review *attempts* and explicit App Store review intent, never a
/// misleading `hasReviewed` flag.
@Observable
@MainActor
public final class ReviewPromptCoordinator {
    public enum Trigger: String, Equatable, Sendable {
        case generatedPicksViewed
        case systemSaved
        case contentShared
        case researchDepthReached
        case secondAgentCreated
        case createdAgentRevisited
    }

    public struct Request: Identifiable, Equatable, Sendable {
        public let id: UUID
        public let trigger: Trigger

        fileprivate init(trigger: Trigger) {
            self.id = UUID()
            self.trigger = trigger
        }
    }

    public static let shared = ReviewPromptCoordinator()

    public private(set) var pendingRequest: Request?

    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let now: () -> Date
    @ObservationIgnored private let appVersion: () -> String
    @ObservationIgnored private let sessionID: String
    @ObservationIgnored private let calendar: Calendar

    private enum Key {
        static let activeDays = "app-review.active-days"
        static let lastRecordedSession = "app-review.last-recorded-session"
        static let generationViews = "app-review.generation-views"
        static let savedSystems = "app-review.saved-systems"
        static let completedShares = "app-review.completed-shares"
        static let researchDetailViews = "app-review.research-detail-views"
        static let agentCount = "app-review.agent-count"
        static let lastCreatedAgentID = "app-review.last-created-agent-id"
        static let lastCreatedAgentSession = "app-review.last-created-agent-session"
        static let revisitedCreatedAgentID = "app-review.revisited-created-agent-id"
        static let lastAttemptVersion = "app-review.last-attempt-version"
        static let lastAttemptDate = "app-review.last-attempt-date"
        static let lastAttemptTrigger = "app-review.last-attempt-trigger"
        static let manualReviewIntent = "app-review.manual-review-intent"
    }

    private static let generatedPicksThreshold = 2
    private static let researchDetailThreshold = 3
    private static let researchActiveDayThreshold = 2
    private static let minimumAttemptInterval: TimeInterval = 120 * 24 * 60 * 60

    public init(
        defaults: UserDefaults = .standard,
        now: @escaping () -> Date = Date.init,
        appVersion: @escaping () -> String = {
            Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
                ?? "unknown"
        },
        sessionID: String = UUID().uuidString,
        calendar: Calendar = .current
    ) {
        self.defaults = defaults
        self.now = now
        self.appVersion = appVersion
        self.sessionID = sessionID
        self.calendar = calendar
    }

    /// Record foreground use once per calendar day. The research-depth fallback
    /// requires activity on two distinct days so it never interrupts a brand-new
    /// user's first browsing session.
    public func recordAppActive() {
        let today = now()
        var days = defaults.array(forKey: Key.activeDays) as? [TimeInterval] ?? []
        if !days.contains(where: { calendar.isDate(Date(timeIntervalSince1970: $0), inSameDayAs: today) }) {
            days.append(today.timeIntervalSince1970)
            defaults.set(days, forKey: Key.activeDays)
        }
        if defaults.string(forKey: Key.lastRecordedSession) != sessionID {
            defaults.set(sessionID, forKey: Key.lastRecordedSession)
        }
    }

    /// Fresh agent results become eligible after the user has viewed and closed
    /// two generated-pick reveals.
    public func recordGeneratedPicksViewed() {
        let count = increment(Key.generationViews)
        if count >= Self.generatedPicksThreshold {
            enqueueIfEligible(trigger: .generatedPicksViewed)
        }
    }

    public func recordSystemSaved() {
        _ = increment(Key.savedSystems)
        enqueueIfEligible(trigger: .systemSaved)
    }

    /// Call only after `UIActivityViewController` reports `completed == true`.
    public func recordContentShared() {
        _ = increment(Key.completedShares)
        enqueueIfEligible(trigger: .contentShared)
    }

    /// Counts exits from game, prop, and Outliers trend detail surfaces.
    public func recordResearchDetailViewed() {
        let count = increment(Key.researchDetailViews)
        guard count >= Self.researchDetailThreshold, activeDayCount >= Self.researchActiveDayThreshold else {
            return
        }
        enqueueIfEligible(trigger: .researchDepthReached)
    }

    /// The current total is supplied by AgentsView so existing agents created
    /// before this coordinator shipped still count toward the "second agent"
    /// threshold.
    public func recordAgentCreated(agentID: String, totalAgentCount: Int) {
        let trackedCount = max(increment(Key.agentCount), totalAgentCount)
        defaults.set(trackedCount, forKey: Key.agentCount)
        defaults.set(agentID, forKey: Key.lastCreatedAgentID)
        defaults.set(sessionID, forKey: Key.lastCreatedAgentSession)
        defaults.removeObject(forKey: Key.revisitedCreatedAgentID)

        if trackedCount >= 2 {
            enqueueIfEligible(trigger: .secondAgentCreated)
        }
    }

    /// Immediate navigation after creation remains in the same process session
    /// and is ignored. Opening that newly-created agent in a later app session is
    /// the return-value signal.
    public func recordAgentDetailViewed(agentID: String) {
        guard defaults.string(forKey: Key.lastCreatedAgentID) == agentID,
              defaults.string(forKey: Key.lastCreatedAgentSession) != sessionID,
              defaults.string(forKey: Key.revisitedCreatedAgentID) != agentID
        else { return }

        if enqueueIfEligible(trigger: .createdAgentRevisited) {
            defaults.set(agentID, forKey: Key.revisitedCreatedAgentID)
        }
    }

    /// A persistent Settings link is the only user-initiated review action.
    /// Opening it is the closest signal available that the user intended to
    /// review, so future automatic requests are suppressed.
    public func recordManualReviewLinkOpened() {
        defaults.set(true, forKey: Key.manualReviewIntent)
        pendingRequest = nil
    }

    /// Atomically consumes a pending request immediately before the SwiftUI host
    /// calls `RequestReviewAction`. This records an attempt even when StoreKit
    /// elects not to show its prompt.
    @discardableResult
    public func claim(_ request: Request) -> Bool {
        guard pendingRequest == request, passesGlobalEligibility() else { return false }
        defaults.set(appVersion(), forKey: Key.lastAttemptVersion)
        defaults.set(now().timeIntervalSince1970, forKey: Key.lastAttemptDate)
        defaults.set(request.trigger.rawValue, forKey: Key.lastAttemptTrigger)
        pendingRequest = nil
        return true
    }

    /// Clears a request that became unsafe to present, for example because the
    /// app resigned active during the quiet delay. The next value event can
    /// enqueue it again.
    public func cancel(_ request: Request) {
        if pendingRequest == request {
            pendingRequest = nil
        }
    }

    private var activeDayCount: Int {
        (defaults.array(forKey: Key.activeDays) as? [TimeInterval] ?? []).count
    }

    @discardableResult
    private func enqueueIfEligible(trigger: Trigger) -> Bool {
        guard pendingRequest == nil, passesGlobalEligibility() else { return false }
        pendingRequest = Request(trigger: trigger)
        return true
    }

    private func passesGlobalEligibility() -> Bool {
        guard !defaults.bool(forKey: Key.manualReviewIntent) else { return false }
        guard defaults.string(forKey: Key.lastAttemptVersion) != appVersion() else { return false }

        let lastAttempt = defaults.double(forKey: Key.lastAttemptDate)
        if lastAttempt > 0, now().timeIntervalSince1970 - lastAttempt < Self.minimumAttemptInterval {
            return false
        }
        return true
    }

    private func increment(_ key: String) -> Int {
        let next = defaults.integer(forKey: key) + 1
        defaults.set(next, forKey: key)
        return next
    }
}
