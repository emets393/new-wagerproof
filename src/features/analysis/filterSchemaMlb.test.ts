import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MLB_SNAPSHOT, MLB_DIMENSION_KEYS, MLB_SIDE_SYMMETRIC_DIMS, MLB_SIDE_BREAKING_DIMS,
  MLB_SPORT_CONFIG, assertMlbDimensionParity, isSideSymmetricMlb,
} from './filterSchemaMlb';
import { applySportFilterPatch, type FilterPatch } from './sportFilterEngine';
import { normalizeMlbSavedFilterSnapshot, type MlbFilterSnapshot } from './normalizeSavedFilterSnapshot';

const base = (over: Partial<MlbFilterSnapshot> = {}): MlbFilterSnapshot =>
  ({ ...JSON.parse(JSON.stringify(DEFAULT_MLB_SNAPSHOT)), ...over });
const P = (...ops: FilterPatch['ops']): FilterPatch => ({ ops });
const apply = (s: MlbFilterSnapshot, p: FilterPatch, ctx = {}) =>
  applySportFilterPatch(MLB_SPORT_CONFIG, s, p, ctx);

describe('MLB schema parity', () => {
  it('dimensions exactly cover the snapshot', () => { expect(() => assertMlbDimensionParity()).not.toThrow(); });
  it('symmetry classification is complete and disjoint', () => {
    const union = [...MLB_SIDE_SYMMETRIC_DIMS, ...MLB_SIDE_BREAKING_DIMS].sort();
    expect(union).toEqual([...MLB_DIMENSION_KEYS].sort());
  });
});

describe('MLB engine behaviors', () => {
  it('resolves team aliases (oak → ATH, ari → AZ) and rejects unknowns', () => {
    const r = apply(base(), P({ op: 'set', dimension: 'teams', value: ['oak', 'ari', 'NYY'] }));
    expect(r.snapshot.teams).toEqual(['ATH', 'AZ', 'NYY']);
    expect(apply(base(), P({ op: 'set', dimension: 'teams', value: ['XYZ'] })).rejected).toHaveLength(1);
  });
  it('pitchers need the loaded list; case-insensitive match when provided', () => {
    expect(apply(base(), P({ op: 'set', dimension: 'spNames', value: ['Gerrit Cole'] })).rejected).toHaveLength(1);
    const ok = apply(base(), P({ op: 'set', dimension: 'spNames', value: ['gerrit cole'] }),
      { optionOverrides: { mlbPitchers: ['Gerrit Cole', 'Zack Wheeler'] } });
    expect(ok.snapshot.spNames).toEqual(['Gerrit Cole']);
  });
  it('pitchers fuzzy-match accents and common typos when the list is loaded', () => {
    const list = ['Cristopher Sánchez', 'Sixto Sánchez', 'Zack Wheeler'];
    const ok = apply(base(), P({ op: 'set', dimension: 'spNames', value: ['Christopher Sanchez'] }),
      { optionOverrides: { mlbPitchers: list } });
    expect(ok.rejected).toHaveLength(0);
    expect(ok.snapshot.spNames).toEqual(['Cristopher Sánchez']);
    const accent = apply(base(), P({ op: 'set', dimension: 'oppSpNames', value: ['cristopher sanchez'] }),
      { optionOverrides: { mlbPitchers: list } });
    expect(accent.snapshot.oppSpNames).toEqual(['Cristopher Sánchez']);
  });
  it('ambiguous last-name-only pitcher queries are rejected', () => {
    const list = ['Cristopher Sánchez', 'Sixto Sánchez'];
    const r = apply(base(), P({ op: 'set', dimension: 'spNames', value: ['Sanchez'] }),
      { optionOverrides: { mlbPitchers: list } });
    expect(r.rejected.length + (r.snapshot.spNames?.length ? 0 : 1)).toBeGreaterThan(0);
    expect(r.snapshot.spNames ?? []).toEqual([]);
  });
  it('game total and F5 total are independent; F5 uses f5TotalRange', () => {
    const r = apply(base(), P(
      { op: 'set', dimension: 'betType', value: 'f5_total' },
      { op: 'set', dimension: 'lineRange', value: [7, 12] },
      { op: 'set', dimension: 'f5TotalRange', value: [3, 12] },
    ));
    expect(r.snapshot.lineRange).toEqual([7, 12]);
    expect(r.snapshot.f5TotalRange).toEqual([3, 8]);
  });
  it('allows game total line on ML markets', () => {
    expect(apply(base(), P({ op: 'set', dimension: 'lineRange', value: [7, 9] })).rejected).toHaveLength(0);
    expect(apply(base(), P({ op: 'set', dimension: 'lineRange', value: [7, 9] })).snapshot.lineRange).toEqual([7, 9]);
  });
  it('validates start-time text (HH:MM) and clears on empty', () => {
    expect(apply(base(), P({ op: 'set', dimension: 'timeMin', value: '19:05' })).snapshot.timeMin).toBe('19:05');
    expect(apply(base(), P({ op: 'set', dimension: 'timeMin', value: 'evening' })).rejected).toHaveLength(1);
    expect(apply(base({ timeMin: '19:05' }), P({ op: 'set', dimension: 'timeMin', value: '' })).snapshot.timeMin).toBe('');
  });
  it('clamps the signed W/L streak to ±25', () => {
    expect(apply(base(), P({ op: 'set', dimension: 'winLossStreak', value: [-40, -5] })).snapshot.winLossStreak).toEqual([-25, -5]);
  });
});

