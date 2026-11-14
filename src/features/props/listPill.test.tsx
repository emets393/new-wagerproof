import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { NflPropPlayerPage } from '@/features/propBreakdown/types';
import { kickoffLabel, listedOffer, NflPropPlayerBrowser, pillText } from './NflPropPlayerBrowser';

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
    })).toEqual({ market: 'player_anytime_td', line: 'Anytime TD Over' });
  });

  it('keeps the side and the line on a two-sided spotlight', () => {
    expect(pillText(player, {
      nFor: 0,
      nAgainst: 3,
      market: 'player_pass_yds',
      side: 'under',
      line: 198.5,
      label: 'Passing Yards',
    }).line).toBe('Pass Yards U198.5');
  });
});

describe('player card offer', () => {
  it('uses the best book on the pick side', () => {
    expect(listedOffer('over', { line: 72, over_price: -110, under_price: -110 }, {
      overBook: 'fanduel',
      overLine: 72.5,
      overPrice: -105,
      underBook: 'draftkings',
      underLine: 71.5,
      underPrice: -115,
    })).toEqual({ book: 'fanduel', line: '72.5', price: '\u2212105' });
  });

  it('shows the book, the line, the price, and the kickoff, without a reading record', () => {
    const cardPlayer = {
      player_id: '1',
      player_name: 'Aaron Jones',
      position: 'RB',
      team: 'MIN',
      opponent: 'NO',
      is_home: true,
      kickoff: '2026-10-11T17:00:00Z',
      headshot_url: null,
      markets: [{ key: 'player_rush_yds', label: 'Rushing yards', line: 72, over_price: -110, under_price: -110, status: 'posted' }],
    } as NflPropPlayerPage;
    const html = renderToStaticMarkup(
      <NflPropPlayerBrowser
        players={[cardPlayer]}
        games={[]}
        gameIdByPlayer={new Map([['1', 'g1']])}
        spotlightRank={new Map([['1', 1]])}
        leanIds={new Set()}
        spotlightRecord={new Map([['1', { nFor: 6, nAgainst: 0, market: 'player_rush_yds', side: 'over', line: 72, label: 'Rushing yards' }]])}
        books={new Map([['1:player_rush_yds', { overBook: 'fanduel', overLine: 72.5, overPrice: -105, underBook: null, underLine: null, underPrice: null }]])}
        rail="all"
        onRail={() => undefined}
        selectedPlayerId={null}
        onSelectPlayer={() => undefined}
        onSportChange={() => undefined}
        isLoading={false}
        onRefresh={() => undefined}
      />,
    );
    expect(html).toContain('Aaron Jones');
    expect(html).toContain('Spotlight');
    expect(html).toContain('Rush yards O72');
    expect(html).not.toContain('6-0');
    expect(html).toContain('/sportsbooks/fanduel.png');
    expect(html).toContain('72.5');
    expect(html).toContain('\u2212105');
    expect(html).toContain(kickoffLabel('2026-10-11T17:00:00Z')!);
  });
});
