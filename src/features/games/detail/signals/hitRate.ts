/**
 * Signal hit-rate maths, shared by the pill row and the backtest chart.
 *
 * Port of `Wagerproof/Features/GameWidgets/SignalBacktestChart.swift`
 * (`SignalHitRateParser` + the meter's window). Keep the two in step — the same
 * `signal_defs.typical_hit` string has to produce the same percentage on web,
 * iOS and Android, or the same signal reads as a winner on one platform and a
 * loser on another.
 */

/** -110 both ways. A signal below this loses money even "winning". */
export const BREAK_EVEN_RATE = 0.524;

const NUM = '([0-9]+(?:\\.[0-9]+)?)';

/**
 * Percentage pulled out of a free-text `typical_hit`, as a 0–1 fraction.
 *
 * The column is prose written by hand — real values include `58%`, `57-60%`,
 * and `~61% vs open wk1 (2024-25, n=83 — tracking)`.
 *
 * Only digits carrying a `%` count. A naive scrape that averaged the first two
 * numbers whenever it saw a dash read that last example as the range 61–1 and
 * rendered a 61% signal as **31%** — a winner shown as a loser. Seasons, sample
 * sizes and years all look like hit rates, so `%` is the only safe anchor.
 * Returns null when there is nothing to chart; callers print the raw string.
 */
export function parseHitRate(raw: string | null | undefined): number | null {
  if (!raw) return null;

  // A true range must END in the percent sign: "57-60%". `2024-25,` fails
  // because a comma follows, not a `%`.
  const range = raw.match(new RegExp(`${NUM}\\s*[-–—]\\s*${NUM}\\s*%`));
  if (range) {
    return clampPercent((Number(range[1]) + Number(range[2])) / 2);
  }

  const single = raw.match(new RegExp(`${NUM}\\s*%`));
  if (single) return clampPercent(Number(single[1]));

  return null;
}

function clampPercent(percent: number): number | null {
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return null;
  return percent / 100;
}

/**
 * The meter's axis. Signals live in a narrow band around the vig, so a 0–100%
 * axis puts a 58% and a 52% signal on top of each other. The window widens when
 * a value falls outside it, so nothing is clamped onto an edge and misread.
 */
export function hitRateWindow(rate: number): { lower: number; upper: number } {
  return { lower: Math.min(0.35, rate - 0.04), upper: Math.max(0.7, rate + 0.04) };
}

/** Position of `value` on the axis, 0–1. */
export function hitRateFraction(value: number, window: { lower: number; upper: number }): number {
  const span = window.upper - window.lower;
  if (span <= 0) return 0;
  return Math.min(Math.max((value - window.lower) / span, 0), 1);
}
