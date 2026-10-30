import XCTest
@testable import WagerproofModels

final class SignalRoiTests: XCTestCase {
    func testReadsASignedRoi() {
        XCTAssertEqual(SignalRoi.percent(in: "+52.7% ROI")!, 52.7, accuracy: 1e-9)
        XCTAssertEqual(SignalRoi.percent(in: "-52.3% ROI")!, -52.3, accuracy: 1e-9)
        XCTAssertEqual(SignalRoi.percent(in: "3-1 (75.0%) in 2026-27, +43.2% ROI")!, 43.2, accuracy: 1e-9)
    }

    func testAveragesARoiRange() {
        XCTAssertEqual(SignalRoi.percent(in: "+11-16% ROI")!, 13.5, accuracy: 1e-9)
        XCTAssertEqual(SignalRoi.percent(in: "58-61% / +11-16% ROI")!, 13.5, accuracy: 1e-9)
        XCTAssertEqual(SignalRoi.percent(in: "+5–9% ROI")!, 7, accuracy: 1e-9)
    }

    func testIgnoresAHitRateThatIsNotRoi() {
        XCTAssertNil(SignalRoi.percent(in: "190-134 (58.7%) at the closing line"))
        XCTAssertNil(SignalRoi.percent(in: "no graded bets yet in 2026-27"))
        XCTAssertNil(SignalRoi.percent(in: nil))
    }

    func testSeasonFractionBeatsProse() {
        let rating = GameListSort.rating(
            seasonRoiFraction: 0.1932,
            seasonSample: 8,
            seasonText: "+99% ROI",
            backtestText: "+1% ROI"
        )
        XCTAssertEqual(rating!, 19.32, accuracy: 1e-9)
    }

    func testFallsThroughToBacktestWhenTheSeasonIsUngraded() {
        let rating = GameListSort.rating(
            seasonRoiFraction: nil,
            seasonSample: 0,
            seasonText: "no graded bets yet",
            backtestText: "58-61% / +11-16% ROI"
        )
        XCTAssertEqual(rating!, 13.5, accuracy: 1e-9)
    }

    func testMissingEdgesSortAfterRealOnes() {
        XCTAssertTrue(GameListSort.higherFirst(2, nil, tie: { false }))
        XCTAssertFalse(GameListSort.higherFirst(nil, 2, tie: { true }))
        XCTAssertTrue(GameListSort.higherFirst(nil, nil, tie: { true }))
    }

    func testUnratedSignalsKeepTimeWhenTheBoardHasNone() {
        let empty = SignalBoardRank.empty
        XCTAssertTrue(GameListSort.signalsFirst(empty, empty, anyRated: false, tie: { true }))
        XCTAssertFalse(GameListSort.signalsFirst(empty, empty, anyRated: false, tie: { false }))
    }

    func testBestRoiOutranksALargerCount() {
        let hot = SignalBoardRank(bestRoi: 40, count: 1)
        let crowded = SignalBoardRank(bestRoi: 5, count: 6)
        XCTAssertTrue(GameListSort.signalsFirst(hot, crowded, anyRated: true, tie: { false }))
    }
}
