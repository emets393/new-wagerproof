import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CFB_SNAPSHOT, CFB_DIMENSION_KEYS, CFB_SIDE_SYMMETRIC_DIMS, CFB_SIDE_BREAKING_DIMS,
  CFB_SPORT_CONFIG, assertCfbDimensionParity, isSideSymmetricCfb,
} from './filterSchemaCfb';
import { applySportFilterPatch, type FilterPatch } from './sportFilterEngine';
import type { CfbWebFilterSnapshot } from './normalizeSavedFilterSnapshot';

const base = (over: Partial<CfbWebFilterSnapshot> = {}): CfbWebFilterSnapshot =>
  ({ ...JSON.parse(JSON.stringify(DEFAULT_CFB_SNAPSHOT)), ...over });
const P = (...ops: FilterPatch['ops']): FilterPatch => ({ ops });
const apply = (s: CfbWebFilterSnapshot, p: FilterPatch, ctx = {}) =>
  applySportFilterPatch(CFB_SPORT_CONFIG, s, p, ctx);

describe('CFB schema parity', () => {
  it('dimensions exactly cover the snapshot', () => { expect(() => assertCfbDimensionParity()).not.toThrow(); });
  it('symmetry classification is complete and disjoint', () => {
    const union = [...CFB_SIDE_SYMMETRIC_DIMS, ...CFB_SIDE_BREAKING_DIMS].sort();
    expect(union).toEqual([...CFB_DIMENSION_KEYS].sort());
  });
});

describe('CFB engine behaviors', () => {
  it('accepts a full school name and rejects an unknown one', () => {
    const ok = apply(base(), P({ op: 'set', dimension: 'teams', value: ['Alabama', 'Ohio State'] }));
    expect(ok.snapshot.teams).toEqual(['Alabama', 'Ohio State']);
    expect(apply(base(), P({ op: 'set', dimension: 'teams', value: ['Faketown U'] })).rejected).toHaveLength(1);
  });
  it('resolves conference aliases (SEC exact, mac → Mid-American, cusa → Conference USA)', () => {
    const r = apply(base(), P({ op: 'set', dimension: 'selectedConferences', value: ['sec', 'mac', 'cusa'] }));
    expect(r.snapshot.selectedConferences).toEqual(['SEC', 'Mid-American', 'Conference USA']);
  });
  it('honors CFB FG spread max 50; h1SpreadSize max 28', () => {
    const fg = apply(base(), P({ op: 'set', dimension: 'spreadSide', value: 'favorite' }, { op: 'set', dimension: 'spreadSize', value: [10, 60] }));
    expect(fg.snapshot.spreadSize).toEqual([10, 50]);
    const h1 = apply(base(), P({ op: 'set', dimension: 'h1SpreadSize', value: [3, 40] }));
    expect(h1.snapshot.h1SpreadSize).toEqual([3, 28]);
  });
  it('allows FG spread on ML markets; favDog still gated off spread markets', () => {
    const r1 = apply(base(), P({ op: 'set', dimension: 'betType', value: 'fg_ml' }, { op: 'set', dimension: 'spreadSize', value: [3, 7] }));
    expect(r1.snapshot.spreadSize).toEqual([3, 7]);
    expect(r1.rejected).toHaveLength(0);
    const r2 = apply(base(), P({ op: 'set', dimension: 'favDog', value: 'underdog' })); // fg_spread market
    expect(r2.rejected).toHaveLength(1);
    const r3 = apply(base(), P({ op: 'set', dimension: 'betType', value: 'fg_ml' }, { op: 'set', dimension: 'favDog', value: 'underdog' }));
    expect(r3.snapshot.favDog).toBe('underdog');
  });
  it('switching to a limited market floors seasons to 2023 without resetting FG total lineRange', () => {
    const r = apply(base(), P({ op: 'set', dimension: 'betType', value: 'team_total' }));
    expect(r.snapshot.seasons).toEqual([2023, 2025]);
    expect(r.snapshot.lineRange).toEqual([30, 80]);
    expect(r.snapshot.ttLineRange).toEqual([10, 55]);
  });
  it('clamps CFB margins to ±80', () => {
    const r = apply(base(), P({ op: 'set', dimension: 'lastMargin', value: [30, 120] }));
    expect(r.snapshot.lastMargin).toEqual([30, 80]);
  });
});

describe('CFB side symmetry', () => {
  it('game-level filters stay symmetric — including ranked matchup', () => {
    expect(isSideSymmetricCfb(base())).toBe(true);
    expect(isSideSymmetricCfb(base({ rankedMatchup: 'both', primetime: true, gameType: 'regular' }))).toBe(true);
    expect(isSideSymmetricCfb(base({ weather: 'snow', daysOfWeek: ['Fri'] }))).toBe(true);
  });
  it('side/team/conference/state filters break symmetry; totals never symmetric', () => {
    expect(isSideSymmetricCfb(base({ side: 'home' }))).toBe(false);
    expect(isSideSymmetricCfb(base({ selectedConferences: ['SEC'] }))).toBe(false);
    expect(isSideSymmetricCfb(base({ winPct: [60, 100] }))).toBe(false);
    expect(isSideSymmetricCfb(base({ oppLastTotal: 'under' }))).toBe(false);
    expect(isSideSymmetricCfb(base({ betType: 'fg_total' }))).toBe(false);
  });
});
