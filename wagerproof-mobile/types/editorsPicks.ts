// Editor's Picks types

export interface EditorPick {
  id: string;
  game_id: string;
  game_type: 'nfl' | 'cfb';
  editor_id: string;
  selected_bet_type: string;
  editors_notes: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface GameData {
  away_team: string;
  home_team: string;
  away_logo?: string;
  home_logo?: string;
  game_date?: string;
  game_time?: string;
  away_spread?: number | null;
  home_spread?: number | null;
  over_line?: number | null;
  away_ml?: number | null;
  home_ml?: number | null;
  opening_spread?: number | null;
  home_team_colors: { primary: string; secondary: string };
  away_team_colors: { primary: string; secondary: string };
}

