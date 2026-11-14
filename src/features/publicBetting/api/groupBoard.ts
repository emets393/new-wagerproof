import { readMarket, type MarketInput } from '../signals';
import type { BoardRow, PublicGame, PublicMarket, PublicSport } from '../types';
import { PUBLIC_MARKETS } from '../types';

const MARKETS = new Set<string>(PUBLIC_MARKETS);
const SPORTS = new Set<string>(['nfl', 'cfb', 'nba', 'ncaab']);

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Coerce one view row. Unknown sports and markets are dropped. */
export function parseBoardRow(raw: Record<string, unknown>): BoardRow | null {
  const market = text(raw.market);
  const sport = text(raw.sport);
  const gameId = num(raw.game_id);
  const away = text(raw.away);
  const home = text(raw.home);
  const snap = text(raw.snap_ts);
  if (!MARKETS.has(market) || !SPORTS.has(sport) || gameId === null || !away || !home || !snap) {
    return null;
  }

  return {
    game_id: gameId,
    market: market as PublicMarket,
    sport: sport as PublicSport,
    season: num(raw.season),
    week: num(raw.week),
    slate_date: text(raw.slate_date) || null,
    start_time: text(raw.start_time) || null,
    game_type: text(raw.game_type) || null,
    away,
    home,
    snap_ts: snap,
    away_open: num(raw.away_open),
    home_open: num(raw.home_open),
    away_cons: num(raw.away_cons),
    home_cons: num(raw.home_cons),
    away_cons_price: num(raw.away_cons_price),
    home_cons_price: num(raw.home_cons_price),
    away_close: num(raw.away_close),
    home_close: num(raw.home_close),
    away_price: num(raw.away_price),
    home_price: num(raw.home_price),
    bets_away: num(raw.bets_away),
    bets_home: num(raw.bets_home),
    money_away: num(raw.money_away),
    money_home: num(raw.money_home),
    tickets: num(raw.tickets),
    has_split: raw.has_split === true,
  };
}

function toInput(row: BoardRow): MarketInput {
  return {
    market: row.market,
    betsAway: row.bets_away,
    betsHome: row.bets_home,
    moneyAway: row.money_away,
    moneyHome: row.money_home,
    awayOpen: row.away_open,
    homeOpen: row.home_open,
    awayCons: row.away_cons,
    homeCons: row.home_cons,
    awayClose: row.away_close,
    homeClose: row.home_close,
    tickets: row.tickets,
    hasSplit: row.has_split === true,
    awayName: row.away,
    homeName: row.home,
  };
}

function newest(stamps: string[]): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const stamp of stamps) {
    const ms = new Date(stamp).getTime();
    if (Number.isFinite(ms) && ms >= bestMs) {
      best = stamp;
      bestMs = ms;
    }
  }
  return best;
}

/**
 * One game per game_id. A market the view didn't return is absent.
 * `capturedAt` is the newest snap across the markets that exist.
 */
export function groupBoardRows(
  rows: BoardRow[],
  teamFor: (sport: PublicSport, name: string) => PublicGame['away'],
): PublicGame[] {
  const byId = new Map<number, BoardRow[]>();
  for (const row of rows) {
    const list = byId.get(row.game_id);
    if (list) list.push(row);
    else byId.set(row.game_id, [row]);
  }

  const games: PublicGame[] = [];
  for (const [gameId, group] of byId) {
    const head = group[0];
    const markets: PublicGame['markets'] = {};
    for (const row of group) {
      const existing = markets[row.market];
      if (existing && new Date(existing.row.snap_ts).getTime() > new Date(row.snap_ts).getTime()) {
        continue;
      }
      markets[row.market] = { row, read: readMarket(toInput(row)) };
    }
    const tickets = PUBLIC_MARKETS.map((market) => markets[market]?.row.tickets).filter(
      (value): value is number => value !== null && value !== undefined,
    );
    games.push({
      id: String(gameId),
      gameId,
      sport: head.sport,
      away: teamFor(head.sport, head.away),
      home: teamFor(head.sport, head.home),
      startTime: head.start_time,
      capturedAt: newest(group.map((row) => row.snap_ts)),
      tickets: tickets.length > 0 ? Math.max(...tickets) : null,
      markets,
    });
  }

  games.sort((a, b) => {
    const aMs = a.startTime ? new Date(a.startTime).getTime() : Number.POSITIVE_INFINITY;
    const bMs = b.startTime ? new Date(b.startTime).getTime() : Number.POSITIVE_INFINITY;
    return aMs - bMs;
  });
  return games;
}
