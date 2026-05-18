export interface PitcherArsenalRow {
  pitcher_id: number;
  pitcher_name: string;
  pitch_hand: 'R' | 'L' | null;
  pitch_type: string;
  pitch_type_label: string;
  pitches_thrown: number;
  usage_pct: number | null;
  avg_velo: number | null;
  avg_spin_rpm: number | null;
  avg_horizontal_break: number | null;
  avg_vertical_break: number | null;
  whiff_pct: number | null;
  xwoba_allowed: number | null;
  hard_hit_pct: number | null;
  gb_pct: number | null;
  fb_pct: number | null;
  ld_pct: number | null;
  iffb_pct: number | null;
  hr_per_fb_pct: number | null;
  barrel_pct: number | null;
  season?: number;
}

export interface PitcherBattedBallRow {
  pitcher_id: number;
  vs_batter_hand: 'A' | 'R' | 'L';
  batters_faced: number;
  gb_pct: number | null;
  fb_pct: number | null;
  ld_pct: number | null;
  hr_per_fb_pct: number | null;
  barrel_pct: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  woba_allowed: number | null;
  xwoba_allowed: number | null;
  season?: number;
}

export interface PitcherBattedBallProfile {
  overall: PitcherBattedBallRow | null;
  vs_R: PitcherBattedBallRow | null;
  vs_L: PitcherBattedBallRow | null;
}

export interface LineupRow {
  game_pk: number;
  team_id: number;
  batting_order: number;
  player_id: number;
  player_name: string;
  position: string | null;
  bat_side: 'R' | 'L' | 'S' | null;
  is_confirmed: boolean;
}

export interface BatterSplitRow {
  batter_id: number;
  batter_name: string;
  bat_side: 'R' | 'L' | 'S' | null;
  vs_pitcher_hand: 'A' | 'R' | 'L';
  pa: number;
  ab: number;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  iso: number | null;
  woba: number | null;
  xwoba: number | null;
  babip: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  home_runs: number;
  hr_per_pa: number | null;
  avg_exit_velo: number | null;
  hard_hit_pct: number | null;
  barrel_pct: number | null;
  gb_pct: number | null;
  fb_pct: number | null;
  ld_pct: number | null;
  iffb_pct: number | null;
  hr_per_fb_pct: number | null;
  pull_pct: number | null;
  pull_air_pct: number | null;
  center_pct: number | null;
  oppo_pct: number | null;
  season_avg_xwoba?: number | null;
}

export interface BatterVsPitchTypeRow {
  batter_id: number;
  vs_pitcher_hand: 'R' | 'L';
  pitch_type: string;
  pitch_type_label: string;
  pitches_seen: number;
  pa: number;
  avg: number | null;
  slg: number | null;
  woba: number | null;
  xwoba: number | null;
  whiff_pct: number | null;
  gb_pct: number | null;
  fb_pct: number | null;
  hr_per_fb_pct: number | null;
}

export type PitchHand = 'R' | 'L';

export interface MatchupGame {
  game_pk: number;
  official_date: string;
  game_time: string | null;
  venue_name: string | null;
  away_team_name: string;
  home_team_name: string;
  away_abbr: string;
  home_abbr: string;
  away_team_id: number;
  home_team_id: number;
  total_line: number | null;
  away_ml: number | null;
  home_ml: number | null;
  wind_speed_mph: number | null;
  wind_direction: string | null;
  temperature_f: number | null;
  away_sp_name: string;
  away_sp_id: number;
  away_sp_hand: PitchHand;
  home_sp_name: string;
  home_sp_id: number;
  home_sp_hand: PitchHand;
}

/** Batter IDs → pitch type labels they hit well among the opposing starter's top 3 pitches. */
export type BatterTopPitchMatchMap = Record<number, string[]>;

export interface PitcherMatchupData {
  awayArsenal: PitcherArsenalRow[];
  homeArsenal: PitcherArsenalRow[];
  awayBattedBall: PitcherBattedBallProfile;
  homeBattedBall: PitcherBattedBallProfile;
  awayLineup: LineupRow[];
  homeLineup: LineupRow[];
  awayBatterSplits: BatterSplitRow[];
  homeBatterSplits: BatterSplitRow[];
  awayBatterVsPitch: BatterVsPitchTypeRow[];
  homeBatterVsPitch: BatterVsPitchTypeRow[];
}

export type InsightTone = 'warn' | 'positive' | 'neutral';

export interface MatchupInsight {
  icon: string;
  tone: InsightTone;
  text: string;
}
