// Live scores types ported from web version

export interface PredictionStatus {
  predicted: 'Home' | 'Away' | 'Over' | 'Under';
  isHitting: boolean;
  probability: number;
  line?: number;
  currentDifferential: number;
}

export interface GamePredictions {
  hasAnyHitting: boolean;
  moneyline?: PredictionStatus;
  spread?: PredictionStatus;
  overUnder?: PredictionStatus;
}

export interface LiveGame {
  id: string;
  league: string;
  home_team: string;
  away_team: string;
  home_abbr: string;
  away_abbr: string;
  home_score: number;
  away_score: number;
  quarter: string;
  time_remaining: string;
  is_live: boolean;
  game_status: string;
  last_updated: string;
  predictions?: GamePredictions;
}

