import { describe, expect, it } from 'vitest';
import { SHEETS, activeCheat, columnsFor, formatActual, formatGap, rankLabel, rowsForSheet, sheetTableKey, sortRows, type CheatMetric, type CheatRow } from './cheatsheet';

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
    expect(formatGap('success_rate', metric({ lift: 0.005 }))?.tone).toBe('nil');
    expect(formatGap('yoe_per_target', metric({ actual: 4.2, league: 4.4 }))?.tone).toBe('nil');
    expect(formatGap('mtf_per_att', metric({ actual: 0.2, league: 0.16 }))?.tone).toBe('pos');
    expect(formatActual('cpoe', null)).toBe('not charted this week');
  });

  it('scores a defense by what helps that defense', () => {
    const bears = metric({ actual: 0.609, league: 0.489, lift: 0.246, rank: 1, of: 32 });
    expect(formatGap('success_rate', bears, 'defense')).toEqual({ text: '+24.6%', tone: 'neg' });
    expect(rankLabel(bears, 'defense', 'success_rate')).toBe('32nd of 32');
    expect(formatGap('success_rate', bears, 'offense')?.tone).toBe('pos');
    expect(rankLabel(bears, 'offense', 'success_rate')).toBe('1st of 32');
    expect(formatGap('stuff_rate', metric({ lift: 0.1 }), 'defense')?.tone).toBe('pos');
    expect(formatGap('deep_rate', metric({ lift: 0.2 }), 'defense')?.tone).toBe('nil');
  });

  it('reads rank out of the stored field count', () => {
    expect(rankLabel(metric({ rank: 8, of: 31 }))).toBe('8th of 31');
    expect(rankLabel(metric({ rank: 1, of: 32 }))).toBe('1st of 32');
  });

  it('keeps completion percentage off a rushing table', () => {
    expect(columnsFor('rush_off')).not.toContain('cpoe');
    expect(columnsFor('pass_def')).toContain('cpoe');
  });

  it('resolves the filters to one table', () => {
    const rush = activeCheat({ family: 'rushing', side: 'defense', position: 'QB', alignment: '' });
    const slot = activeCheat({ family: 'receiving', side: 'defense', position: 'WR', alignment: 'slot' });
    const passing = activeCheat({ family: 'passing', side: 'offense', position: '', alignment: '' });
    expect(rush.tableKey).toBe('rush_def_QB');
    expect(rush.alignments).toEqual([]);
    expect(slot.tableKey).toBe('recv_def_slot');
    expect(slot.positions).toEqual([]);
    expect(slot.alignments.map((item) => item.value)).toEqual(['slot', 'wide']);
    expect(passing.tableKey).toBe('pass_off');
    expect(passing.positions).toEqual([]);
    expect(activeCheat({ family: 'rushing', side: 'defense', position: 'RB', alignment: 'slot' }).tableKey).toBe('rush_def_RB');
    expect(activeCheat({ family: 'trenches', side: 'defense', position: '', alignment: '' }).kind).toBe('trenches');
  });

  it('keeps position and alignment as filters on one table', () => {
    const rush = SHEETS.find((sheet) => sheet.id === 'rush_def');
    const receiving = SHEETS.find((sheet) => sheet.id === 'recv_def');
    expect(SHEETS.filter((sheet) => sheet.family === 'rushing' && sheet.side === 'defense')).toHaveLength(1);
    expect(SHEETS.filter((sheet) => sheet.family === 'receiving' && sheet.side === 'defense')).toHaveLength(1);
    expect(rush && sheetTableKey(rush, 'QB')).toBe('rush_def_QB');
    expect(receiving && sheetTableKey(receiving, 'slot')).toBe('recv_def_slot');

    const row = (tableKey: string, team: string): CheatRow => ({
      family: 'rushing',
      tableKey,
      positionFilter: tableKey.endsWith('QB') ? 'QB' : 'RB',
      alignmentFilter: null,
      side: 'defense',
      team,
      opponent: 'DET',
      kickoff: null,
      headline: 'success_rate',
      metrics: {},
      player: null,
    });
    expect(rush && rowsForSheet([row('rush_def_RB', 'CHI'), row('rush_def_QB', 'CHI')], rush, 'QB').map((item) => item.tableKey)).toEqual(['rush_def_QB']);
  });

  it('sorts the featured column by what helps the side, with missing cells last', () => {
    const rows = [
      { team: 'A', metrics: { success_rate: metric({ lift: 0.1 }) } },
      { team: 'B', metrics: { success_rate: metric({ lift: null }) } },
      { team: 'C', metrics: { success_rate: metric({ lift: 0.4 }) } },
    ];
    expect(sortRows(rows, 'success_rate', 'desc').map((row) => row.team)).toEqual(['C', 'A', 'B']);
    const defense = [
      { team: 'CHI', side: 'defense', metrics: { success_rate: metric({ lift: 0.25 }) } },
      { team: 'BAL', side: 'defense', metrics: { success_rate: metric({ lift: -0.1 }) } },
    ];
    expect(sortRows(defense, 'success_rate', 'desc').map((row) => row.team)).toEqual(['BAL', 'CHI']);
  });
});
