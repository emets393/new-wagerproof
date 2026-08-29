/** Competition pick'em — types mirror MAIN-instance warehouse contract. */

export type CompWeekStatus = 'upcoming' | 'open' | 'locked' | 'graded';
export type CompSport = 'nfl' | 'cfb';
export type CompMarket = 'spread' | 'total';
export type CompSide = 'home' | 'away' | 'over' | 'under';
export type CompPickResult = 'win' | 'loss' | 'push';
export type CompEntryStatus = 'draft' | 'submitted';

export interface CompWeek {
  id: number;
  season: number;
  week_no: number;
  label: string;
  deadline: string;
  window_end: string;
  status: CompWeekStatus;
}

export interface CompGame {
  id: number;
  week_id: number;
  sport: CompSport;
  event_id: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  spread_home: number | null;
  total: number | null;
  books_n: number | null;
  lines_updated_at: string | null;
  home_score: number | null;
  away_score: number | null;
  is_final: boolean;
}

export interface CompEntry {
  id: number;
  week_id: number;
  user_id: string;
  status: CompEntryStatus;
  submitted_at: string | null;
  editable_until: string | null;
}

export interface CompPick {
  id: number;
  entry_id: number;
  game_id: number;
  market: CompMarket;
  side: CompSide;
  line: number | null;
  line_stamped_at: string | null;
  is_potw: boolean;
  result: CompPickResult | null;
  points: number | null;
  cover_points: number | null;
}

/** Draft tray pick — never includes a line (server stamps on submit). */
export interface CompDraftPick {
  game_id: number;
  market: CompMarket;
  side: CompSide;
  is_potw: boolean;
}

export interface CompLeaderboardRow {
  rank: number;
  user_id: string;
  display_name: string;
  weeks_played: number;
  wins: number;
  losses: number;
  pushes: number;
  points: number;
  cover_points: number;
}

export interface CompWeekStatRow {
  game_id: number;
  sport: CompSport;
  home_team: string;
  away_team: string;
  kickoff: string;
  market: CompMarket;
  side: CompSide;
  n_picks: number;
  n_potw: number;
}

/** One pick row from `comp_week_submissions` (post-deadline browse). */
export interface CompSubmissionPickRow {
  entry_id: number;
  user_id: string;
  display_name: string;
  submitted_at: string | null;
  pick_id: number;
  game_id: number;
  sport: CompSport;
  home_team: string;
  away_team: string;
  kickoff: string;
  market: CompMarket;
  side: CompSide;
  line: number | null;
  is_potw: boolean;
  result: CompPickResult | null;
  points: number | null;
}

export interface CompSubmissionCard {
  entryId: number;
  userId: string;
  displayName: string;
  submittedAt: string | null;
  picks: CompSubmissionPickRow[];
}

export type CompetitionTab = 'picks' | 'most' | 'everyone' | 'leaderboard' | 'rules';
