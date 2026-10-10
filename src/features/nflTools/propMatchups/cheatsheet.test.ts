import { describe, expect, it } from 'vitest';
import { columnsFor, formatActual, formatGap, rankLabel, sortRows, type CheatMetric } from './cheatsheet';

function metric(partial: Partial<CheatMetric>): CheatMetric {
  return { actual: null, league: null, lift: null, rank: null, of: null, ...partial };
}

describe('cheat sheet units', () => {
  it('prints a rate as a percent and a per-play gap as yards', () => {
    expect(formatActual('success_rate', 0.0718)).toBe('7.2%');
    expect(formatGap('success_rate', metric({ lift: 0.1807 }))).toEqual({ text: '+18.1%', tone: 'pos' });
    expect(formatActual('yoe_per_target', 1.5)).toBe('1.50 yds');
    expect(formatGap('yoe_per_target', metric({ actual: 1.5, league: 0 }))).toEqual({ text: '+1.50 yds', tone: 'pos' });
  });

  it('greys a gap inside the dead zone and does not invent a zero for a missing cell', () => {
    expect(formatGap('success_rate', metric({ lift: 0.02 }))?.tone).toBe('nil');
    expect(formatGap('yoe_per_target', metric({ actual: 4.2, league: 4.4 }))?.tone).toBe('nil');
    expect(formatActual('cpoe', null)).toBe('not charted this week');
  });

  it('reads rank out of the stored field count', () => {
    expect(rankLabel(metric({ rank: 8, of: 31 }))).toBe('8th of 31');
    expect(rankLabel(metric({ rank: 1, of: 32 }))).toBe('1st of 32');
  });

  it('keeps completion percentage off a rushing table', () => {
    expect(columnsFor('rush_off')).not.toContain('cpoe');
    expect(columnsFor('pass_def')).toContain('cpoe');
  });

  it('sorts the featured column by lift, with missing cells last', () => {
    const rows = [
      { team: 'A', metrics: { success_rate: metric({ lift: 0.1 }) } },
      { team: 'B', metrics: { success_rate: metric({ lift: null }) } },
      { team: 'C', metrics: { success_rate: metric({ lift: 0.4 }) } },
    ];
    expect(sortRows(rows, 'success_rate', 'desc').map((row) => row.team)).toEqual(['C', 'A', 'B']);
  });
});
