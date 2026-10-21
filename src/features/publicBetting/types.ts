import type { TeamRef } from '@/features/games/types';

/** Leagues Action Network is captured for. No MLB. */
export type PublicSport = 'nfl' | 'cfb' | 'nba' | 'ncaab';

/** `away` is the away team on spread/ml and the OVER on a total. */
export type PublicMarket = 'spread' | 'total' | 'ml';

export type PublicSide = 'away' | 'home';

export type SportFilter = 'all' | PublicSport;

export type TierFilter = 'all' | 'sharp';

/** Feed order. `sharp` is the signal rank. The other four are the raw board numbers. */
export type BoardSort = 'sharp' | 'time' | 'tickets' | 'money' | 'diff';

/**
 * The nine reads. Two axes: whether the money sits on the side the crowd ISN'T on, and
 * whether the line confirms it. ⛔ The ticket count gates nothing — it only decides how the
 * sentence describes the crowd. An earlier version gated every money read behind a 60%
 * ticket majority, which labelled a 52/48 ticket split with 85% of the money "Even Split".
 */
export type PublicCategory =
  // money on the side the crowd is NOT on
  | 'sharp_money'
  | 'money_no_move'
  | 'line_fights_money'
  // money piling onto the side the crowd IS on
  | 'hammered'
  | 'public_loading'
  // money tracking the tickets
  | 'consensus'
  | 'line_pushes_back'
  | 'public'
  | 'split';

export type CategoryEmphasis = 'loud' | 'medium' | 'quiet' | 'none';

/**
 * ⛔ `line_pushes_back` stays QUIET on purpose. It is what every other site sells as
 * "reverse line movement" and it is the single biggest category on a real board (38 of 168
 * rows, 23%). Something that common is a description, not an alert.
 */
export const CATEGORY_EMPHASIS: Record<PublicCategory, CategoryEmphasis> = {
  sharp_money: 'loud',
  money_no_move: 'medium',
  hammered: 'medium',
  line_fights_money: 'quiet',
  public_loading: 'quiet',
  consensus: 'quiet',
  line_pushes_back: 'quiet',
  public: 'quiet',
  split: 'none',
};

/** Feed order. Lower leads. */
export const CATEGORY_RANK: Record<PublicCategory, number> = {
  sharp_money: 0,
  money_no_move: 1,
  hammered: 2,
  line_fights_money: 3,
  public_loading: 4,
  consensus: 5,
  line_pushes_back: 6,
  public: 7,
  split: 8,
};

export const PUBLIC_SPORTS: PublicSport[] = ['nfl', 'cfb', 'nba', 'ncaab'];

export const PUBLIC_MARKETS: PublicMarket[] = ['spread', 'total', 'ml'];

export const SPORT_LABELS: Record<PublicSport, string> = {
  nfl: 'NFL',
  cfb: 'CFB',
  nba: 'NBA',
  ncaab: 'NCAAB',
};

export const SORT_LABELS: Record<BoardSort, string> = {
  sharp: 'Sharp',
  time: 'Time',
  tickets: 'Tickets',
  money: 'Money %',
  diff: 'Difference',
};

export const MARKET_LABELS: Record<PublicMarket, string> = {
  spread: 'Spread',
  total: 'Total',
  ml: 'Moneyline',
};

export const MARKET_NOUN: Record<PublicMarket, string> = {
  spread: 'spread',
  total: 'total',
  ml: 'moneyline',
};

/**
 * One exported threshold table. Nothing in the signal path inlines these.
 * Ticket cuts match the existing splits widget's heavy / lean / even bands.
 */
