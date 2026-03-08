import { describe, it, expect } from 'vitest';
import { calculateUnits, calculateTotalUnits } from './unitsCalculation';

// These tests ensure parity with the SQL function recalculate_avatar_performance()
// and the agentPerformanceService.calculateNetUnits() in both web and mobile.

describe('calculateUnits — canonical formula parity', () => {
  // ── Standard cases ────────────────────────────────────────────────

  it('-110 odds, won → +0.9091 units', () => {
    const r = calculateUnits('won', '-110', 1);
    expect(r.netUnits).toBeCloseTo(100 / 110, 4); // 0.9091
    expect(r.unitsWon).toBeCloseTo(100 / 110, 4);
    expect(r.unitsLost).toBe(0);
  });

  it('-110 odds, lost → -1.0 units', () => {
    const r = calculateUnits('won', '-110', 1);
    expect(r.netUnits).toBeCloseTo(0.9091, 4);
    const loss = calculateUnits('lost', '-110', 1);
    expect(loss.netUnits).toBe(-1);
    expect(loss.unitsLost).toBe(1);
  });

  it('+150 odds, won → +1.5 units', () => {
    const r = calculateUnits('won', '+150', 1);
    expect(r.netUnits).toBe(1.5);
    expect(r.unitsWon).toBe(1.5);
  });

  it('+150 odds, lost → -1.0 units', () => {
    const r = calculateUnits('lost', '+150', 1);
    expect(r.netUnits).toBe(-1);
    expect(r.unitsLost).toBe(1);
  });

  it('-200 odds, won → +0.5 units', () => {
    const r = calculateUnits('won', '-200', 1);
    expect(r.netUnits).toBe(0.5);
  });

  it('-200 odds, lost → -1.0 units', () => {
    const r = calculateUnits('lost', '-200', 1);
    expect(r.netUnits).toBe(-1);
  });

  it('+100 odds, won → +1.0 units (even money)', () => {
    const r = calculateUnits('won', '+100', 1);
    expect(r.netUnits).toBe(1);
  });

  it('-100 odds, won → +1.0 units (even money)', () => {
    const r = calculateUnits('won', '-100', 1);
    expect(r.netUnits).toBe(1);
  });

  // ── Symmetry check: -100 and +100 are equivalent ──────────────────

  it('-100 and +100 both pay +1.0 on a win', () => {
    expect(calculateUnits('won', '-100', 1).netUnits).toBe(1);
    expect(calculateUnits('won', '+100', 1).netUnits).toBe(1);
  });

  // ── Push / Pending / null ─────────────────────────────────────────

  it('push → 0', () => {
    expect(calculateUnits('push', '-110', 1).netUnits).toBe(0);
  });

  it('pending → 0', () => {
    expect(calculateUnits('pending', '-110', 1).netUnits).toBe(0);
  });

  it('null result → 0', () => {
    expect(calculateUnits(null, '-110', 1).netUnits).toBe(0);
  });

  it('undefined result → 0', () => {
    expect(calculateUnits(undefined, '-110', 1).netUnits).toBe(0);
  });

  // ── Edge cases: odds=0, null odds, unsigned odds, decimal odds ────

  it('odds=0 (number) → 0 (guards against division by zero)', () => {
    expect(calculateUnits('won', 0, 1).netUnits).toBe(0);
  });

  it('odds="0" (string) → 0', () => {
    expect(calculateUnits('won', '0', 1).netUnits).toBe(0);
  });

  it('null odds → 0', () => {
    expect(calculateUnits('won', null, 1).netUnits).toBe(0);
  });

  it('unsigned odds "150" → treated as positive +150', () => {
    const r = calculateUnits('won', '150', 1);
    expect(r.netUnits).toBe(1.5);
  });

  it('decimal odds "110.5" → rejected (returns 0)', () => {
    expect(calculateUnits('won', '110.5', 1).netUnits).toBe(0);
  });

  it('decimal odds "-110.5" → rejected (returns 0)', () => {
    expect(calculateUnits('won', '-110.5', 1).netUnits).toBe(0);
  });

  // ── Edge cases: units ─────────────────────────────────────────────

  it('units=0 → 0', () => {
    expect(calculateUnits('won', '-110', 0).netUnits).toBe(0);
  });

  it('null units → 0', () => {
    expect(calculateUnits('won', '-110', null).netUnits).toBe(0);
  });

  it('units=2.0 → scales correctly', () => {
    const r = calculateUnits('won', '-110', 2);
    expect(r.netUnits).toBeCloseTo(2 * (100 / 110), 4);
  });

  // ── Numeric odds (not string) ─────────────────────────────────────

  it('numeric odds -110 → same as string "-110"', () => {
    const strResult = calculateUnits('won', '-110', 1);
    const numResult = calculateUnits('won', -110, 1);
    expect(numResult.netUnits).toBeCloseTo(strResult.netUnits, 10);
  });

  it('numeric odds 150 → same as string "150"', () => {
    const strResult = calculateUnits('won', '150', 1);
    const numResult = calculateUnits('won', 150, 1);
    expect(numResult.netUnits).toBeCloseTo(strResult.netUnits, 10);
  });

  // ── Heavy favorites and big underdogs ─────────────────────────────

  it('-1200 odds, won → +0.0833 units', () => {
    const r = calculateUnits('won', '-1200', 1);
    expect(r.netUnits).toBeCloseTo(100 / 1200, 4);
  });

  it('+2000 odds, won → +20.0 units', () => {
    const r = calculateUnits('won', '+2000', 1);
    expect(r.netUnits).toBe(20);
  });
});

describe('calculateTotalUnits', () => {
  it('aggregates multiple picks correctly', () => {
    const picks = [
      { result: 'won' as const, best_price: '-110', units: 1 },
      { result: 'lost' as const, best_price: '+150', units: 1 },
      { result: 'push' as const, best_price: '-200', units: 1 },
    ];
    const r = calculateTotalUnits(picks);
    // won at -110: +0.9091, lost at +150: -1.0, push: 0
    expect(r.unitsWon).toBeCloseTo(100 / 110, 4);
    expect(r.unitsLost).toBe(1);
    expect(r.netUnits).toBeCloseTo((100 / 110) - 1, 4);
  });

  it('empty array → all zeros', () => {
    const r = calculateTotalUnits([]);
    expect(r.netUnits).toBe(0);
    expect(r.unitsWon).toBe(0);
    expect(r.unitsLost).toBe(0);
  });
});
