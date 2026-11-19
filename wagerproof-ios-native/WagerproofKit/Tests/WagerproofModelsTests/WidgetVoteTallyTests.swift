import XCTest
@testable import WagerproofModels

/// `get_widget_votes` / `cast_widget_vote` row decoding plus the optimistic
/// arithmetic every vote tap runs through. See .claude/docs/34_widget_votes_share.md.
final class WidgetVoteTallyTests: XCTestCase {

    func testDecodesSnakeCaseRow() throws {
        let json = #"[{"widget_key":"moneyline_prediction","upvotes":12,"downvotes":3,"my_vote":-1}]"#
        let rows = try JSONDecoder().decode([WidgetVoteTally].self, from: Data(json.utf8))
        XCTAssertEqual(rows, [WidgetVoteTally(widgetKey: "moneyline_prediction", upvotes: 12, downvotes: 3, myVote: -1)])
        XCTAssertEqual(rows.first?.score, 9)
    }

    func testEvenSplitHasVotesButScoresZero() {
        // "Vote" placeholder is for untouched widgets only; 5/5 must show 0.
        XCTAssertTrue(WidgetVoteTally(widgetKey: "k", upvotes: 5, downvotes: 5).hasVotes)
        XCTAssertEqual(WidgetVoteTally(widgetKey: "k", upvotes: 5, downvotes: 5).score, 0)
        XCTAssertFalse(WidgetVoteTally(widgetKey: "k").hasVotes)
    }

    func testTappingActiveArrowClearsAndOtherArrowSwitches() {
        XCTAssertEqual(WidgetVoteTally.resolvedVote(current: 0, tapped: 1), 1)
        XCTAssertEqual(WidgetVoteTally.resolvedVote(current: 1, tapped: 1), 0)
        XCTAssertEqual(WidgetVoteTally.resolvedVote(current: 1, tapped: -1), -1)
        XCTAssertEqual(WidgetVoteTally.resolvedVote(current: -1, tapped: -1), 0)
    }

    func testApplyingMovesOnlyTheUsersOwnVote() {
        let base = WidgetVoteTally(widgetKey: "k", upvotes: 10, downvotes: 4, myVote: 0)
        let up = base.applying(vote: 1)
        XCTAssertEqual([up.upvotes, up.downvotes, up.myVote], [11, 4, 1])
        let switched = up.applying(vote: -1)
        XCTAssertEqual([switched.upvotes, switched.downvotes, switched.myVote], [10, 5, -1])
        XCTAssertEqual(switched.applying(vote: 0), base)
        XCTAssertEqual(up.applying(vote: 1), up)
    }

    func testApplyingNeverGoesNegativeOnStaleCounts() {
        // Local state says "I upvoted" but the cached count is already 0.
        let stale = WidgetVoteTally(widgetKey: "k", upvotes: 0, downvotes: 0, myVote: 1)
        XCTAssertEqual(stale.applying(vote: 0).upvotes, 0)
    }
}
