import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LedgerRow } from '@/features/nflTools/propMatchups/recordSheet';
import { NflRecordSheet } from './NflRecordSheet';

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    season: 2026,
    week: 5,
    player_name: 'MarShawn Lloyd',
    market_label: 'Rushing yards',
    side: 'over',
    line: 48.5,
    price: -110,
    book_name: null,
    result: 'win',
    actual_value: 62,
    units: 0.91,
    board_rank: 1,
    ...partial,
  };
}

describe('spotlight record page', () => {
  const html = renderToStaticMarkup(
    <NflRecordSheet
      isLoading={false}
      onClose={() => undefined}
      rows={[
        row({}),
        row({ player_name: 'Jayden Daniels', result: 'loss', units: -1, board_rank: 2, market_label: 'Pass yards' }),
        row({ player_name: 'Pending', result: null, units: null, board_rank: 3 }),
      ]}
    />,
  );

  it('covers the page with the record and win rate', () => {
    expect(html).toContain('fixed inset-0');
    expect(html).toContain('aria-label="Close spotlight record"');
    expect(html).toContain('Spotlight record');
    expect(html).toContain('1-1');
    expect(html).toContain('50.0%');
    expect(html).toContain('MarShawn Lloyd');
    expect(html).not.toContain('Pending');
  });
});
