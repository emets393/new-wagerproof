export interface LiveGame {
  id: string;
  game_id: string;
  league: 'NFL' | 'NCAAF';
  away_team: string;
  away_abbr: string;
  away_score: number;
  away_color?: string;
  home_team: string;
  home_abbr: string;
  home_score: number;
  home_color?: string;
  status: string;
  period?: string;
  time_remaining?: string;
  is_live: boolean;
  last_updated?: string;
}

export interface ESPNCompetition {
  id: string;
  status: {
    type: {
      name: string;
      state: string;
      completed: boolean;
      description: string;
      detail: string;
      shortDetail: string;
    };
    period: number;
    displayClock: string;
  };
  competitors: Array<{
    id: string;
    team: {
      id: string;
      displayName: string;
      abbreviation: string;
      color?: string;
      alternateColor?: string;
    };
    score: string;
    homeAway: 'home' | 'away';
  }>;
}

export interface ESPNScoreboard {
  events: Array<{
    id: string;
    competitions: ESPNCompetition[];
  }>;
}

