import { compareReads } from './signals';
import {
  PUBLIC_SPORTS,
  type BoardSort,
  type MarketRead,
  type PublicGame,
  type PublicMarket,
  type PublicSport,
  type SportFilter,
  type TierFilter,
} from './types';

export function sportsOnBoard(games: readonly PublicGame[]): PublicSport[] {
  const present = new Set(games.map((game) => game.sport));
  return PUBLIC_SPORTS.filter((sport) => present.has(sport));
}

export function readFor(game: PublicGame, market: PublicMarket): MarketRead | null {
  const slot = game.markets[market];
  if (!slot || slot.read.excluded) return null;
  return slot.read;
}

function startMs(game: PublicGame): number {
  const ms = game.startTime ? new Date(game.startTime).getTime() : Number.NaN;
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

/** Bigger side's share of the dollars. The board stores a percentage, not a dollar handle. */
function moneyLead(read: MarketRead): number {
  return Math.max(read.moneyAway, read.moneyHome);
}

/** How far the money split sits from the ticket split, in percentage points. */
function splitGap(read: MarketRead): number {
  return Math.max(Math.abs(read.moneyAway - read.betsAway), Math.abs(read.moneyHome - read.betsHome));
}

function byTime(a: PublicGame, b: PublicGame): number {
  return startMs(a) - startMs(b) || a.id.localeCompare(b.id);
}

export function selectPublicGames(
  games: readonly PublicGame[],
  sport: SportFilter,
  market: PublicMarket,
  tier: TierFilter,
  query: string,
  sort: BoardSort = 'sharp',
): PublicGame[] {
  const needle = query.trim().toLowerCase();
  return games
    .filter((game) => {
      if (sport !== 'all' && game.sport !== sport) return false;
      const read = readFor(game, market);
      if (!read) return false;
      if (tier === 'sharp' && read.category !== 'sharp_money') return false;
      if (!needle) return true;
      const haystack = `${game.away.name} ${game.home.name} ${game.away.abbrev} ${game.home.abbrev}`.toLowerCase();
      return haystack.includes(needle);
    })
    .sort((a, b) => {
      const readA = readFor(a, market)!;
      const readB = readFor(b, market)!;
      if (sort === 'time') return byTime(a, b);
      if (sort === 'money') return moneyLead(readB) - moneyLead(readA) || byTime(a, b);
      if (sort === 'diff') return splitGap(readB) - splitGap(readA) || byTime(a, b);
      return compareReads(readA, readB) || byTime(a, b);
    });
}
