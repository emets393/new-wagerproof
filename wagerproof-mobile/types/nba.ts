export interface NBAGame {
  id: string;
  game_id: number;
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
  // Team stats
  home_adj_offense: number | null;
  away_adj_offense: number | null;
  home_adj_defense: number | null;
  away_adj_defense: number | null;
  home_adj_pace: number | null;
  away_adj_pace: number | null;
  // Trends
  home_ats_pct: number | null;
  away_ats_pct: number | null;
  home_over_pct: number | null;
  away_over_pct: number | null;
  // Model predictions
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  run_id: string | null;
  // Predicted scores (from nba_predictions)
  home_score_pred: number | null;
  away_score_pred: number | null;
  model_fair_home_spread: number | null;
  model_fair_total: number | null;
}

export interface NBAInjuryReport {
  player_name: string;
  avg_pie_season: string | number | null;
  status: string;
  team_id: number;
  team_name: string;
  team_abbr: string;
}

export interface NBAGameTrends {
  home_ovr_rtg: number | null;
  away_ovr_rtg: number | null;
  home_consistency: number | null;
  away_consistency: number | null;
  home_win_streak: number | null;
  away_win_streak: number | null;
  home_ats_pct: number | null;
  away_ats_pct: number | null;
  home_ats_streak: number | null;
  away_ats_streak: number | null;
  home_last_margin: number | null;
  away_last_margin: number | null;
  home_over_pct: number | null;
  away_over_pct: number | null;
  home_adj_pace_pregame_l3_trend: number | null;
  away_adj_pace_pregame_l3_trend: number | null;
  home_adj_off_rtg_pregame_l3_trend: number | null;
  away_adj_off_rtg_pregame_l3_trend: number | null;
  home_adj_def_rtg_pregame_l3_trend: number | null;
  away_adj_def_rtg_pregame_l3_trend: number | null;
}

