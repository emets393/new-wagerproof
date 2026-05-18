/** Row shape from `public.mv_mlb_f5_team_splits`. */
export interface F5SplitRow {
  team_abbr: string;
  season: number;
  home_away: 'home' | 'away';
  opp_sp_hand: 'R' | 'L';
  games: number;
  f5_wins: number;
  f5_losses: number;
  f5_ties: number;
  f5_record: string;
  f5_win_pct: number;
  f5_overs: number;
  f5_unders: number;
  f5_pushes: number;
  f5_ou_record: string;
  f5_over_pct: number;
  avg_f5_rs: number;
  avg_f5_total: number;
  avg_f5_line: number;
  f5_line_edge: number;
  avg_f5_ra_when_own_rhp: number | null;
  games_with_own_rhp: number;
  avg_f5_ra_when_own_lhp: number | null;
  games_with_own_lhp: number;
  season_avg_f5_rs: number;
  season_avg_f5_ra: number;
  season_avg_f5_total: number;
  rs_diff_vs_season: number;
  total_diff_vs_season: number;
  ra_diff_vs_season_when_own_rhp: number | null;
  ra_diff_vs_season_when_own_lhp: number | null;
  last_refreshed_at: string;
}

export type PitchHand = 'R' | 'L' | null;

export interface TodaysMlbGameForF5 {
  game_pk: number;
  official_date: string;
  game_time_et: string | null;
  away_team_name: string;
  home_team_name: string;
  venue_name: string | null;
  away_sp_name: string | null;
  home_sp_name: string | null;
  away_abbr: string;
  home_abbr: string;
  away_sp_hand: PitchHand;
  home_sp_hand: PitchHand;
  total_line: number | null;
  f5_total_line: number | null;
  f5_away_ml: number | null;
  f5_home_ml: number | null;
}

export const F5_SPLIT_MIN_GAMES = 3;
