import { describe, it, expect } from 'vitest';
import { rewriteSpreadVsTtLineOps } from './rewriteSpreadVsTtLine';

describe('rewriteSpreadVsTtLineOps', () => {
  it('remaps ttLineRange → spreadSize when sentence says spread', () => {
    const ops = rewriteSpreadVsTtLineOps(
      'Team totals for favorites in week 1 with a spread of 28 or more',
      [
        { op: 'set', dimension: 'betType', value: 'team_total' },
        { op: 'set', dimension: 'weeks', value: [1, 1] },
        { op: 'set', dimension: 'favDog', value: 'favorite' },
        { op: 'set', dimension: 'ttLineRange', value: [28, 55] },
      ],
      { spreadMax: 50 },
    );
    expect(ops).toContainEqual({ op: 'set', dimension: 'spreadSize', value: [28, 50] });
    expect(ops).toContainEqual({ op: 'set', dimension: 'spreadSide', value: 'favorite' });
    expect(ops.some((o) => o.dimension === 'ttLineRange')).toBe(false);
  });

  it('does not remap when user explicitly names a TT line', () => {
    const ops = rewriteSpreadVsTtLineOps(
      'team totals with a team total line of 28 to 40',
      [{ op: 'set', dimension: 'ttLineRange', value: [28, 40] }],
    );
    expect(ops).toEqual([{ op: 'set', dimension: 'ttLineRange', value: [28, 40] }]);
  });

  it('drops mistaken ttLineRange when spreadSize already present', () => {
    const ops = rewriteSpreadVsTtLineOps(
      'favorites with a spread of 14+ and team totals',
      [
        { op: 'set', dimension: 'spreadSize', value: [14, 50] },
        { op: 'set', dimension: 'ttLineRange', value: [14, 55] },
      ],
    );
    expect(ops).toEqual([{ op: 'set', dimension: 'spreadSize', value: [14, 50] }]);
  });
});
