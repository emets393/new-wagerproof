export interface NFLPrediction {
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
  // Model predictions (EPA model)
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  run_id: string | null;
  // Weather data
  temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  icon: string | null;
  // Public betting splits (labels)
  spread_splits_label: string | null;
  total_splits_label: string | null;
  ml_splits_label: string | null;

  // Public betting data - Moneyline (decimal strings, e.g., "0.61" = 61%)
  home_ml_handle: string | null;
  away_ml_handle: string | null;
  home_ml_bets: string | null;
  away_ml_bets: string | null;

  // Public betting data - Spread
  home_spread_handle: string | null;
  away_spread_handle: string | null;
  home_spread_bets: string | null;
  away_spread_bets: string | null;

  // Public betting data - Total
  over_handle: string | null;
  under_handle: string | null;
  over_bets: string | null;
  under_bets: string | null;
}

export interface TeamMapping {
  city_and_name: string;
  team_name: string;
  logo_url: string;
}

export interface TeamColors {
  primary: string;
  secondary: string;
}

