package com.wagerproof.core.design.components

/**
 * How big a disagreement has to be, per sport, before it means anything.
 *
 * Port of iOS `WagerproofDesign/Components/EdgeScale.swift`. The edge charts
 * are all "threshold vs model, gap highlighted", but the gap's UNITS differ
 * wildly: an NFL total moves in points around 45, an MLB total in runs around
 * 8.5, an NBA total in points around 230. One set of thresholds across all
 * five makes MLB read `STRONG OVER` on every game and NBA read `NO EDGE` on
 * every game — confidently wrong rather than obviously broken, which is the
 * kind of bug review doesn't catch.
 *
 * Where these numbers come from — reused, not re-invented, wherever the
 * product already had a calibration:
 * - NFL/CFB totals: `EDGE_MODERATE` / `EDGE_LARGE` / `EDGE_BAR_CAP` on web,
 *   checked against a real NFL slate (16 total picks, median |gap| 3.15, p75 7.5).
 * - MLB totals: `OU_BUCKETS` (1.5 / 1.0 / 0.5). MLB moneyline: `ML_BUCKETS` (7 / 4 / 2).
 * - NBA / NCAAB: ESTIMATES — both offseason at authoring time, unverified against
 *   a live slate.
 */
data class EdgeScale(
    /** Gap at which a total stops being noise and becomes a lean. */
    val totalLean: Double,
    /** Gap at which a total's lean becomes strong. */
    val totalStrong: Double,
    /** Gap at which the totals rail pins. */
    val totalCap: Double,

    /**
     * Margin points visible either side of a tie on the spread bar. Too small
     * and every marker pins; too large and every game clusters at the centre.
     */
    val spreadWindow: Double,

    /** Moneyline edges are in PERCENTAGE POINTS of win probability, not points. */
    val moneylineLean: Double,
    val moneylineStrong: Double,
    val moneylineCap: Double,
) {
    companion object {
        /** Verified against a real slate. See the type doc. */
        val nfl = EdgeScale(
            totalLean = 3.0, totalStrong = 7.0, totalCap = 10.0,
            spreadWindow = 14.0,
            moneylineLean = 3.0, moneylineStrong = 8.0, moneylineCap = 20.0,
        )

        /**
         * Same point scale as the NFL — college totals sit a little higher and
         * blow out further, so the spread axis is wider.
         */
        val cfb = EdgeScale(
            totalLean = 3.0, totalStrong = 7.0, totalCap = 10.0,
            spreadWindow = 21.0,
            moneylineLean = 3.0, moneylineStrong = 8.0, moneylineCap = 20.0,
        )

        /** ESTIMATE — needs a distribution check on a live slate. */
        val nba = EdgeScale(
            totalLean = 4.0, totalStrong = 9.0, totalCap = 14.0,
            spreadWindow = 20.0,
            moneylineLean = 3.0, moneylineStrong = 8.0, moneylineCap = 20.0,
        )

        /** ESTIMATE — needs a distribution check on a live slate. */
        val ncaab = EdgeScale(
            totalLean = 3.5, totalStrong = 8.0, totalCap = 12.0,
            spreadWindow = 20.0,
            moneylineLean = 3.0, moneylineStrong = 8.0, moneylineCap = 20.0,
        )

        /**
         * Runs, not points — an order of magnitude tighter than every other
         * sport. Getting this wrong is the single most likely way to ship a
         * broken chart.
         */
        val mlb = EdgeScale(
            totalLean = 0.5, totalStrong = 1.0, totalCap = 2.0,
            spreadWindow = 6.0,
            moneylineLean = 2.0, moneylineStrong = 7.0, moneylineCap = 12.0,
        )
    }
}
