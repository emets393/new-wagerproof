/**
 * Per-book quotes, preference, catalog, and CFB team aliases.
 *
 * Cross-platform siblings — keep the maths in step:
 *   iOS     `WagerproofKit/Sources/WagerproofModels/SportsbookQuote.swift`
 *   Android `core/models/SportsbookQuote.kt`
 */
import { CFB_SPORTSBOOK_ALIASES } from './aliases';

export interface SportsbookQuote {
  bookKey: string;
  bookName: string;
  line: number | null;
  price: number | null;
}

export interface SportsbookMarketQuotes {
  quotes: SportsbookQuote[];
  capturedAt: string | null;
}

export type SportsbookMarket =
  | { kind: 'spread'; isHome: boolean }
  | { kind: 'total'; isOver: boolean }
  | { kind: 'moneyline'; isHome: boolean }
  | { kind: 'firstHalfSpread'; isHome: boolean }
  | { kind: 'firstHalfTotal'; isOver: boolean }
  | { kind: 'firstFiveMoneyline'; isHome: boolean }
  | { kind: 'firstFiveSpread'; isHome: boolean }
  | { kind: 'firstFiveTotal'; isOver: boolean };

export const SPORTSBOOK_NAMES: Record<string, string> = {
  draftkings: 'DraftKings',
  fanduel: 'FanDuel',
  betmgm: 'BetMGM',
  betrivers: 'BetRivers',
  williamhill_us: 'Caesars',
  bovada: 'Bovada',
  betus: 'BetUS',
  betonlineag: 'BetOnline',
  lowvig: 'LowVig',
  mybookieag: 'MyBookie',
  fanatics: 'Fanatics',
};

export const SPORTSBOOK_SELECTABLE: string[] = [
  'draftkings',
  'fanduel',
  'betmgm',
  'betrivers',
  'williamhill_us',
  'fanatics',
  'bovada',
  'betus',
  'betonlineag',
  'lowvig',
  'mybookieag',
];

export const SPORTSBOOK_PREF_KEY = 'sportsbook.preferred';