describe('MLB legacy snapshot normalization', () => {
  it('converts the live page shape to the canonical one', () => {
    const legacy = {
      betType: 'ml', dayOfWeek: 'Fri', streakMin: '3', streakMax: '',
      lastMarginMin: '', lastMarginMax: '-2',
      sp: [{ id: 543037, name: 'Gerrit Cole' }], oppSp: [],
      spXfip: { max: 3.5 }, pfRuns: { min: 103 }, totalBounds: { min: 9 },
    };
    const s = normalizeMlbSavedFilterSnapshot(legacy);
    expect(s.daysOfWeek).toEqual(['Fri']);
    expect(s.winLossStreak).toEqual([3, 25]);
    expect(s.lastMargin).toEqual([-30, -2]);
    expect(s.spNames).toEqual(['Gerrit Cole']);
    expect(s.spXfip).toEqual([2, 3.5]);
    expect(s.pfRuns).toEqual([103, 115]);
    expect(s.lineRange).toEqual([9, 14]);
  });
  it('fills defaults for an empty snapshot', () => {
    const s = normalizeMlbSavedFilterSnapshot({});
    expect(s).toEqual(DEFAULT_MLB_SNAPSHOT);
  });
  it('preserves canonical [min,max] arrays for OptRange dims (NL restore)', () => {
    const s = normalizeMlbSavedFilterSnapshot({
      betType: 'ml',
      side: 'home',
      favDog: 'underdog',
      oppSpXfip: [4.5, 7],
      spXfip: [2, 3.2],
      bpIp: [12, 20],
      pfRuns: [103, 115],
    });
    expect(s.oppSpXfip).toEqual([4.5, 7]);
    expect(s.spXfip).toEqual([2, 3.2]);
    expect(s.bpIp).toEqual([12, 20]);
    expect(s.pfRuns).toEqual([103, 115]);
  });
});

describe('MLB side symmetry', () => {
  it('game-level filters stay symmetric on side markets', () => {
    expect(isSideSymmetricMlb(base())).toBe(true);                       // ml
    expect(isSideSymmetricMlb(base({ betType: 'rl', dome: true, windDir: 'out', months: [6, 8] }))).toBe(true);
    expect(isSideSymmetricMlb(base({ seriesGame: [1, 1], doubleheader: true }))).toBe(true);
  });
  it('team-state / pitcher / side filters break it; totals never symmetric', () => {
    expect(isSideSymmetricMlb(base({ side: 'home' }))).toBe(false);
    expect(isSideSymmetricMlb(base({ oppSpHand: 'L' }))).toBe(false);
    expect(isSideSymmetricMlb(base({ restRange: [2, 10] }))).toBe(false);
    expect(isSideSymmetricMlb(base({ winPct: [60, 100] }))).toBe(false);
    expect(isSideSymmetricMlb(base({ betType: 'total' }))).toBe(false);
  });
});
