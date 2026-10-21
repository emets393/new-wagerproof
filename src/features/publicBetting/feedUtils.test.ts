import { describe, expect, it } from 'vitest';
import type { TeamRef } from '@/features/games/types';
import { readMarket } from './signals';
import { selectPublicGames } from './feedUtils';
import type { BoardRow, PublicGame } from './types';

const team: TeamRef = {
  name: 'Team',
  abbrev: 'TM',
  logoUrl: null,
  colors: { primary: '#111111', secondary: '#eeeeee' },
};

function game(
  id: string,
  startTime: string,
  tickets: number,
  betsAway: number,
  betsHome: number,
  moneyAway: number,
  moneyHome: number,
): PublicGame {
  const row: BoardRow = {
    game_id: Number(id),
    market: 'spread',
    sport: 'nfl',
    season: 2026,
    week: 7,
    slate_date: null,
    start_time: startTime,
    game_type: null,
    away: 'Away',
    home: 'Home',
    snap_ts: '2026-10-20T12:00:00Z',
    away_open: -3,
    home_open: 3,
    away_cons: -3,
    home_cons: 3,
    away_cons_price: null,
    home_cons_price: null,
    away_close: -3,
    home_close: 3,
    away_price: null,
    home_price: null,
    bets_away: betsAway,
    bets_home: betsHome,
    money_away: moneyAway,
    money_home: moneyHome,
    tickets,
    has_split: true,
  };
  return {
    id,
    gameId: Number(id),
    sport: 'nfl',
    away: { ...team, name: `Away ${id}` },
    home: { ...team, name: `Home ${id}` },
    startTime,
    capturedAt: null,
    tickets,
    markets: {
      spread: {
        row,
        read: readMarket({
          market: 'spread',
          betsAway,
          betsHome,
          moneyAway,
          moneyHome,
          awayOpen: -3,
          homeOpen: 3,
          awayCons: -3,
          homeCons: 3,
          awayClose: -3,
          homeClose: 3,
          tickets,
          hasSplit: true,
          awayName: 'Away',
          homeName: 'Home',
        }),
      },
    },
  };
}

const slate = [
  game('1', '2026-10-21T00:00:00Z', 500, 60, 40, 60, 40),
  game('2', '2026-10-22T00:00:00Z', 5000, 80, 20, 50, 50),
  game('3', '2026-10-23T00:00:00Z', 1000, 70, 30, 90, 10),
];

function ids(sort: 'sharp' | 'time' | 'tickets' | 'money' | 'diff'): string[] {
  return selectPublicGames(slate, 'nfl', 'spread', 'all', '', sort).map((item) => item.id);
}

describe('selectPublicGames sort', () => {
  it('orders by soonest start, ticket count, money share, and the money-ticket gap', () => {
    expect(ids('time')).toEqual(['1', '2', '3']);
    expect(ids('tickets')).toEqual(['2', '3', '1']);
    expect(ids('money')).toEqual(['3', '1', '2']);
    expect(ids('diff')).toEqual(['2', '3', '1']);
  });

  it('keeps the sharp read ahead of a flat public split', () => {
    expect(ids('sharp')[0]).toBe('2');
  });
});
