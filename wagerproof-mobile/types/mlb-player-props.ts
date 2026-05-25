export type MlbPlayerPropMarket =
  | 'batter_home_runs'
  | 'batter_hits'
  | 'batter_total_bases'
  | 'batter_rbis'
  | 'batter_hits_runs_rbis'
  | 'batter_walks'
  | 'batter_strikeouts'
  | 'pitcher_strikeouts'
  | 'pitcher_hits_allowed'
  | 'pitcher_walks'
  | 'pitcher_outs';

export interface MlbPlayerPropLineEntry {
  line: number;
  over: number | null;
  under: number | null;
}

export interface MlbPlayerPropGameEntry {
  v: number;
  d: 0 | 1;
  a: string | null;
  dt?: string | null;
}

export interface MlbPlayerPropRow {
  player_id: number;
  player_name: string;
  is_pitcher: boolean;
  market: MlbPlayerPropMarket | string;
  game_is_day: boolean;
  opp_archetype_today: string | null;
  lines: MlbPlayerPropLineEntry[];
  games: MlbPlayerPropGameEntry[];
}

export interface PropHitSplit {
  over: number;
  games: number;
  pct: number | null;
}

export interface PropComputedAtLine {
  line: number;
  overOdds: number | null;
  underOdds: number | null;
  l10: PropHitSplit;
  season: PropHitSplit;
  contextualDayNight: PropHitSplit | null;
  contextualArchetype: PropHitSplit | null;
  chartGames: { value: number; cleared: boolean; isDay: boolean; archetype: string | null; date: string | null }[];
  miniStrip: { cleared: boolean; value: number }[];
}

export interface TopPropPlay {
  gamePk: number;
  playerId: number;
  playerName: string;
  market: string;
  line: number;
  l10Over: number;
  l10Games: number;
  pct: number;
  isPitcher: boolean;
}
