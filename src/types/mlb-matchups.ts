export type BatterHand = 'A' | 'R' | 'L';
export type PitchHand = 'R' | 'L';

export type PitcherArchetypeType =
  | 'Power'
  | 'Groundball'
  | 'Flyball'
  | 'Control'
  | 'Finesse'
  | 'Balanced'
  | 'Insufficient';

export interface PitcherArchetypeProfile {
  archetype: PitcherArchetypeType;
  k_pct: number | null;
  gb_pct: number | null;
  fb_pct: number | null;
  bb_pct: number | null;
  max_fb_velo: number | null;
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

export interface PitcherArsenalRow {
  pitcher_id: number;
  pitcher_name: string;
  pitch_hand: PitchHand | null;
  pitch_type: string;
  pitch_type_label: string;
  vs_batter_hand: BatterHand;
  pitches_thrown: number;
  usage_pct: number | null;
  avg_velo: number | null;
  avg_spin_rpm: number | null;
  avg_horizontal_break: number | null;
  avg_vertical_break: number | null;
  whiff_pct: number | null;
  put_away_pct: number | null;
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

export interface PitcherArsenalByHand {
  A: PitcherArsenalRow[];
  R: PitcherArsenalRow[];
  L: PitcherArsenalRow[];
}

export interface PitcherBattedBallRow {
  pitcher_id: number;
  pitcher_name?: string;
  pitch_hand?: PitchHand | null;
  vs_batter_hand: BatterHand;
  batters_faced: number;
  k_pct: number | null;
  bb_pct: number | null;
  gb_pct: number | null;
  fb_pct: number | null;
  ld_pct: number | null;
  hr_per_fb_pct: number | null;
  barrel_pct: number | null;
  woba_allowed: number | null;
  xwoba_allowed: number | null;
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
  source?: string;
}

export type PlatoonSignal =
  | 'strong_advantage'
  | 'advantage'
  | 'neutral'
  | 'disadvantage'
  | 'strong_disadvantage'
  | 'reverse_split'
  | 'small_sample';

export interface BatterSplitRow {
  batter_id: number;
  batter_name: string;
  bat_side: 'R' | 'L' | 'S' | null;
  vs_pitcher_hand: BatterHand;
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
  other_hand_pa: number | null;
  other_hand_avg: number | null;
  other_hand_slg: number | null;
  other_hand_ops: number | null;
  other_hand_woba: number | null;
  other_hand_xwoba: number | null;
  avg_delta_vs_other_hand: number | null;
  slg_delta_vs_other_hand: number | null;
  ops_delta_vs_other_hand: number | null;
  iso_delta_vs_other_hand: number | null;
  woba_delta_vs_other_hand: number | null;
  xwoba_delta_vs_other_hand: number | null;
  platoon_signal: PlatoonSignal | null;
  /** L10 split vs opposing starter hand (from `mlb_batter_recent_form`). */
  recent_form?: BatterRecentForm;
}

/** Row from `public.mlb_batter_recent_form` (L10 vs pitcher hand). */
export interface BatterRecentForm {
  batter_id: number;
  season?: number;
  vs_pitcher_hand: BatterHand;
  window_games: number;
  games_used: number;
  pa: number;
  bbe: number;
  avg_exit_velo: number | null;
  hard_hit_pct: number | null;
  barrel_pct: number | null;
  pull_air_pct: number | null;
  gb_pct: number | null;
  fb_pct: number | null;
  ld_pct: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  xwoba: number | null;
  as_of_date: string | null;
}

/** @deprecated Use BatterRecentForm */
export type BatterRecentFormRow = BatterRecentForm;

export interface BatterVsPitchTypeRow {
  batter_id: number;
  vs_pitcher_hand: PitchHand;
  pitch_type: string;
  pitch_type_label: string;
  pitches_seen: number;
  pa: number;
  avg: number | null;
  slg: number | null;
  woba: number | null;
  xwoba: number | null;
  k_pct: number | null;
  whiff_pct: number | null;
  gb_pct: number | null;
  fb_pct: number | null;
  hr_per_fb_pct: number | null;
}

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

export interface Insight {
  id: string;
  icon: string;
  tone: 'positive' | 'warn' | 'danger' | 'neutral';
  scope: 'game' | 'pitcher' | 'batter';
  pitcher_id?: number;
  batter_id?: number;
  /** Pitcher's team or lineup team for game-level matchup chips */
  team_abbrev?: string;
  team_name?: string;
  priority: number;
  headline: string;
  detail: string;
  dedupeKey?: string;
}

export interface TopPlayBreakdownLine {
  component: string;
  value: number;
  detail?: string;
}

export interface TopPlayEntry {
  player_id: number;
  player_name: string;
  team_name: string;
  game_pk: number;
  score: number;
  context: string;
  breakdown: TopPlayBreakdownLine[];
  /** Opposing starter archetype for HR/hit lean filter chips */
  opposing_pitcher_archetype?: string;
}

export interface PowerStackAlert {
  team_name: string;
  game_pk: number;
  hr_count: number;
  opp_pitcher: string;
  stack_strength: number;
  top_hitters: { player_name: string; score: number }[];
}

export interface TopPlays {
  hr_threats: TopPlayEntry[];
  hit_leans: TopPlayEntry[];
  pitcher_plays: TopPlayEntry[];
  k_props: TopPlayEntry[];
  hottest_hitters: TopPlayEntry[];
  power_stacks: PowerStackAlert[];
}

export interface LeagueBenchmarkPercentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export type LeagueBenchmarks = Record<string, LeagueBenchmarkPercentiles>;

export interface PitcherMatchupData {
  awayArsenal: PitcherArsenalByHand;
  homeArsenal: PitcherArsenalByHand;
  awayBattedBall: PitcherBattedBallProfile;
  homeBattedBall: PitcherBattedBallProfile;
  awayLineup: LineupRow[];
  homeLineup: LineupRow[];
  awayLineupSplits: BatterSplitRow[];
  homeLineupSplits: BatterSplitRow[];
  awayBatterVsPitch: BatterVsPitchTypeRow[];
  homeBatterVsPitch: BatterVsPitchTypeRow[];
  awayArchetype: PitcherArchetypeProfile | null;
  homeArchetype: PitcherArchetypeProfile | null;
  /** Home lineup batters vs away pitcher archetype */
  homeVsArchetypeByBatter: Record<number, BatterVsArchetypeRow>;
  /** Away lineup batters vs home pitcher archetype */
  awayVsArchetypeByBatter: Record<number, BatterVsArchetypeRow>;
}

/** @deprecated use awayLineupSplits */
export type PitcherMatchupDataLegacy = PitcherMatchupData & {
  awayBatterSplits: BatterSplitRow[];
  homeBatterSplits: BatterSplitRow[];
};
