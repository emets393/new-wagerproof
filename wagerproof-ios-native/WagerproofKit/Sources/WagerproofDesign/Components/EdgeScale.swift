import Foundation

/// How big a disagreement has to be, per sport, before it means anything.
///
/// The edge charts are all "threshold vs model, gap highlighted", but the gap's
/// UNITS differ wildly: an NFL total moves in points around 45, an MLB total in
/// runs around 8.5, an NBA total in points around 230. One set of thresholds
/// across all five makes MLB read `STRONG OVER` on every game and NBA read
/// `NO EDGE` on every game — confidently wrong rather than obviously broken,
/// which is the kind of bug review doesn't catch.
///
/// ## Where these numbers come from
/// Wherever the product already had a calibration, it's reused rather than
/// re-invented:
/// - **NFL / CFB totals** — `EDGE_MODERATE` / `EDGE_LARGE` / `EDGE_BAR_CAP` in
///   `src/features/games/detail/sections/cfb/shared.tsx`. Independently checked
///   against a real NFL slate: 16 total picks, median |gap| 3.15, p75 7.5 — so
///   3/7 splits the slate into roughly half no-edge, quarter lean, quarter
///   strong.
/// - **MLB totals** — `OU_BUCKETS` in `sections/mlb/shared.tsx` (`1.5 / 1.0 / 0.5`).
/// - **MLB moneyline** — `ML_BUCKETS` (`7 / 4 / 2` percentage points).
/// - **NBA / NCAAB** — ESTIMATES. Both are offseason, so no distribution check
///   was possible. Verify against a real slate before trusting the zone labels.
public struct EdgeScale: Sendable, Equatable {
    /// Gap at which a total stops being noise and becomes a lean.
    public let totalLean: Double
    /// Gap at which a total's lean becomes strong.
    public let totalStrong: Double
    /// Gap at which the totals rail pins.
    public let totalCap: Double

    /// Margin points visible either side of a tie on the spread bar. Too small
    /// and every marker pins; too large and every game clusters at the centre.
    public let spreadWindow: Double

    /// Moneyline edges are in PERCENTAGE POINTS of win probability, not points.
    public let moneylineLean: Double
    public let moneylineStrong: Double
    public let moneylineCap: Double

    public init(
        totalLean: Double,
        totalStrong: Double,
        totalCap: Double,
        spreadWindow: Double,
        moneylineLean: Double,
        moneylineStrong: Double,
        moneylineCap: Double
    ) {
        self.totalLean = totalLean
        self.totalStrong = totalStrong
        self.totalCap = totalCap
        self.spreadWindow = spreadWindow
        self.moneylineLean = moneylineLean
        self.moneylineStrong = moneylineStrong
        self.moneylineCap = moneylineCap
    }

    /// Verified against a real slate. See the type doc.
    public static let nfl = EdgeScale(
        totalLean: 3, totalStrong: 7, totalCap: 10,
        spreadWindow: 14,
        moneylineLean: 3, moneylineStrong: 8, moneylineCap: 20
    )

    /// Same point scale as the NFL — college totals sit a little higher and
    /// blow out further, so the spread axis is wider.
    public static let cfb = EdgeScale(
        totalLean: 3, totalStrong: 7, totalCap: 10,
        spreadWindow: 21,
        moneylineLean: 3, moneylineStrong: 8, moneylineCap: 20
    )

    /// ESTIMATE — needs a distribution check on a live slate.
    public static let nba = EdgeScale(
        totalLean: 4, totalStrong: 9, totalCap: 14,
        spreadWindow: 20,
        moneylineLean: 3, moneylineStrong: 8, moneylineCap: 20
    )

    /// ESTIMATE — needs a distribution check on a live slate.
    public static let ncaab = EdgeScale(
        totalLean: 3.5, totalStrong: 8, totalCap: 12,
        spreadWindow: 20,
        moneylineLean: 3, moneylineStrong: 8, moneylineCap: 20
    )

    /// Runs, not points — an order of magnitude tighter than every other sport.
    /// Getting this wrong is the single most likely way to ship a broken chart.
    ///
    /// Measured on a 15-game slate: full-game total gaps split 33/33/33 across
    /// no-edge / lean / strong, which is the shape we want.
    public static let mlb = EdgeScale(
        totalLean: 0.5, totalStrong: 1.0, totalCap: 2.0,
        spreadWindow: 6,
        moneylineLean: 2, moneylineStrong: 7, moneylineCap: 12
    )

    /// First five innings — HALF a game, so the gaps are roughly half the size.
    ///
    /// On the same slate, F5 total gaps topped out at 0.88 runs (median 0.48).
    /// Against `mlb`'s `totalStrong: 1.0` an F5 total could therefore NEVER read
    /// "strong" — the top zone was unreachable by construction, which is exactly
    /// the silent miscalibration this type exists to prevent.
    ///
    /// Lean sits at the observed median so about half a slate reads "no edge";
    /// strong and cap are inferred from the observed max rather than a full
    /// distribution, so re-check these against a live slate.
    public static let mlbFirstFive = EdgeScale(
        totalLean: 0.5, totalStrong: 0.7, totalCap: 1.0,
        spreadWindow: 4,
        moneylineLean: 2, moneylineStrong: 7, moneylineCap: 12
    )
}
