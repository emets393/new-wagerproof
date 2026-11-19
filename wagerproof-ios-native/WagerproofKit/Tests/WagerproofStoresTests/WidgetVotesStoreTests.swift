import XCTest
import WagerproofModels
import WagerproofServices
@testable import WagerproofStores

/// Write-ordering and rollback rules for widget votes — the part of the feature
/// that is easy to get subtly wrong and impossible to see in a quick manual
/// test. See .claude/docs/34_widget_votes_share.md §4.
final class WidgetVotesStoreTests: XCTestCase {

    /// Stand-in for the two RPCs: records every cast and applies it to an
    /// in-memory tally the way the server would.
    private actor FakeServer {
        var casts: [Int] = []
        var tally = WidgetVoteTally(widgetKey: "moneyline_prediction", upvotes: 4, downvotes: 1, myVote: 0)
        var failure: WidgetVoteError?
        var delay: Duration = .zero

        func setFailure(_ error: WidgetVoteError?) { failure = error }
        func setDelay(_ value: Duration) { delay = value }

        func fetch() -> [String: WidgetVoteTally]? { [tally.widgetKey: tally] }

        func cast(_ vote: Int) async -> Result<WidgetVoteTally, WidgetVoteError> {
            casts.append(vote)
            try? await Task.sleep(for: delay)
            if let failure { return .failure(failure) }
            tally = tally.applying(vote: vote)
            return .success(tally)
        }
    }

    private let game = WidgetVotesStore.GameKey(sport: "nfl", gameId: "2026_11_NO_CHI")
    private let key = "moneyline_prediction"

    @MainActor
    private func makeStore(_ server: FakeServer) async -> WidgetVotesStore {
        let store = WidgetVotesStore(
            fetch: { _, _ in await server.fetch() },
            cast: { _, _, _, vote in await server.cast(vote) }
        )
        store.setUser("user-1")
        await store.ensureLoaded(game)
        return store
    }

    /// Lets queued main-actor work (the drain task and its awaits) finish.
    @MainActor
    private func settle() async {
        try? await Task.sleep(for: .milliseconds(250))
    }

    @MainActor
    func testTapIsOptimisticThenAdoptsServerCounts() async {
        let server = FakeServer()
        let store = await makeStore(server)
        XCTAssertEqual(store.tally(for: game, widgetKey: key).score, 3)

        store.tap(1, game: game, widgetKey: key)
        XCTAssertEqual(store.tally(for: game, widgetKey: key).myVote, 1)
        XCTAssertEqual(store.tally(for: game, widgetKey: key).upvotes, 5)

        await settle()
        let casts = await server.casts
        XCTAssertEqual(casts, [1])
        XCTAssertEqual(store.tally(for: game, widgetKey: key), WidgetVoteTally(widgetKey: key, upvotes: 5, downvotes: 1, myVote: 1))
    }

    @MainActor
    func testRapidTapsSendOneRequestAtATimeAndOnlyTheLatestIntent() async {
        let server = FakeServer()
        await server.setDelay(.milliseconds(60))
        let store = await makeStore(server)

        store.tap(1, game: game, widgetKey: key)   // up        (sent)
        store.tap(1, game: game, widgetKey: key)   // clear     (queued)
        store.tap(-1, game: game, widgetKey: key)  // down      (replaces the queued clear)
        XCTAssertEqual(store.tally(for: game, widgetKey: key).myVote, -1)

        await settle()
        let casts = await server.casts
        XCTAssertEqual(casts, [1, -1], "the intermediate clear must never reach the server")
        XCTAssertEqual(store.tally(for: game, widgetKey: key), WidgetVoteTally(widgetKey: key, upvotes: 4, downvotes: 2, myVote: -1))
    }

    @MainActor
    func testUpThenClearBeforeSendEndsWhereItStarted() async {
        let server = FakeServer()
        await server.setDelay(.milliseconds(60))
        let store = await makeStore(server)

        store.tap(1, game: game, widgetKey: key)
        store.tap(1, game: game, widgetKey: key)
        await settle()

        let casts = await server.casts
        XCTAssertEqual(casts, [1, 0])
        XCTAssertEqual(store.tally(for: game, widgetKey: key), WidgetVoteTally(widgetKey: key, upvotes: 4, downvotes: 1, myVote: 0))
    }

    @MainActor
    func testFailureRollsBackToLastServerState() async {
        let server = FakeServer()
        let store = await makeStore(server)
        await server.setFailure(.failed)

        store.tap(-1, game: game, widgetKey: key)
        XCTAssertEqual(store.tally(for: game, widgetKey: key).myVote, -1)
        await settle()

        XCTAssertEqual(store.tally(for: game, widgetKey: key), WidgetVoteTally(widgetKey: key, upvotes: 4, downvotes: 1, myVote: 0))
        XCTAssertEqual(store.rateLimitTick, 0)
    }

    @MainActor
    func testRateLimitRollsBackAndSignalsTheUI() async {
        let server = FakeServer()
        let store = await makeStore(server)
        await server.setFailure(.rateLimited)

        store.tap(1, game: game, widgetKey: key)
        await settle()

        XCTAssertEqual(store.tally(for: game, widgetKey: key).myVote, 0)
        XCTAssertEqual(store.rateLimitTick, 1)
    }

    @MainActor
    func testSignedOutTapDoesNothing() async {
        let server = FakeServer()
        let store = await makeStore(server)
        store.setUser(nil)

        store.tap(1, game: game, widgetKey: key)
        await settle()

        let casts = await server.casts
        XCTAssertEqual(casts, [])
        XCTAssertEqual(store.tally(for: game, widgetKey: key).myVote, 0)
    }

    @MainActor
    func testSwitchingUserDropsThePreviousUsersVotes() async {
        let server = FakeServer()
        let store = await makeStore(server)
        store.tap(1, game: game, widgetKey: key)
        await settle()
        XCTAssertEqual(store.tally(for: game, widgetKey: key).myVote, 1)

        store.setUser("user-2")
        // Nothing cached may survive: `myVote` belonged to user-1.
        XCTAssertEqual(store.tally(for: game, widgetKey: key), WidgetVoteTally(widgetKey: key))
    }
}
