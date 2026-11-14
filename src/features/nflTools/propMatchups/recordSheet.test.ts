import { describe, expect, it } from 'vitest';
import { formatAmerican, formatRoi, formatUnits, gradedHistory, summarizeLedger, type LedgerRow } from './recordSheet';

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    season: 2026,
    week: 5,
    player_name: 'Player',
    market_label: 'Receiving yards',
    side: 'under',
    line: 63.5,
    price: -114,
    book_name: null,
    result: null,
    actual_value: null,
    units: null,
    board_rank: 1,
    ...partial,
  };
}

describe('spotlight record', () => {
  it('keeps a push out of the win-loss line and inside the graded count', () => {
    const summary = summarizeLedger([
      row({ result: 'win', units: 1.77, market_label: 'Receiving yards' }),
      row({ player_name: 'B', result: 'win', units: 0, market_label: 'Receiving yards', board_rank: 2 }),
      row({ player_name: 'C', result: 'loss', units: -1, market_label: 'Receptions' }),
      row({ player_name: 'D', result: 'push', units: 0, market_label: 'Receptions' }),
      row({ player_name: 'E', result: null, units: null }),
    ]);
    expect(summary.wins).toBe(2);
    expect(summary.losses).toBe(1);
    expect(summary.pushes).toBe(1);
    expect(summary.graded).toBe(4);
    expect(summary.pending).toBe(1);
    expect(summary.winRate).toBeCloseTo(2 / 3);
    expect(summary.units).toBeCloseTo(0.77);
    expect(summary.roi).toBeCloseTo(0.77 / 4);
    const receptions = summary.markets.find((market) => market.label === 'Receptions');
    expect(receptions).toMatchObject({ wins: 0, losses: 1, graded: 2 });
  });

  it('does not print an ungraded pick as a settled zero', () => {
    expect(formatUnits(null)).toBeNull();
    expect(formatUnits(0)).toBe('0.00');
    expect(formatUnits(-1)).toBe('\u22121.00');
    expect(formatRoi(0.257)).toBe('+25.7%');
    expect(formatAmerican(-114)).toBe('\u2212114');
    expect(formatAmerican(112)).toBe('+112');
  });

  it('pages history newest week first', () => {
    const history = gradedHistory([
      row({ week: 4, board_rank: 2, result: 'win', units: 1, player_name: 'Older' }),
      row({ week: 5, board_rank: 3, result: 'loss', units: -1, player_name: 'Later' }),
      row({ week: 5, board_rank: 1, result: 'win', units: 1, player_name: 'First' }),
      row({ result: null, player_name: 'Pending' }),
    ]);
    expect(history.map((item) => item.player_name)).toEqual(['First', 'Later', 'Older']);
  });
});
