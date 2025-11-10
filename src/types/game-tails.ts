export interface GameTail {
  id: string;
  user_id: string;
  game_unique_id: string;
  sport: string;
  team_selection: 'home' | 'away';
  pick_type: 'moneyline' | 'spread' | 'over_under';
  created_at: string;
  user?: {
    display_name?: string;
    email?: string;
  };
}

export interface TailingUser {
  user_id: string;
  display_name?: string;
  email?: string;
}

export interface GameTailsGrouped {
  pickType: string;
  teamSelection: 'home' | 'away';
  count: number;
  users: TailingUser[];
}

