// Editor's Picks types

export interface EditorPick {
  id: string;
  game_id: string;
  game_type: 'nfl' | 'cfb' | 'nba' | 'ncaab';
  editor_id: string;
  selected_bet_type: 'spread' | 'over_under' | 'moneyline' | string;
  editors_notes: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  betslip_links?: Record<string, string> | null;
  pick_value?: string | null;
  best_price?: string | null;
  sportsbook?: string | null;
  units?: number | null;
  is_free_pick?: boolean;
  archived_game_data?: any;
  bet_type?: string | null;
  result?: 'won' | 'lost' | 'push' | 'pending' | null;
}

export interface GameData {
  away_team: string;
  home_team: string;
  away_logo?: string;
  home_logo?: string;
  game_date?: string;
  game_time?: string;
  raw_game_date?: string; // Raw date for comparison (YYYY-MM-DD or ISO string)
  away_spread?: number | null;
  home_spread?: number | null;
  over_line?: number | null;
  away_ml?: number | null;
  home_ml?: number | null;
  opening_spread?: number | null;
  home_team_colors: { primary: string; secondary: string };
  away_team_colors: { primary: string; secondary: string };
}

