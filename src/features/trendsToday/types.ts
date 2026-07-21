/**
 * Unified model for the /todays-trends split view. Each sport's adapter in
 * ./api ports the query + consensus logic from its legacy page
 * (MLB/NBA/NCAABTodayBettingTrends.tsx) and maps rows into TrendsFeedItem, so
 * one feed card and one set of detail widgets serve all three sports.
 *
 * The key normalization: every sport exposes a "side" market and a "total"
 * market per situational angle. MLB's side market is the moneyline win rate;
 * NBA/NCAAB's is the ATS cover rate. Everything downstream reads `sidePct`.
 */

export type TrendsSport = 'mlb' | 'nba' | 'ncaab';

export const TRENDS_SPORTS: TrendsSport[] = ['mlb', 'nba', 'ncaab'];

export const TRENDS_SPORT_LABELS: Record<TrendsSport, string> = {
  mlb: 'MLB',
  nba: 'NBA',
  ncaab: 'CBB',
};

/** Feed filter value — 'all' merges every sport into one list. */
export type TrendsSportFilter = TrendsSport | 'all';

/** What the side column actually measures, per sport. Used as card captions. */
export const SIDE_MARKET_LABEL: Record<TrendsSport, string> = {
  mlb: 'Moneyline',
  nba: 'Against the spread',
  ncaab: 'Against the spread',
};

/** Short form for tight spots (pill text, column headers). */
export const SIDE_MARKET_SHORT: Record<TrendsSport, string> = {
  mlb: 'ML',
  nba: 'ATS',
  ncaab: 'ATS',
};

export interface TrendsTeam {
  /** Team name as the situational table spells it — the colors tables key off this. */
  name: string;
  abbrev: string;
  logoUrl: string | null;
  colors: { primary: string; secondary: string };
}

/** One team's historical rates inside a single situational angle. */
export interface TrendSideStat {
  /** Human-readable situation this team is in today, e.g. "After loss". */
  situation: string;
  /** Side-market hit rate: MLB moneyline win %, hoops ATS cover %. */
  sidePct: number | null;
  /** "15-3-0" where the source carries records (hoops only); MLB has rates only. */
  sideRecord: string | null;
  /** Sample size behind sideRecord; null when the source has no record string. */
  sideGames: number | null;
  overPct: number | null;
  /** Hoops carry an explicit under rate; MLB's is implied (100 - over). */
  underPct: number | null;
  ouRecord: string | null;
  ouGames: number | null;
}

/** One situational angle (e.g. "Rest vs opponent") for both teams. */
export interface TrendAngle {
  key: string;
  label: string;
  away: TrendSideStat;
  home: TrendSideStat;
  /** Team with the higher side rate; null on a tie or missing data. */
  sideLean: 'away' | 'home' | null;
  /** Total consensus for this angle; null when the two teams disagree. */
  ouLean: 'over' | 'under' | null;
}

/** The game-level read, aggregated across every angle. */
export interface TrendsVerdict {
  /** Side the angles collectively favor; null when they split evenly. */
  side: 'away' | 'home' | null;
  /** Angles favoring `side` out of `sideTotal` angles that had data. */
  sideAgree: number;
  sideTotal: number;
  awayAvgSidePct: number | null;
  homeAvgSidePct: number | null;
  /** Average points separating the two teams' side rates. */
  sideMarginPts: number | null;
  total: 'over' | 'under' | null;
  totalAgree: number;
  totalTotal: number;
  awayAvgOverPct: number | null;
  homeAvgOverPct: number | null;
  /** Combined over rate's distance from a coin flip; the "edge" on the total. */
  totalMarginPts: number | null;
}

export interface TrendsFeedItem {
  sport: TrendsSport;
  /** URL-safe id, namespaced by sport so ids can't collide across leagues. */
  id: string;
  away: TrendsTeam;
  home: TrendsTeam;
  /** YYYY-MM-DD */
  gameDate: string;
  /** Human label, e.g. "7:05 PM ET". */
  gameTimeLabel: string;
  /** Sortable within-day key (ISO timestamp when known, else the date). */
  timeSortKey: string;
  angles: TrendAngle[];
  verdict: TrendsVerdict;
  /** Legacy sort scores, ported per sport (see api/scoring.ts). */
  scores: { ouConsensus: number; sideDominance: number };
}

export interface TrendsFeed {
  games: TrendsFeedItem[];
  fetchedAt: number;
}

export type TrendsSortKey = 'time' | 'ou' | 'side';

export const TRENDS_SORT_LABELS: Record<TrendsSortKey, string> = {
  time: 'Game time',
  ou: 'O/U consensus',
  side: 'Side dominance',
};
