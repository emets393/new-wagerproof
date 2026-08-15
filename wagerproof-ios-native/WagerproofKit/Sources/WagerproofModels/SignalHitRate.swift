import Foundation

/// Signal hit-rate maths, shared by the pill row and the backtest chart.
///
/// Lives in `WagerproofModels` rather than beside the SwiftUI view so it is
/// covered by host-runnable tests — `WagerproofDesign` imports UIKit and can
/// only be tested on a simulator.
///
/// Cross-platform siblings — keep all three in step, because the same
/// `signal_defs.typical_hit` string has to produce the same percentage
/// everywhere or a signal reads as a winner on one platform and a loser on
/// another:
///   web     `src/features/games/detail/signals/hitRate.ts`
///   Android `core/design/components/SignalBacktestChart.kt` (`SignalHitRate`)
public enum SignalHitRate {

    /// -110 both ways. A signal below this loses money even "winning".
    public static let breakEvenRate = 0.524

    private static let number = "([0-9]+(?:\\.[0-9]+)?)"

    /// Percentage pulled out of a free-text `typical_hit`, as a 0–1 fraction.
    ///
    /// The column is prose written by hand — real values include `58%`,
    /// `57-60%`, and `~61% vs open wk1 (2024-25, n=83 — tracking)`.
    ///
    /// Only digits carrying a `%` count. A first cut scraped every number in the
    /// string and averaged the first two when it saw a dash, which read that
    /// last example as the range 61–1 and rendered a 61% signal as **31%** — a
    /// winner shown as a loser. Seasons, sample sizes and years all look like
    /// hit rates to a naive scrape, so the `%` is the only safe anchor.
    /// Returns nil when there is nothing to chart; callers print the raw string.
    public static func fraction(_ raw: String?) -> Double? {
        guard let raw, !raw.isEmpty else { return nil }

        // A true range has to END in the percent sign: "57-60%". `2024-25,`
        // fails this because a comma follows, not a `%`.
        if let range = match(raw, "\(number)\\s*[-–—]\\s*\(number)\\s*%"), range.count == 2 {
            return clamp((range[0] + range[1]) / 2)
        }
        if let single = match(raw, "\(number)\\s*%"), let value = single.first {
            return clamp(value)
        }
        return nil
    }

    /// The meter's axis. Signals live in a narrow band around the vig, so a
    /// 0–100% axis puts a 58% and a 52% signal on top of each other. The window
    /// widens when a value falls outside it, so nothing is clamped onto an edge
    /// and misreported.
    public static func window(for rate: Double) -> (lower: Double, upper: Double) {
        (lower: min(0.35, rate - 0.04), upper: max(0.70, rate + 0.04))
    }

    /// Position of `value` on the axis, 0–1.
    public static func position(_ value: Double, in window: (lower: Double, upper: Double)) -> Double {
        let span = window.upper - window.lower
        guard span > 0 else { return 0 }
        return min(max((value - window.lower) / span, 0), 1)
    }

    /// Capture groups of the first match, as Doubles.
    private static func match(_ text: String, _ pattern: String) -> [Double]? {
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let hit = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text))
        else { return nil }

        return (1..<hit.numberOfRanges).compactMap { index in
            guard let range = Range(hit.range(at: index), in: text) else { return nil }
            return Double(text[range])
        }
    }

    /// Percent points in, fraction out. Anything outside 0–100 is not a hit rate.
    private static func clamp(_ percent: Double) -> Double? {
        guard percent > 0, percent <= 100 else { return nil }
        return percent / 100
    }
}
