import type { PitchHand } from '@/types/mlbF5Splits';

export type PitcherArchetypeType =
  | 'Power'
  | 'Groundball'
  | 'Flyball'
  | 'Control'
  | 'Finesse'
  | 'Balanced'
  | 'Insufficient';

export interface PitcherArchetypeProfile {
  pitcher_id: number;
  archetype: PitcherArchetypeType;
  k_pct: number | null;
  gb_pct: number | null;
  fb_pct: number | null;
  bb_pct: number | null;
  max_fb_velo: number | null;
}

export interface PitcherBattedBallRow {
  pitcher_id: number;
  season: number;
  vs_batter_hand: 'A' | 'R' | 'L' | string | null;
  batters_faced: number;
  xwoba_allowed: number | null;
  woba_allowed: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  gb_pct: number | null;
  fb_pct: number | null;
  hr_per_fb_pct: number | null;
  barrel_pct?: number | null;
}

export interface PitcherArsenalRow {
  pitcher_id: number;
  pitch_type: string;
  pitch_type_label: string;
  vs_batter_hand: 'A' | 'R' | 'L' | string | null;
  pitches_thrown: number;
  usage_pct: number | null;
  avg_velo?: number | null;
  avg_spin_rpm?: number | null;
  avg_horizontal_break?: number | null;
  avg_vertical_break?: number | null;
  whiff_pct: number | null;
  xwoba_allowed: number | null;
  gb_pct: number | null;
  fb_pct: number | null;
  ld_pct?: number | null;
  hr_per_fb_pct: number | null;
}

export interface LineupRow {
  game_pk: number;
  team_id: number;
  player_id: number;
  player_name: string;
  batting_order: number;
  position: string | null;
  bat_side: 'R' | 'L' | 'S' | string | null;
  is_confirmed: boolean;
}

export interface BatterRecentForm {
  batter_id: number;
  pa: number;
  bbe: number;
  avg_exit_velo: number | null;
  hard_hit_pct: number | null;
  barrel_pct: number | null;
  pull_air_pct: number | null;
  k_pct: number | null;
  xwoba: number | null;
}

export interface BatterSplitRow {
  batter_id: number;
  batter_name: string;
  has_split: boolean;
  batting_order?: number;
  position?: string | null;
  bat_side?: string | null;
  vs_pitcher_hand: 'R' | 'L';
  pa: number;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  iso: number | null;
  woba: number | null;
  babip: number | null;
  xwoba: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  avg_exit_velo: number | null;
  barrel_pct: number | null;
  hard_hit_pct: number | null;
  gb_pct: number | null;
  fb_pct: number | null;
  ld_pct: number | null;
  iffb_pct: number | null;
  pull_pct: number | null;
  pull_air_pct: number | null;
  center_pct: number | null;
  oppo_pct: number | null;
  hr_per_pa: number | null;
  hr_per_fb_pct: number | null;
  recent_form?: BatterRecentForm | null;
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
  xwoba: number | null;
  whiff_pct: number | null;
  gb_pct: number | null;
  fb_pct: number | null;
  hr_per_fb_pct: number | null;
}

export interface BatterVsArchetypeRow {
  batter_id: number;
  season: number;
  vs_pitcher_hand: 'R' | 'L';
  archetype: string;
  pa: number;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  xwoba: number | null;
  k_pct: number | null;
  barrel_pct: number | null;
  hard_hit_pct: number | null;
  hr_per_pa: number | null;
}

export interface PitcherMatchupGame {
  game_pk: number;
  official_date: string;
  game_time_et: string | null;
  away_team_id: number | null;
  home_team_id: number | null;
  away_team_name: string;
  home_team_name: string;
  away_abbr: string;
  home_abbr: string;
  away_sp_id: number;
  home_sp_id: number;
  away_sp_name: string;
  home_sp_name: string;
  away_sp_hand: PitchHand;
  home_sp_hand: PitchHand;
}

export interface PitcherMatchupSummary {
  game: PitcherMatchupGame;
  awayLineup: LineupRow[];
  homeLineup: LineupRow[];
  awayPitcher: {
    archetype: PitcherArchetypeProfile | null;
    battedBall: PitcherBattedBallRow | null;
    arsenal: PitcherArsenalRow[];
    topOpposingBatters: BatterSplitRow[];
    batterVsPitchByBatter: Record<number, BatterVsPitchTypeRow[]>;
    batterVsArchetypeByBatter: Record<number, BatterVsArchetypeRow>;
  };
  homePitcher: {
    archetype: PitcherArchetypeProfile | null;
    battedBall: PitcherBattedBallRow | null;
    arsenal: PitcherArsenalRow[];
    topOpposingBatters: BatterSplitRow[];
    batterVsPitchByBatter: Record<number, BatterVsPitchTypeRow[]>;
    batterVsArchetypeByBatter: Record<number, BatterVsArchetypeRow>;
  };
}

export interface TopPlayEntry {
  player_id: number;
  player_name: string;
  team_name: string;
  game_pk: number;
  score: number;
  context: string;
  detail: string;
}

export interface TopPlays {
  hrThreats: TopPlayEntry[];
  hitLeans: TopPlayEntry[];
  hottestHitters: TopPlayEntry[];
  pitcherPlays: TopPlayEntry[];
  kProps: TopPlayEntry[];
}
