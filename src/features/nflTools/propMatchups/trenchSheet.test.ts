import { describe, expect, it } from 'vitest';
import { buildTrenchRows, formatTrenchEdge, type TrenchSource } from './trenchSheet';

describe('trench sheet', () => {
  it('keeps one row per team and does not invent a zero', () => {
    const pages: TrenchSource[] = [
      {
        team: 'CHI',
        opponent: 'DET',
        kickoff: '2026-10-11T17:00:00Z',
        fp_cards: {
          trenches: {
            pass_pro_edge: 0.04,
            run_block_edge: 0.8,
            line: { ol_pressure_faced: 0.22, ol_pressure_faced_league: 0.28, ol_pressure_faced_rank: 8, ol_pressure_faced_of: 31 },
            front: { dl_ybc_allowed: 2.1, dl_ybc_allowed_league: 1.7, dl_ybc_allowed_rank: 4, dl_ybc_allowed_of: 32 },
          },
        },
      },
      { team: 'CHI', opponent: 'DET', fp_cards: { trenches: { pass_pro_edge: 9 } } },
      { team: 'GB', opponent: 'DAL', fp_cards: null },
    ];
    const rows = buildTrenchRows(pages);
    expect(rows.map((row) => row.team)).toEqual(['CHI']);
    expect(rows[0].pressure).toMatchObject({ actual: 0.22, rank: 8, of: 31 });
    expect(rows[0].passEdge).toBe(0.04);
    expect(formatTrenchEdge('pass', 0.04)).toEqual({ text: '+4.0 pp', tone: 'pos' });
    expect(formatTrenchEdge('run', 0.2)?.tone).toBe('pos');
    expect(formatTrenchEdge('run', 0.1)?.tone).toBe('nil');
    expect(formatTrenchEdge('pass', null)).toBeNull();
  });
});
