import { describe, expect, it } from 'vitest';
import type { NflPropPlayerPage } from '@/features/propBreakdown/types';
import { pillText } from './NflPropPlayerBrowser';

const player = { position: 'QB', markets: [] } as unknown as NflPropPlayerPage;

describe('spotlight list pill', () => {
  it('names the spotlight market, not a different lean', () => {
    expect(pillText(player, {
      nFor: 4,
      nAgainst: 0,
      market: 'player_anytime_td',
      side: 'over',
      line: null,
      label: 'Anytime TD',
    })).toEqual({ market: 'player_anytime_td', line: 'Anytime TD Over · 4-0' });
  });

  it('keeps the side and the line on a two-sided spotlight', () => {
    expect(pillText(player, {
      nFor: 0,
      nAgainst: 3,
      market: 'player_pass_yds',
      side: 'under',
      line: 198.5,
      label: 'Passing Yards',
    }).line).toBe('Pass Yards U198.5 · 0-3');
  });
});
