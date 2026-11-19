import Foundation

/// Vote totals for one game-detail widget, plus the signed-in user's own vote.
///
/// Rows come from the `get_widget_votes` / `cast_widget_vote` RPCs on **MAIN**
/// Supabase. Only aggregates ever leave the database — there is no way to learn
/// who else voted. Contract: `.claude/docs/34_widget_votes_share.md`.
public struct WidgetVoteTally: Decodable, Sendable, Hashable {
    /// Stable snake_case widget id (`moneyline_prediction`). Never the title.
    public let widgetKey: String
    public let upvotes: Int
    public let downvotes: Int
    /// -1, 0 or 1. The server stores a retracted vote as 0, which a client
    /// treats exactly like "never voted".
    public let myVote: Int

    public init(widgetKey: String, upvotes: Int = 0, downvotes: Int = 0, myVote: Int = 0) {
        self.widgetKey = widgetKey
        self.upvotes = upvotes
        self.downvotes = downvotes
        self.myVote = myVote
    }

    enum CodingKeys: String, CodingKey {
        case widgetKey = "widget_key"
        case upvotes, downvotes
        case myVote = "my_vote"
    }

    /// Reddit-style net score.
    public var score: Int { upvotes - downvotes }

    /// False only when NOBODY has a live vote. A 5-up / 5-down widget has votes
    /// and shows "0"; an untouched one shows "Vote" instead.
    public var hasVotes: Bool { upvotes + downvotes > 0 }

    /// What a tap on an arrow means given the current vote: tapping the active
    /// arrow clears it, tapping the other one switches.
    public static func resolvedVote(current: Int, tapped: Int) -> Int {
        current == tapped ? 0 : tapped
    }

    /// The tally as it will look once `newVote` lands — the optimistic state.
    /// Moves only this user's own contribution, clamped at zero so a stale
    /// local count can never render a negative total.
    public func applying(vote newVote: Int) -> WidgetVoteTally {
        var up = upvotes
        var down = downvotes
        if myVote == 1 { up -= 1 } else if myVote == -1 { down -= 1 }
        if newVote == 1 { up += 1 } else if newVote == -1 { down += 1 }
        return WidgetVoteTally(
            widgetKey: widgetKey,
            upvotes: max(0, up),
            downvotes: max(0, down),
            myVote: newVote
        )
    }
}
