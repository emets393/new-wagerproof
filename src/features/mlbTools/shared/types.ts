/**
 * Shared model for the per-game MLB tool split views (/mlb/f5-splits,
 * /mlb/pitcher-matchups). Each tool feeds its own domain rows into these shapes
 * so one feed panel, one list card and one detail shell serve every tool.
 */

export interface MlbToolTeam {
  /** Full club name as the source table spells it. */
  name: string;
  /** Game-log abbreviation (AZ / ATH canonical, see toF5SplitTeamAbbr). */
  abbrev: string;
  logoUrl: string | null;
  colors: { primary: string; secondary: string };
}

/** One row in a tool's left-hand feed. */
export interface MlbToolFeedItem {
  /** URL-safe selection id — the game_pk as a string. */
  id: string;
  gamePk: number;
  away: MlbToolTeam;
  home: MlbToolTeam;
  /** YYYY-MM-DD */
  gameDate: string;
  /** Human label, e.g. "7:05 PM ET". */
  gameTimeLabel: string;
  /** Sortable within-day key (ISO timestamp when known, else the date). */
  timeSortKey: string;
}

export interface MlbToolDateGroup<T extends MlbToolFeedItem> {
  date: string;
  label: string;
  games: T[];
}
