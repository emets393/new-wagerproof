import type { GamesSport } from '../../types';

/**
 * How big a disagreement has to be, per sport, before it means anything.
 *
 * The three edge charts are all "threshold vs model, gap highlighted", but the
 * gap's UNITS differ wildly: an NFL total moves in points around 45, an MLB
 * total in runs around 8.5, an NBA total in points around 230. One set of
 * thresholds across all five makes MLB read STRONG OVER on every game and NBA
 * read NO EDGE on every game — confidently wrong rather than obviously broken,
 * which is the kind of bug review doesn't catch.
 *
 * ## Where these numbers come from
 * Wherever the product already had a calibration, it is reused rather than
 * re-invented:
 * - **NFL / CFB totals** — the `EDGE_MODERATE` / `EDGE_LARGE` / `EDGE_BAR_CAP`
 *   constants the college cards used (3 / 7 / 10), the same gaps
 *   `edgeExplanations.ts` calls moderate and large.
 * - **MLB totals** — `OU_BUCKETS` in `sections/mlb/shared.tsx` (1.5 / 1.0 / 0.5).
 * - **MLB moneyline** — `ML_BUCKETS` (7 / 4 / 2 percentage points).
 * - **NBA / NCAAB** — ESTIMATES. Both were offseason when this shipped, so no
 *   distribution check was possible. Verify against a real slate before
 *   trusting the zone labels.
 *
 * Mirrors `WagerproofDesign/Components/EdgeScale.swift` — keep the two in step.
 */
export interface EdgeScale {
  /** Gap at which a total stops being noise and becomes a lean. */
  totalLean: number;
  /** Gap at which a total's lean becomes strong. */
  totalStrong: number;
  /** Gap at which the totals rail pins. */
  totalCap: number;

  /**
   * Margin points visible either side of a tie on the spread bar. Too small and
   * every marker pins; too large and every game clusters at the centre.
   */
  spreadWindow: number;
  /**
   * Labelled gradations on the spread axis, mirrored either side of the tie.
   * Sport-meaningful numbers rather than a uniform grid — 3 is a field goal, 7 a
   * touchdown; 1.5 is the MLB run line.
   */
  spreadTicks: number[];

  /** Moneyline edges are in PERCENTAGE POINTS of win probability, not points. */
  moneylineLean: number;
  moneylineStrong: number;
  moneylineCap: number;
}

/** Verified against a real NFL slate: 16 picks, median |gap| 3.15, p75 7.5. */
export const NFL_EDGE_SCALE: EdgeScale = {
  totalLean: 3,
  totalStrong: 7,
  totalCap: 10,
  spreadWindow: 14,
  spreadTicks: [3, 7, 10],
  moneylineLean: 3,
  moneylineStrong: 8,
  moneylineCap: 20,
};

/**
 * Same point scale as the NFL — college totals sit a little higher and blow out
 * further, so the spread axis is wider and its outer tick is two touchdowns.
 */
export const CFB_EDGE_SCALE: EdgeScale = {
  totalLean: 3,
  totalStrong: 7,
  totalCap: 10,
  spreadWindow: 21,
  spreadTicks: [3, 7, 14],
  moneylineLean: 3,
  moneylineStrong: 8,
  moneylineCap: 20,
};

/** ESTIMATE — needs a distribution check on a live slate. */
export const NBA_EDGE_SCALE: EdgeScale = {
  totalLean: 4,
  totalStrong: 9,
  totalCap: 14,
  spreadWindow: 20,
  spreadTicks: [5, 10, 15],
  moneylineLean: 3,
  moneylineStrong: 8,
  moneylineCap: 20,
};

/** ESTIMATE — needs a distribution check on a live slate. */
export const NCAAB_EDGE_SCALE: EdgeScale = {
  totalLean: 3.5,
  totalStrong: 8,
  totalCap: 12,
  spreadWindow: 20,
  spreadTicks: [5, 10, 15],
  moneylineLean: 3,
  moneylineStrong: 8,
  moneylineCap: 20,
};

/**
 * Runs, not points — an order of magnitude tighter than every other sport.
 * Getting this wrong is the single most likely way to ship a broken chart.
 */
export const MLB_EDGE_SCALE: EdgeScale = {
  totalLean: 0.5,
  totalStrong: 1.0,
  totalCap: 2.0,
  spreadWindow: 6,
  spreadTicks: [1, 2, 3],
  moneylineLean: 2,
  moneylineStrong: 7,
  moneylineCap: 12,
};

export const EDGE_SCALES: Record<GamesSport, EdgeScale> = {
  nfl: NFL_EDGE_SCALE,
  cfb: CFB_EDGE_SCALE,
  nba: NBA_EDGE_SCALE,
  ncaab: NCAAB_EDGE_SCALE,
  mlb: MLB_EDGE_SCALE,
};
