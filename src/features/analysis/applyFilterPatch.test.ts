import { describe, it, expect } from 'vitest';
import { applyFilterPatch, type FilterPatch } from './applyFilterPatch';
import { DEFAULT_NFL_SNAPSHOT, assertNflDimensionParity } from './filterSchema';
import type { NflWebFilterSnapshot } from './normalizeSavedFilterSnapshot';

const base = (over: Partial<NflWebFilterSnapshot> = {}): NflWebFilterSnapshot =>
  ({ ...JSON.parse(JSON.stringify(DEFAULT_NFL_SNAPSHOT)), ...over });
const P = (...ops: FilterPatch['ops']): FilterPatch => ({ ops });

describe('schema parity (guardrail is live)', () => {
  it('dimensions exactly cover the snapshot', () => { expect(() => assertNflDimensionParity()).not.toThrow(); });
});

describe('purity', () => {
  it('never mutates the input snapshot', () => {
    const input = base();
    const before = JSON.stringify(input);
    applyFilterPatch(input, P({ op: 'set', dimension: 'side', value: 'home' }, { op: 'set', dimension: 'winPct', value: [60, 100] }));
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('numRange', () => {
  it('accepts an in-bounds range', () => {
    const r = applyFilterPatch(base(), P({ op: 'set', dimension: 'winStreak', value: [3, 5] }));
    expect(r.snapshot.winStreak).toEqual([3, 5]);
    expect(r.rejected).toHaveLength(0);
  });
  it('clamps out-of-bounds and sorts reversed input', () => {
    // [20, 3] → 20 clamps to 16, then sorted → [3, 16] (a real change, not the full-range default)
    const r = applyFilterPatch(base(), P({ op: 'set', dimension: 'winStreak', value: [20, 3] }));
    expect(r.snapshot.winStreak).toEqual([3, 16]);
    expect(r.applied[0].note).toContain('clamped');
  });
  it('clamping to the full range is a no-op (no effective constraint)', () => {
    const r = applyFilterPatch(base(), P({ op: 'set', dimension: 'winStreak', value: [20, -3] }));
    expect(r.snapshot.winStreak).toEqual([0, 16]);
    expect(r.noChange).toBe(true);
  });
  it('snaps to the step grid', () => {
    const r = applyFilterPatch(base(), P({ op: 'set', dimension: 'ppg', value: [20.3, 30.9] }));
    expect(r.snapshot.ppg).toEqual([20.5, 31]); // step 0.5
  });
  it('honors bet-type-specific bounds (spreadSize max 14 on h1_spread)', () => {
    const r = applyFilterPatch(base(), P(
      { op: 'set', dimension: 'betType', value: 'h1_spread' },
      { op: 'set', dimension: 'spreadSize', value: [3, 40] },
    ));
    expect(r.snapshot.spreadSize).toEqual([3, 14]);
  });
  it('rejects a non-array value', () => {
    const r = applyFilterPatch(base(), P({ op: 'set', dimension: 'winStreak', value: 3 }));
    expect(r.rejected).toHaveLength(1);
    expect(r.snapshot.winStreak).toEqual([0, 16]);
  });
});

describe('pctRange', () => {
  it('accepts 0–100 and clamps', () => {
    const r = applyFilterPatch(base(), P({ op: 'set', dimension: 'winPct', value: [60, 150] }));
    expect(r.snapshot.winPct).toEqual([60, 100]);
  });
  it('rejects a 0–1 fraction (the "0.6 meant 60%" mistake)', () => {
    const r = applyFilterPatch(base(), P({ op: 'set', dimension: 'winPct', value: [0.6, 0.8] }));
    expect(r.rejected[0].reason).toMatch(/0–100|fraction/);
    expect(r.snapshot.winPct).toEqual([0, 100]); // unchanged
  });
});

describe('scalarMax / scalarMin', () => {
  it('clamps windMax', () => {
    expect(applyFilterPatch(base(), P({ op: 'set', dimension: 'windMax', value: 80 })).snapshot.windMax).toBe(60);
    expect(applyFilterPatch(base(), P({ op: 'set', dimension: 'windMax', value: 15 })).snapshot.windMax).toBe(15);
  });
  it('clamps minGames', () => {
    expect(applyFilterPatch(base(), P({ op: 'set', dimension: 'minGames', value: 20 })).snapshot.minGames).toBe(10);
  });
});

describe('enum', () => {
  it('accepts a valid option and rejects an invalid one', () => {
    expect(applyFilterPatch(base(), P({ op: 'set', dimension: 'side', value: 'home' })).snapshot.side).toBe('home');
    const bad = applyFilterPatch(base(), P({ op: 'set', dimension: 'side', value: 'sideways' }));
    expect(bad.rejected).toHaveLength(1);
    expect(bad.snapshot.side).toBe('any');
  });
  it("'any' clears back to default", () => {
    const r = applyFilterPatch(base({ side: 'home' }), P({ op: 'set', dimension: 'side', value: 'any' }));
    expect(r.snapshot.side).toBe('any');
  });
  it('dynamic enum (coach) needs the loaded list', () => {
    const noCtx = applyFilterPatch(base(), P({ op: 'set', dimension: 'coach', value: 'Andy Reid' }));
    expect(noCtx.rejected[0].reason).toMatch(/not loaded/);
    const withCtx = applyFilterPatch(base(), P({ op: 'set', dimension: 'coach', value: 'andy reid' }), { coaches: ['Andy Reid'] });
    expect(withCtx.snapshot.coach).toBe('Andy Reid'); // canonical casing, case-insensitive match
    const unknown = applyFilterPatch(base(), P({ op: 'set', dimension: 'coach', value: 'Nobody' }), { coaches: ['Andy Reid'] });
    expect(unknown.rejected).toHaveLength(1);
  });
});

describe('tristate', () => {
  it('coerces true/false/null and yes/no', () => {
    expect(applyFilterPatch(base(), P({ op: 'set', dimension: 'primetime', value: true })).snapshot.primetime).toBe(true);
    expect(applyFilterPatch(base(), P({ op: 'set', dimension: 'primetime', value: 'no' })).snapshot.primetime).toBe(false);
    expect(applyFilterPatch(base({ primetime: true }), P({ op: 'set', dimension: 'primetime', value: 'any' })).snapshot.primetime).toBeNull();
  });
  it('rejects a non-boolean-ish value', () => {
    expect(applyFilterPatch(base(), P({ op: 'set', dimension: 'primetime', value: 'maybe' })).rejected).toHaveLength(1);
  });
});

describe('mlOdds', () => {
  it('accepts valid American odds (number or string) and stores a string', () => {
    expect(applyFilterPatch(base(), P({ op: 'set', dimension: 'mlMin', value: -150 })).snapshot.mlMin).toBe('-150');
    expect(applyFilterPatch(base(), P({ op: 'set', dimension: 'mlMax', value: '+180' })).snapshot.mlMax).toBe('180');
  });
  it('rejects the impossible −99..+99 band and clears on empty', () => {
    expect(applyFilterPatch(base(), P({ op: 'set', dimension: 'mlMin', value: 50 })).rejected).toHaveLength(1);
    expect(applyFilterPatch(base({ mlMin: '-200' }), P({ op: 'set', dimension: 'mlMin', value: '' })).snapshot.mlMin).toBe('');
  });
});

describe('multiselect (teams)', () => {
  it('normalizes aliases, dedupes, and ignores unknowns', () => {
    const r = applyFilterPatch(base(), P({ op: 'set', dimension: 'teams', value: ['kc', 'LA', 'KC', 'ZZZ'] }));
    expect(r.snapshot.teams).toEqual(['KC', 'LAR']); // la→LAR alias, KC deduped, ZZZ dropped
    expect(r.applied[0].note).toMatch(/ZZZ/);
  });
  it('rejects when every team is unknown', () => {
    expect(applyFilterPatch(base(), P({ op: 'set', dimension: 'teams', value: ['ZZZ'] })).rejected).toHaveLength(1);
  });
  it('addItems / removeItems', () => {
    const added = applyFilterPatch(base({ teams: ['KC'] }), P({ op: 'addItems', dimension: 'teams', items: ['BUF'] }));
    expect(added.snapshot.teams).toEqual(['KC', 'BUF']);
    const removed = applyFilterPatch(base({ teams: ['KC', 'BUF'] }), P({ op: 'removeItems', dimension: 'teams', items: ['KC'] }));
    expect(removed.snapshot.teams).toEqual(['BUF']);
  });
});

describe('multiselect days + divisions', () => {
  it('normalizes day aliases, dedupes, ignores unknowns', () => {
    const r = applyFilterPatch(base(), P({ op: 'set', dimension: 'daysOfWeek', value: ['monday', 'THU', 'sun', 'xyz'] }));
    expect(r.snapshot.daysOfWeek).toEqual(['Mon', 'Thu', 'Sun']);
    expect(r.applied[0].note).toMatch(/xyz/);
  });
  it('matches divisions case-insensitively; rejects all-unknown', () => {
    expect(applyFilterPatch(base(), P({ op: 'set', dimension: 'teamDivisions', value: ['afc east', 'NFC WEST'] })).snapshot.teamDivisions)
      .toEqual(['AFC East', 'NFC West']);
    expect(applyFilterPatch(base(), P({ op: 'set', dimension: 'teamDivisions', value: ['AFC Central'] })).rejected).toHaveLength(1);
  });
});

describe('betType spine + side effects', () => {
  it('switching to a limited market resets line controls and floors seasons to 2023', () => {
    const r = applyFilterPatch(base(), P({ op: 'set', dimension: 'betType', value: 'team_total' }));
    expect(r.snapshot.betType).toBe('team_total');
    expect(r.snapshot.spreadSize).toEqual([0, 20]);
    expect(r.snapshot.lineRange).toEqual([10, 40]); // team_total total bounds
    expect(r.snapshot.seasons).toEqual([2023, 2025]); // limited-market floor
  });
  it('rejects an invalid bet type', () => {
    expect(applyFilterPatch(base(), P({ op: 'set', dimension: 'betType', value: 'nonsense' })).rejected).toHaveLength(1);
  });
});

describe('availability gating', () => {
  it('rejects spreadSize on a total market', () => {
    const r = applyFilterPatch(base(), P(
      { op: 'set', dimension: 'betType', value: 'fg_total' },
      { op: 'set', dimension: 'spreadSize', value: [3, 5] },
    ));
    expect(r.snapshot.betType).toBe('fg_total');
    expect(r.rejected.some((x) => /Spread size/.test(x.reason))).toBe(true);
  });
  it('auto-satisfies playoffRound prerequisite (sets seasonType=postseason)', () => {
    const r = applyFilterPatch(base(), P({ op: 'set', dimension: 'playoffRound', value: 'Wild Card' }));
    expect(r.rejected).toHaveLength(0);
    expect(r.snapshot.playoffRound).toBe('Wild Card');
    expect(r.snapshot.seasonType).toBe('postseason'); // set automatically
    expect(r.applied.some((a) => a.dimension === 'seasonType' && /automatically/.test(a.note ?? ''))).toBe(true);
  });
  it('auto-satisfies weeks prerequisite (sets seasonType=regular)', () => {
    const r = applyFilterPatch(base(), P({ op: 'set', dimension: 'weeks', value: [2, 10] }));
    expect(r.rejected).toHaveLength(0);
    expect(r.snapshot.weeks).toEqual([2, 10]);
    expect(r.snapshot.seasonType).toBe('regular');
  });
  it('clear is allowed even for an unavailable dimension', () => {
    // stale spreadSize on a total market → clear resets it, no rejection
    const r = applyFilterPatch(base({ betType: 'fg_total', spreadSize: [3, 5] }), P({ op: 'clear', dimension: 'spreadSize' }));
    expect(r.snapshot.spreadSize).toEqual([0, 20]);
    expect(r.rejected).toHaveLength(0);
  });
});

describe('op isolation + reporting', () => {
  it('applies the good op and rejects the bad one in the same patch', () => {
    const r = applyFilterPatch(base(), P(
      { op: 'set', dimension: 'side', value: 'home' },
      { op: 'set', dimension: 'side', value: 'sideways' },
    ));
    expect(r.snapshot.side).toBe('home');
    expect(r.applied).toHaveLength(1);
    expect(r.rejected).toHaveLength(1);
  });
  it('rejects malformed ops and unknown dimensions without throwing', () => {
    const r = applyFilterPatch(base(), {
      ops: [
        null as never,
        { op: 'set', dimension: 5 as never, value: 1 },
        { op: 'set', dimension: 'foobar', value: 1 },
        { op: 'clear' } as never,
      ],
    });
    expect(r.rejected.length).toBe(4);
    expect(r.applied).toHaveLength(0);
    expect(r.noChange).toBe(true);
  });
  it('a no-op set (same value) does not register a change', () => {
    const r = applyFilterPatch(base({ side: 'home' }), P({ op: 'set', dimension: 'side', value: 'home' }));
    expect(r.applied).toHaveLength(0);
    expect(r.noChange).toBe(true);
  });
});

describe('realistic multi-op patch', () => {
  it('"home favorites off a loss, favored 5+, weeks 2–10"', () => {
    const r = applyFilterPatch(base(), P(
      { op: 'set', dimension: 'seasonType', value: 'regular' },
      { op: 'set', dimension: 'weeks', value: [2, 10] },
      { op: 'set', dimension: 'side', value: 'home' },
      { op: 'set', dimension: 'lastResult', value: 'lost' },
      { op: 'set', dimension: 'spreadSide', value: 'favorite' },
      { op: 'set', dimension: 'spreadSize', value: [5, 20] },
    ));
    expect(r.rejected).toHaveLength(0);
    expect(r.snapshot).toMatchObject({
      seasonType: 'regular', weeks: [2, 10], side: 'home', lastResult: 'lost',
      spreadSide: 'favorite', spreadSize: [5, 20],
    });
  });
});
