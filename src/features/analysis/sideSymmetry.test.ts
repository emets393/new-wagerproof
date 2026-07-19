import { describe, it, expect } from 'vitest';
import {
  DEFAULT_NFL_SNAPSHOT, NFL_DIMENSION_KEYS, NFL_SIDE_SYMMETRIC_DIMS, NFL_SIDE_BREAKING_DIMS,
  isSideSymmetric,
} from './filterSchema';
import type { NflWebFilterSnapshot } from './normalizeSavedFilterSnapshot';

const base = (over: Partial<NflWebFilterSnapshot> = {}): NflWebFilterSnapshot =>
  ({ ...JSON.parse(JSON.stringify(DEFAULT_NFL_SNAPSHOT)), ...over });

describe('side-symmetry classification completeness', () => {
  it('every dimension is classified exactly once (add new dims to one of the two lists)', () => {
    const union = [...NFL_SIDE_SYMMETRIC_DIMS, ...NFL_SIDE_BREAKING_DIMS].sort();
    expect(union).toEqual([...NFL_DIMENSION_KEYS].sort());
    const overlap = (NFL_SIDE_SYMMETRIC_DIMS as readonly string[]).filter((k) =>
      (NFL_SIDE_BREAKING_DIMS as readonly string[]).includes(k));
    expect(overlap).toEqual([]);
  });
});

describe('isSideSymmetric', () => {
  it('default snapshot on a side market is symmetric (forced ~50%)', () => {
    expect(isSideSymmetric(base())).toBe(true);                              // fg_spread
    expect(isSideSymmetric(base({ betType: 'fg_ml' }))).toBe(true);
    expect(isSideSymmetric(base({ betType: 'h1_spread' }))).toBe(true);
  });
  it('totals markets are never "symmetric" (over/under is a real game outcome)', () => {
    expect(isSideSymmetric(base({ betType: 'fg_total' }))).toBe(false);
    expect(isSideSymmetric(base({ betType: 'team_total' }))).toBe(false);
    expect(isSideSymmetric(base({ betType: 'h1_total' }))).toBe(false);
  });
  it('game-level filters keep it symmetric (the trap case)', () => {
    expect(isSideSymmetric(base({ primetime: true, dome: 'outdoor', tempRange: [-10, 32] }))).toBe(true);
    expect(isSideSymmetric(base({ seasonType: 'regular', weeks: [1, 4], daysOfWeek: ['Thu'] }))).toBe(true);
    expect(isSideSymmetric(base({ spreadSize: [3, 7] }))).toBe(true);        // abs spread, either side
  });
  it('side-picking / team-state filters break it', () => {
    expect(isSideSymmetric(base({ side: 'home' }))).toBe(false);
    expect(isSideSymmetric(base({ spreadSide: 'favorite' }))).toBe(false);
    expect(isSideSymmetric(base({ teams: ['KC'] }))).toBe(false);
    expect(isSideSymmetric(base({ teamDivisions: ['AFC East'] }))).toBe(false);
    expect(isSideSymmetric(base({ winPct: [60, 100] }))).toBe(false);
    expect(isSideSymmetric(base({ lastResult: 'lost' }))).toBe(false);
    expect(isSideSymmetric(base({ oppLastTotal: 'under' }))).toBe(false);
    expect(isSideSymmetric(base({ mlMin: '-200' }))).toBe(false);
    expect(isSideSymmetric(base({ restBye: 'off_bye' }))).toBe(false);
  });
});
