import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

export interface PitcherRegression {
  pitcher_name: string;
  team_name: string;
  opponent: string | null;
  starts: number;
  ip: number;
  era: number;
  xfip: number;
  xera: number | null;
  era_minus_xfip: number;
  xwoba: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  hard_hit_pct: number | null;
  barrel_pct: number | null;
  hr_per_9: number | null;
  severity: 'severe' | 'moderate' | 'mild';
  severity_score: number;
}

export interface BattingRegression {
  team_name: string;
  today_vs_pitcher: string | null;
  games: number;
  avg_runs: number;
  batting_avg: number | null;
  babip: number;
  xwobacon: number | null;
  woba: number | null;
  woba_gap: number | null;
  hard_hit_pct: number | null;
  barrel_pct: number | null;
  avg_ev: number | null;
  slg: number | null;
  obp: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  hr: number;
  hr_per_game: number | null;
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
  bet_type: 'full_ml' | 'full_ou' | 'f5_ml' | 'f5_ou';
  pick: string;
  matchup: string;
  home_team: string;
  away_team: string;
  game_time_et: string | null;
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

export interface CumulativeRecord {
  total: { wins: number; losses: number; pushes: number };
  by_bet_type: Record<string, { wins: number; losses: number; pushes: number }>;
  daily_log: Array<{
    date: string;
    wins: number;
    losses: number;
    pushes: number;
    cumulative_win_pct: number;
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
  model_accuracy: ModelAccuracy;
  weather_park_flags: WeatherParkFlag[];
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
