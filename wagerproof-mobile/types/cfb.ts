export interface CFBPrediction {
  id: string;
  away_team: string;
  home_team: string;
  home_ml: number | null;
  away_ml: number | null;
  home_spread: number | null;
  away_spread: number | null;
  over_line: number | null;
  game_date: string;
  game_time: string;
  training_key: string;
  unique_id: string;
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  run_id: string | null;
  temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  icon: string | null;
  spread_splits_label: string | null;
  total_splits_label: string | null;
  ml_splits_label: string | null;
  conference?: string | null;
  // CFB-specific prediction fields
  pred_away_score?: number | null;
  pred_home_score?: number | null;
  pred_spread?: number | null;
  home_spread_diff?: number | null;
  pred_total?: number | null;
  total_diff?: number | null;
  pred_over_line?: number | null;
  over_line_diff?: number | null;
}

