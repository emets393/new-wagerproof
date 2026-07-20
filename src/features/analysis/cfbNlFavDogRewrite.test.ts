import { describe, it, expect } from 'vitest';
import { rewriteCfbFavDogOps } from './cfbNlFavDogRewrite';
import { applySportFilterPatch } from './sportFilterEngine';
import { CFB_SPORT_CONFIG, DEFAULT_CFB_SNAPSHOT } from './filterSchemaCfb';

describe('rewriteCfbFavDogOps', () => {
  it('remaps favDog→spreadSide on default fg_spread so Michigan underdogs sticks', () => {
    const ops = rewriteCfbFavDogOps('fg_spread', [
      { op: 'set', dimension: 'teams', value: ['Michigan'] },
      { op: 'set', dimension: 'favDog', value: 'underdog' },
    ]);
    expect(ops).toEqual([
      { op: 'set', dimension: 'teams', value: ['Michigan'] },
      { op: 'set', dimension: 'spreadSide', value: 'underdog' },
    ]);
    const r = applySportFilterPatch(CFB_SPORT_CONFIG, { ...DEFAULT_CFB_SNAPSHOT }, { ops });
    expect(r.rejected).toHaveLength(0);
    expect(r.snapshot.teams).toEqual(['Michigan']);
    expect(r.snapshot.spreadSide).toBe('underdog');
    expect(r.snapshot.favDog).toBe('any');
  });

  it('keeps favDog on moneyline markets', () => {
    const ops = rewriteCfbFavDogOps('fg_ml', [
      { op: 'set', dimension: 'teams', value: ['Michigan'] },
      { op: 'set', dimension: 'favDog', value: 'underdog' },
    ]);
    expect(ops.find((o) => o.dimension === 'favDog')).toEqual({
      op: 'set', dimension: 'favDog', value: 'underdog',
    });
  });

  it('remaps spreadSide→favDog when betType switches to ML in the same patch', () => {
    const ops = rewriteCfbFavDogOps('fg_spread', [
      { op: 'set', dimension: 'betType', value: 'fg_ml' },
      { op: 'set', dimension: 'teams', value: ['Ohio State'] },
      { op: 'set', dimension: 'spreadSide', value: 'underdog' },
    ]);
    expect(ops).toContainEqual({ op: 'set', dimension: 'favDog', value: 'underdog' });
    expect(ops.some((o) => o.dimension === 'spreadSide')).toBe(false);
  });

  it('drops favDog on game totals', () => {
    const ops = rewriteCfbFavDogOps('fg_total', [
      { op: 'set', dimension: 'favDog', value: 'favorite' },
      { op: 'set', dimension: 'lineRange', value: [40, 60] },
    ]);
    expect(ops.some((o) => o.dimension === 'favDog' || o.dimension === 'spreadSide')).toBe(false);
  });

  it('keeps spreadSide on team_total when spreadSize is also set', () => {
    const ops = rewriteCfbFavDogOps('fg_spread', [
      { op: 'set', dimension: 'betType', value: 'team_total' },
      { op: 'set', dimension: 'spreadSide', value: 'favorite' },
      { op: 'set', dimension: 'spreadSize', value: [28, 50] },
    ]);
    expect(ops).toContainEqual({ op: 'set', dimension: 'spreadSide', value: 'favorite' });
    expect(ops).toContainEqual({ op: 'set', dimension: 'spreadSize', value: [28, 50] });
    expect(ops).toContainEqual({ op: 'set', dimension: 'favDog', value: 'favorite' });
  });
});
