import XCTest
@testable import WagerproofModels

/// `typical_hit` is hand-written prose, so the parser is the piece most likely
/// to silently misreport a signal. Keep these cases in step with `parseHitRate`
/// on web (`signals/signals.test.ts`) and `SignalHitRate` on Android
/// (`SignalHitRateTest.kt`) — the same string must produce the same percentage
/// on all three platforms.
final class SignalHitRateTests: XCTestCase {

    func testReadsAPlainPercentage() {
        XCTAssertEqual(SignalHitRate.fraction("58%")!, 0.58, accuracy: 1e-9)
        XCTAssertEqual(SignalHitRate.fraction("58.5%")!, 0.585, accuracy: 1e-9)
    }

    func testAveragesATrueRange() {
        XCTAssertEqual(SignalHitRate.fraction("57-60%")!, 0.585, accuracy: 1e-9)
        XCTAssertEqual(SignalHitRate.fraction("57 – 60 %")!, 0.585, accuracy: 1e-9)
    }

    func testIgnoresYearsAndSampleSizes() {
        // The regression this exists for: a naive scrape averaged 61 and 1 out
        // of the trailing "(2024-25, n=83)" and rendered a 61% signal as 31%.
        XCTAssertEqual(
            SignalHitRate.fraction("~61% vs open wk1 (2024-25, n=83 — tracking)")!,
            0.61,
            accuracy: 1e-9
        )
        XCTAssertEqual(SignalHitRate.fraction("54% ATS since 2019, n=412")!, 0.54, accuracy: 1e-9)
    }

    func testTakesARealRangeEvenWhenOtherNumbersFollow() {
        XCTAssertEqual(SignalHitRate.fraction("57-61% of openers (2022 sample)")!, 0.59, accuracy: 1e-9)
    }

    func testReturnsNilWhenThereIsNoPercentage() {
        XCTAssertNil(SignalHitRate.fraction("tracking only"))
        XCTAssertNil(SignalHitRate.fraction(""))
        XCTAssertNil(SignalHitRate.fraction(nil))
    }

    func testRejectsOutOfRangeValues() {
        XCTAssertNil(SignalHitRate.fraction("180%"))
        XCTAssertNil(SignalHitRate.fraction("0%"))
    }

    func testKeepsTheDefaultBandForOrdinaryRates() {
        let window = SignalHitRate.window(for: 0.58)
        XCTAssertEqual(window.lower, 0.35, accuracy: 1e-9)
        XCTAssertEqual(window.upper, 0.70, accuracy: 1e-9)
    }

    func testWidensRatherThanClampingAnExtremeRate() {
        XCTAssertEqual(SignalHitRate.window(for: 0.31).lower, 0.27, accuracy: 1e-9)
        XCTAssertEqual(SignalHitRate.window(for: 0.82).upper, 0.86, accuracy: 1e-9)
    }

    func testLeavesEveryValueStrictlyInsideTheAxis() {
        for rate in [0.05, 0.31, 0.524, 0.61, 0.95] {
            let f = SignalHitRate.position(rate, in: SignalHitRate.window(for: rate))
            XCTAssertGreaterThan(f, 0, "rate \(rate) pinned to the left edge")
            XCTAssertLessThan(f, 1, "rate \(rate) pinned to the right edge")
        }
    }

    func testBreakEvenSitsOnTheCorrectSideOfTheMarker() {
        let win = SignalHitRate.window(for: 0.61)
        XCTAssertLessThan(
            SignalHitRate.position(SignalHitRate.breakEvenRate, in: win),
            SignalHitRate.position(0.61, in: win)
        )

        let lose = SignalHitRate.window(for: 0.44)
        XCTAssertGreaterThan(
            SignalHitRate.position(SignalHitRate.breakEvenRate, in: lose),
            SignalHitRate.position(0.44, in: lose)
        )
    }
}
