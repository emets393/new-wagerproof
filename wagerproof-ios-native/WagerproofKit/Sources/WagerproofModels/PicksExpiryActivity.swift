import Foundation

#if canImport(ActivityKit)
import ActivityKit

/// Live Activity contract for the 3-hour hold WagerProof puts on a new user's
/// first agent picks when they leave the paywall without subscribing.
///
/// Lives in Models — not in the app or the widget — because ActivityKit
/// matches a running activity to its renderer by the ATTRIBUTES TYPE, and both
/// processes must compile the exact same declaration. A duplicated local copy
/// in either target compiles fine and then silently never renders.
///
/// The clock is deliberately NOT part of the state: `startedAt`/`expiresAt`
/// feed the widget's `Text(timerInterval:)` and `ProgressView(timerInterval:)`,
/// which tick on their own. That means zero activity updates — no push
/// channel, no background runtime, no budget spend for a countdown.
///
/// See .claude/docs/19_picks_expiry_hold.md
public struct PicksExpiryAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var startedAt: Date
        public var expiresAt: Date

        public init(startedAt: Date, expiresAt: Date) {
            self.startedAt = startedAt
            self.expiresAt = expiresAt
        }
    }

    /// The agent that produced the held picks, e.g. "Cash Machine".
    public var agentName: String
    /// How many picks are on hold — drives "3 picks locked".
    public var pickCount: Int

    public init(agentName: String, pickCount: Int) {
        self.agentName = agentName
        self.pickCount = pickCount
    }
}
#endif
