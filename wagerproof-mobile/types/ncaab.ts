export interface NCAABGame {
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
  // Rankings
  home_ranking: number | null;
  away_ranking: number | null;
  // Context
  conference_game: boolean | null;
  neutral_site: boolean | null;
  // Model predictions
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  pred_home_margin: number | null;
  pred_total_points: number | null;
  run_id: string | null;
  // Predicted scores
  home_score_pred: number | null;
  away_score_pred: number | null;
  model_fair_home_spread: number | null;
}