export const THRESHOLDS = {
  /** money share minus ticket share on the same side */
  DIVERGE_TILT: 10,
  /** emphasis and sort only — never a different sentence */
  STRONG_TILT: 20,
  /** ⛔ describes the crowd. Never gates the money read. */
  HEAVY_TICKETS: 60,
  /** Smallest move that counts as the line following. Points, or implied-probability for ml. */
  CONFIRM_MOVE: { spread: 0.5, total: 0.5, ml: 0.02 } as const,
  STRONG_MOVE: { spread: 1.5, total: 1.5, ml: 0.05 } as const,
  /** the one volume guard */
  MIN_TICKETS: 200,
  /**
   * ⛔ A label inside `split` only. `lead > LEAN_TICKETS` prints "Leaning {side}".
   * It never decides whether a row is on the board or which money category fires.
   */
  LEAN_TICKETS: 55,
  /**
   * ⛔ MONEYLINE ONLY. The ML crowd piles onto favourites, so splits run 1/99 and a single
   * large dog bet fakes a 70pp divergence — Old Dominion @ LA Tech: 4% of tickets, 79% of
   * the money, which is one bet. Applied to every market this was wrongly dropping 25
   * legitimate 10/90 and 12/88 football games.
   */
  ML_MIN_MINORITY: 15,
} as const;

/** A row from `action_public_splits_board`. The view already deduped the log. */
export interface BoardRow {
  game_id: number;
  market: PublicMarket;
  sport: PublicSport;
  season: number | null;
  week: number | null;
  slate_date: string | null;
  start_time: string | null;
  game_type: string | null;
  away: string;
  home: string;
  snap_ts: string;
  away_open: number | null;
  home_open: number | null;
  /**
   * ⛔ THE CURRENT LINE. Action Network's consensus book (15) — a real posted half-point
   * number, and the same book the percentages come from. `*_close` below is BEST ODDS PER
   * SIDE and holds a different value on each side, so splitting the two to recover a line
   * produces quarter points no book posts. Price, not value, on `ml` rows.
   */
  away_cons: number | null;
  home_cons: number | null;
  away_cons_price: number | null;
  home_cons_price: number | null;
  away_close: number | null;
  home_close: number | null;
  away_price: number | null;
  home_price: number | null;
  bets_away: number | null;
  bets_home: number | null;
  money_away: number | null;
  money_home: number | null;
  tickets: number | null;
  has_split: boolean | null;
}

export interface MarketRead {
  market: PublicMarket;
  /** Side with more tickets. Null when the two sides are equal. */
  ticketSide: PublicSide | null;
  ticketLead: number;
  /** Side whose money share exceeds its ticket share. Null when they match. */
  moneyTiltSide: PublicSide | null;
  /** money% − bets% on `moneyTiltSide`. Zero when there is no tilt. */
  tiltPp: number;
  /** Side the line moved toward. Null when the opener is missing or the line is flat. */
  movedToward: PublicSide | null;
  /** Absolute size of the move. Points for spread/total, implied-probability (0–1) for ml. */
  moveSize: number | null;
  /** Away spread, the total, or the away price at the open. */
  open: number | null;
  /**
   * Current away spread, the total, or the away price — all from the consensus book, so
   * always a real posted number. A spread's home number is `homeCurrent`.
   */
  current: number | null;
  /** Home spread or home price at the open. Null on a total. */
  homeOpen: number | null;
  /** Home spread consensus, or the home price. Null on a total. */
  homeCurrent: number | null;
  betsAway: number;
  betsHome: number;
  moneyAway: number;
  moneyHome: number;
  category: PublicCategory | null;
  /** Rendering weight for this category. `none` means render no chip at all. */
  emphasis: CategoryEmphasis;
  /** `sharp_money` with a wide tilt AND a wide move. Sort and emphasis only — same sentence. */
  strong: boolean;
  chip: string;
  /** Second chip fragment, e.g. "line moving away". Empty otherwise. */
  chipNote: string;
  sentence: string;
  excluded: boolean;
  sideName: Record<PublicSide, string>;
}

export interface PublicMarketSlot {
  row: BoardRow;
  read: MarketRead;
}

export interface PublicGame {
  id: string;
  gameId: number;
  sport: PublicSport;
  away: TeamRef;
  home: TeamRef;
  startTime: string | null;
  /** Newest snap across the markets this game actually has. Never an average. */
  capturedAt: string | null;
  tickets: number | null;
  markets: Partial<Record<PublicMarket, PublicMarketSlot>>;
}
