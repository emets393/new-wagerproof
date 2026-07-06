/**
 * Unified game-feed model for the /games split view. Each sport's adapter in
 * ./api ports its legacy page's fetch+merge logic and maps rows into
 * GameFeedItem so one card/list implementation serves all five sports.
 * Sport-specific detail sections read the merged row from `raw`.
 */

export type GamesSport = 'nfl' | 'cfb' | 'nba' | 'ncaab' | 'mlb';

export const GAMES_SPORTS: GamesSport[] = ['nfl', 'cfb', 'nba', 'ncaab', 'mlb'];

export const SPORT_LABELS: Record<GamesSport, string> = {
  nfl: 'NFL',
  cfb: 'CFB',
  nba: 'NBA',
  ncaab: 'NCAAB',
  mlb: 'MLB',
};

export type GamesSortKey = 'time' | 'ml' | 'spread' | 'ou';

export interface TeamRef {
  /** Display name as used by the sport's tables (e.g. NFL city, NBA team name). */
  name: string;
  abbrev: string;
  logoUrl: string | null;
  colors: { primary: string; secondary: string };
}

export interface GameLines {
  homeML: number | null;
  awayML: number | null;
  homeSpread: number | null;
  awaySpread: number | null;
  total: number | null;
}

export interface GameEdges {
  /** Model-vs-Vegas spread delta (home perspective), null when model data missing. */
  spreadEdge: number | null;
  /** Model-vs-Vegas total delta (positive = model likes Over). */
  totalEdge: number | null;
  /** Raw model ML probability (home side); display uses max(p, 1-p). */
  mlProb: number | null;
}

export interface GameFeedItem<TRaw = Record<string, unknown>> {
  sport: GamesSport;
  /** URL-safe stable id (training_key / game_id / game_pk). */
  id: string;
  awayTeam: TeamRef;
  homeTeam: TeamRef;
  /** YYYY-MM-DD */
  gameDate: string;
  /** Human label, e.g. "8:15 PM EST" or "TBD". */
  gameTimeLabel: string;
  /** Sortable within-day key (the legacy pages compare game_time strings). */
  timeSortKey: string;
  status: 'scheduled' | 'postponed';
  lines: GameLines;
  edges: GameEdges;
  /** Full merged row from the sport's legacy fetch — detail sections cast this. */
  raw: TRaw;
}

export interface SportFeed<TRaw = Record<string, unknown>> {
  games: GameFeedItem<TRaw>[];
  /**
   * Sport-specific side payload needed by detail sections
   * (e.g. NFL team mappings for line-movement logos, NCAAB espn URL map).
   */
  extras: Record<string, unknown>;
  fetchedAt: number;
}
