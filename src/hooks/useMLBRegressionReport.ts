import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

export interface PitcherRegression {
  pitcher_name: string;
  team_name: string;
  opponent: string | null;
  starts: number;
  ip: number;
  // Season
  era: number;
  xfip: number;
  xera: number | null;
  fip: number | null;
  whip: number | null;
  era_minus_xfip: number;
  xwoba: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  hard_hit_pct: number | null;
  barrel_pct: number | null;
  hr_per_9: number | null;
  // Last 3 starts
  l3_era: number | null;
  l3_xfip: number | null;
  l3_xera: number | null;
  l3_xwoba: number | null;
  l3_fip: number | null;
  l3_whip: number | null;
  // Trends (last3 − season; positive = worse, negative = better)
  trend_era: number | null;
  trend_xfip: number | null;
  trend_xera: number | null;
  trend_xwoba: number | null;
  trend_fip: number | null;
  trend_whip: number | null;
  severity: 'severe' | 'moderate' | 'mild';
  severity_score: number;
}

export interface BattingRegression {
  team_name: string;
  today_vs_pitcher: string | null;
  games: number;
  avg_runs?: number;            // legacy — no longer populated by the backend
  batting_avg: number | null;
  babip: number;
  xwobacon: number | null;
  woba: number | null;
  woba_gap: number | null;
  hard_hit_pct: number | null;
  barrel_pct: number | null;
  avg_ev: number | null;
  launch_angle: number | null;
  slg: number | null;
  obp: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  hr: number;
  hr_per_game: number | null;
  // Last 5
  l5_woba?: number | null;
  l5_xwobacon?: number | null;
  l5_hard_hit_pct?: number | null;
  l5_barrel_pct?: number | null;
  l5_avg_ev?: number | null;
  l5_bb_pct?: number | null;
  // Trends
  trend_woba?: number | null;
  trend_xwobacon?: number | null;
  trend_hard_hit_pct?: number | null;
  trend_barrel_pct?: number | null;
  trend_avg_launch_speed?: number | null;
  severity?: 'severe' | 'moderate' | 'mild';
  severity_score?: number;
}

export interface BullpenFatigue {
  team_name: string;
  bp_ip_last3d: number;
  bp_ip_last5d: number;
  bp_ip_last7d: number;
  season_bp_xfip: number | null;
  trend_bp_xfip: number | null;
  season_bp_xera: number | null;
  trend_bp_xera: number | null;
  flag: 'overworked' | 'trending_worse';
  flags: string[];
  trending: 'declining' | 'improving' | null;
}

export interface SuggestedPick {
  game_pk: number;
  bet_type: 'full_ml' | 'full_ou' | 'full_rl' | 'f5_ml' | 'f5_ou' | 'f5_rl';
  pick: string;
  matchup: string;
  home_team: string;
  away_team: string;
  game_time_et: string | null;
  game_number: number;
  model_prob: number | null;
  fair_value: number | null;
  edge_at_suggestion: number;
  line_at_suggestion: number | null;
  edge_bucket: string;
  bucket_win_pct: number;
  bucket_sample: number;
  confidence_at_suggestion: 'high' | 'moderate';
  reasoning: string;
  home_sp: string | null;
  away_sp: string | null;
  first_suggested_at: string;
  locked: boolean;
}

export interface YesterdayRecap {
  game_pk: number;
  bet_type: string;
  pick: string;
  matchup: string;
  result: 'won' | 'lost' | 'push';
  actual_score: string;
  confidence: string | null;
  edge_bucket: string | null;
}

export interface AccuracyBucket {
  bucket: string;
  direction?: string;
  side?: string;
  fav_dog?: string;
  games: number;
  wins: number;
  win_pct: number;
}

export interface BetTypeAccuracy {
  overall: { games: number; wins: number; win_pct: number };
  by_bucket: AccuracyBucket[];
}

export interface ModelAccuracy {
  full_ml: BetTypeAccuracy;
  full_ou: BetTypeAccuracy;
  f5_ml: BetTypeAccuracy;
  f5_ou: BetTypeAccuracy;
}

export interface CumulativeBucket {
  wins: number;
  losses: number;
  pushes: number;
  units_won: number;
  win_pct: number;
  roi_pct: number;
}

export interface CumulativeRecord {
  total: CumulativeBucket;
  by_bet_type: Record<string, CumulativeBucket>;
  daily_log: Array<{
    date: string;
    wins: number;
    losses: number;
    pushes: number;
    units_won?: number;
    cumulative_win_pct: number;
    cumulative_units?: number;
  }>;
}

export interface PerfectStorm {
  game_pk: number;
  matchup: string;
  direction: string;
  storm_score: number;
  pitcher: PitcherRegression;
  batting: BattingRegression;
  narrative: string;
  suggested_pick?: SuggestedPick | null;
}

export interface WeatherParkFlag {
  game_pk: number;
  matchup: string;
  venue: string;
  temperature_f: number | null;
  wind_speed_mph: number | null;
  wind_direction: string | null;
  park_factor_runs: number | null;
  flags: string[];
}

export interface LRSplitEntry {
  team_name: string;
  opponent: string;
  opponent_sp: string | null;
  opponent_sp_hand: string;
  facing: string;
  home_away: string;
  f5_games: number;
  avg_f5_runs: number;
  f5_wins: number;
  f5_losses: number;
  f5_ties: number;
  f5_win_pct: number | null;
  is_notable: boolean;
}

export interface MLBRegressionReport {
  report_date: string;
  season: number;
  todays_slate: any[];
  pitcher_negative_regression: PitcherRegression[];
  pitcher_positive_regression: PitcherRegression[];
  batting_heat_up: BattingRegression[];
  batting_cool_down: BattingRegression[];
  bullpen_fatigue: BullpenFatigue[];
  perfect_storm_matchups: PerfectStorm[];
  suggested_picks: SuggestedPick[];
  yesterday_recap: YesterdayRecap[];
  cumulative_record: CumulativeRecord;
  perfect_storm_record?: CumulativeBucket;
  model_accuracy: ModelAccuracy;
  weather_park_flags: WeatherParkFlag[];
  lr_splits_today: LRSplitEntry[];
  narrative_text: string | null;
  narrative_model: string | null;
  generated_at: string;
  generation_version: number;
}

function getTodayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function useMLBRegressionReport() {
  return useQuery<MLBRegressionReport | null>({
    queryKey: ['mlb-regression-report', getTodayET()],
    queryFn: async () => {
      const today = getTodayET();
      const { data, error } = await collegeFootballSupabase
        .from('mlb_regression_report')
        .select('*')
        .eq('report_date', today)
        .maybeSingle();

      if (error) throw error;
      return data as MLBRegressionReport | null;
    },
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    staleTime: 5 * 60 * 1000,
  });
}