export function sportsbookName(key: string): string {
  return SPORTSBOOK_NAMES[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function decodePreferredBooks(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  return decodePreferredBookList(raw.split(',').map((part) => part.trim()));
}

export function decodePreferredBookList(keys: string[] | null | undefined): Set<string> {
  if (!keys?.length) return new Set();
  return new Set(keys.filter((key) => key in SPORTSBOOK_NAMES));
}

export function encodePreferredBooks(keys: Iterable<string>): string {
  return [...keys].sort().join(',');
}

export function preferredBooksSummary(keys: Set<string>): string {
  switch (keys.size) {
    case 0:
      return 'Showing the best number from any book';
    case 1:
      return `${sportsbookName([...keys][0])} — best number from your book`;
    case 2:
    case 3:
      return `Best of ${[...keys].sort().map(sportsbookName).join(', ')}`;
    default:
      return `Best of your ${keys.size} books`;
  }
}

export function preferredQuote(
  quotes: SportsbookMarketQuotes,
  bookKeys: Set<string>,
): SportsbookQuote | null {
  if (quotes.quotes.length === 0) return null;
  if (bookKeys.size === 0) return quotes.quotes[0];
  return quotes.quotes.find((quote) => bookKeys.has(quote.bookKey)) ?? quotes.quotes[0];
}

export function isQuoteFromSelection(
  quotes: SportsbookMarketQuotes,
  bookKeys: Set<string>,
): boolean {
  if (bookKeys.size === 0) return false;
  const shown = preferredQuote(quotes, bookKeys);
  return shown != null && bookKeys.has(shown.bookKey);
}

export interface SportsbookBookRow {
  bookKey: string;
  spreadHome?: number | null;
  spreadHomePrice?: number | null;
  spreadAway?: number | null;
  spreadAwayPrice?: number | null;
  totalPoint?: number | null;
  totalOverPrice?: number | null;
  totalUnderPrice?: number | null;
  mlHome?: number | null;
  mlAway?: number | null;
  h1SpreadHome?: number | null;
  h1SpreadHomePrice?: number | null;
  h1SpreadAway?: number | null;
  h1SpreadAwayPrice?: number | null;
  h1TotalPoint?: number | null;
  h1TotalOverPrice?: number | null;
  h1TotalUnderPrice?: number | null;
  f5SpreadHome?: number | null;
  f5SpreadHomePrice?: number | null;
  f5SpreadAway?: number | null;
  f5SpreadAwayPrice?: number | null;
  f5TotalPoint?: number | null;
  f5TotalOverPrice?: number | null;
  f5TotalUnderPrice?: number | null;
  f5MlHome?: number | null;
  f5MlAway?: number | null;
}

export interface SportsbookGameOdds {
  rows: SportsbookBookRow[];
  capturedAt: string | null;
}

function lineAndPrice(
  row: SportsbookBookRow,
  market: SportsbookMarket,
): { line: number | null; price: number | null } {
  switch (market.kind) {
    case 'spread':
      return {
        line: (market.isHome ? row.spreadHome : row.spreadAway) ?? null,
        price: (market.isHome ? row.spreadHomePrice : row.spreadAwayPrice) ?? null,
      };
    case 'total':
      return {
        line: row.totalPoint ?? null,
        price: (market.isOver ? row.totalOverPrice : row.totalUnderPrice) ?? null,
      };
    case 'moneyline':
      return { line: null, price: (market.isHome ? row.mlHome : row.mlAway) ?? null };
    case 'firstHalfSpread':
      return {
        line: (market.isHome ? row.h1SpreadHome : row.h1SpreadAway) ?? null,
        price: (market.isHome ? row.h1SpreadHomePrice : row.h1SpreadAwayPrice) ?? null,
      };
    case 'firstHalfTotal':
      return {
        line: row.h1TotalPoint ?? null,
        price: (market.isOver ? row.h1TotalOverPrice : row.h1TotalUnderPrice) ?? null,
      };
    case 'firstFiveMoneyline':
      return { line: null, price: (market.isHome ? row.f5MlHome : row.f5MlAway) ?? null };
    case 'firstFiveSpread':
      return {
        line: (market.isHome ? row.f5SpreadHome : row.f5SpreadAway) ?? null,
        price: (market.isHome ? row.f5SpreadHomePrice : row.f5SpreadAwayPrice) ?? null,
      };
    case 'firstFiveTotal':
      return {
        line: row.f5TotalPoint ?? null,
        price: (market.isOver ? row.f5TotalOverPrice : row.f5TotalUnderPrice) ?? null,
      };
  }
}

function wantsLowLine(market: SportsbookMarket): boolean {
  return (
    (market.kind === 'total' && market.isOver) ||
    (market.kind === 'firstHalfTotal' && market.isOver) ||
    (market.kind === 'firstFiveTotal' && market.isOver)
  );
}

export function quotesForMarket(
  odds: SportsbookGameOdds,
  market: SportsbookMarket,
): SportsbookMarketQuotes {
  const quotes: SportsbookQuote[] = [];
  for (const row of odds.rows) {
    const { line, price } = lineAndPrice(row, market);
    if (line == null && price == null) continue;
    quotes.push({
      bookKey: row.bookKey,
      bookName: sportsbookName(row.bookKey),
      line,
      price: price == null ? null : Math.round(price),
    });
  }
  const low = wantsLowLine(market);
  quotes.sort((lhs, rhs) => {
    if (lhs.line != null && rhs.line != null && lhs.line !== rhs.line) {
      return low ? lhs.line - rhs.line : rhs.line - lhs.line;
    }
    return (rhs.price ?? Number.MIN_SAFE_INTEGER) - (lhs.price ?? Number.MIN_SAFE_INTEGER);
  });
  return { quotes, capturedAt: odds.capturedAt };
}

export function nflCityName(fullName: string): string {
  switch (fullName) {
    case 'Los Angeles Chargers':
      return 'LA Chargers';
    case 'Los Angeles Rams':
      return 'LA Rams';
    case 'New York Giants':
      return 'NY Giants';
    case 'New York Jets':
      return 'NY Jets';
    default: {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length <= 1) return fullName;
      return parts.slice(0, -1).join(' ');
    }
  }
}

export function normalizeSportsbookName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[.'’]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

const CFB_ALIASES_NORMALIZED: Record<string, string> = Object.fromEntries(
  Object.entries(CFB_SPORTSBOOK_ALIASES).map(([odds, canonical]) => [
    normalizeSportsbookName(odds),
    canonical,
  ]),
);

export function cfbCanonicalName(oddsAPIName: string, candidates: string[]): string | null {
  const canonical = CFB_ALIASES_NORMALIZED[normalizeSportsbookName(oddsAPIName)];
  if (!canonical) return null;
  return candidates.find((name) => normalizeSportsbookName(name) === normalizeSportsbookName(canonical)) ?? null;
}

export function cfbAliasMatches(oddsAPIName: string, canonicalName: string): boolean {
  return cfbCanonicalName(oddsAPIName, [canonicalName]) != null;
}

export const cfbSupportedAliasCount = Object.keys(CFB_SPORTSBOOK_ALIASES).length;

export function formatAmerican(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return '';
  const n = Math.round(price);
  return n > 0 ? `+${n}` : String(n);
}

export function formatSignedLine(value: number): string {
  const body = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return value > 0 ? `+${body}` : body;
}

export function marketFromFootballPick(
  cardGroup: string | null | undefined,
  pickSide: string | null | undefined,
  sport: 'nfl' | 'cfb',
): SportsbookMarket | null {
  const side = (pickSide ?? '').toUpperCase();
  const isHome = side.includes('HOME');
  const group = (cardGroup ?? '').toLowerCase();
  switch (group) {
    case 'spread':
      return { kind: 'spread', isHome };
    case 'h1_spread':
      return sport === 'nfl' ? { kind: 'firstHalfSpread', isHome } : null;
    case 'total':
      return { kind: 'total', isOver: side !== 'UNDER' };
    case 'h1_total':
      return sport === 'nfl' ? { kind: 'firstHalfTotal', isOver: side !== 'UNDER' } : null;
    case 'moneyline':
    case 'ml':
      return { kind: 'moneyline', isHome };
    default:
      return null;
  }
}
