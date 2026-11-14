import { describe, expect, it } from 'vitest';
import { groupBoardRows, parseBoardRow } from './groupBoard';
import type { PublicGame, PublicSport } from '../types';

const team = (sport: PublicSport, name: string): PublicGame['away'] => ({
  name,
  abbrev: name.slice(0, 3).toUpperCase(),
  logoUrl: null,
  colors: { primary: '#111111', secondary: '#222222' },
});

function row(overrides: Record<string, unknown>) {
  return parseBoardRow({
    game_id: 10,
    market: 'spread',
    sport: 'nfl',
    away: 'Chiefs',
    home: 'Bills',
    snap_ts: '2026-10-20T12:00:00Z',
    start_time: '2026-10-20T20:15:00Z',
    bets_away: 62,
    bets_home: 38,
    money_away: 55,
    money_home: 45,
    tickets: 3000,
    has_split: true,
    away_open: 3,
    away_close: 2.5,
    ...overrides,
  });
}

describe('groupBoardRows', () => {
  it('keeps a missing market absent and uses the newest snap', () => {
    const spread = row({});
    const total = row({
      market: 'total',
      snap_ts: '2026-10-20T15:00:00Z',
      away_open: 47.5,
      away_close: 46.5,
    });
    const older = row({ snap_ts: '2026-10-20T10:00:00Z', away_close: 4 });
    expect(spread && total && older).toBeTruthy();
    const [game] = groupBoardRows([older!, spread!, total!], team);
    expect(game.markets.ml).toBeUndefined();
    expect(game.markets.spread?.row.away_close).toBe(2.5);
    expect(game.capturedAt).toBe('2026-10-20T15:00:00Z');
    expect(game.sport).toBe('nfl');
  });

  it('drops a row the view would not have typed', () => {
    expect(parseBoardRow({ game_id: 1, market: 'mlb', sport: 'nfl', away: 'A', home: 'B', snap_ts: 'x' })).toBeNull();
  });
});
