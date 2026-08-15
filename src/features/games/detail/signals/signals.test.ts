import { describe, expect, it } from 'vitest';
import { BREAK_EVEN_RATE, hitRateFraction, hitRateWindow, parseHitRate } from './hitRate';

/**
 * `typical_hit` is hand-written prose, so the parser is the piece most likely to
 * silently misreport a signal. Keep these cases in step with
 * `SignalHitRateParser` on iOS and `SignalHitRate` on Android — the same string
 * must produce the same percentage on all three platforms.
 */
describe('parseHitRate', () => {
  it('reads a plain percentage', () => {
    expect(parseHitRate('58%')).toBeCloseTo(0.58, 5);
    expect(parseHitRate('58.5%')).toBeCloseTo(0.585, 5);
  });

  it('averages a true range', () => {
    expect(parseHitRate('57-60%')).toBeCloseTo(0.585, 5);
    expect(parseHitRate('57 – 60 %')).toBeCloseTo(0.585, 5);
  });

  it('ignores years and sample sizes that are not percentages', () => {
    // The regression this exists for: a naive scrape averaged 61 and 1 out of
    // the trailing "(2024-25, n=83)" and rendered a 61% signal as 31%.
    expect(parseHitRate('~61% vs open wk1 (2024-25, n=83 — tracking)')).toBeCloseTo(0.61, 5);
    expect(parseHitRate('54% ATS since 2019, n=412')).toBeCloseTo(0.54, 5);
  });

  it('takes a real range even when other numbers follow', () => {
    expect(parseHitRate('57-61% of openers (2022 sample)')).toBeCloseTo(0.59, 5);
  });

  it('returns null when there is no percentage to chart', () => {
    expect(parseHitRate('tracking only')).toBeNull();
    expect(parseHitRate('')).toBeNull();
    expect(parseHitRate(null)).toBeNull();
    expect(parseHitRate(undefined)).toBeNull();
  });

  it('rejects out-of-range values rather than charting nonsense', () => {
    expect(parseHitRate('180%')).toBeNull();
    expect(parseHitRate('0%')).toBeNull();
  });
});

describe('hitRateWindow', () => {
  it('keeps the default band for ordinary rates', () => {
    expect(hitRateWindow(0.58)).toEqual({ lower: 0.35, upper: 0.7 });
  });

  it('widens rather than clamping an extreme rate onto the edge', () => {
    expect(hitRateWindow(0.31).lower).toBeCloseTo(0.27, 5);
    expect(hitRateWindow(0.82).upper).toBeCloseTo(0.86, 5);
  });

  it('leaves every value strictly inside the axis', () => {
    for (const rate of [0.05, 0.31, 0.524, 0.61, 0.95]) {
      const f = hitRateFraction(rate, hitRateWindow(rate));
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('puts break-even left of a winning rate and right of a losing one', () => {
    const win = hitRateWindow(0.61);
    expect(hitRateFraction(BREAK_EVEN_RATE, win)).toBeLessThan(hitRateFraction(0.61, win));

    const lose = hitRateWindow(0.44);
    expect(hitRateFraction(BREAK_EVEN_RATE, lose)).toBeGreaterThan(hitRateFraction(0.44, lose));
  });
});
