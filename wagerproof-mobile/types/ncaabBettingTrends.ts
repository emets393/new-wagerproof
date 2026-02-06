/**
 * Types for NCAAB Situational Betting Trends
 * Data from ncaab_game_situational_trends_today table
 */

/**
 * Raw row from the ncaab_game_situational_trends_today table
 * Matches the actual database schema
 */
export interface NCAABSituationalTrendRow {
  game_id: number;
  game_date: string;
  api_team_id: number;
  team_abbr: string;
  team_name: string;
  team_side: 'home' | 'away';
  // Situation labels
  last_game_situation: string;
  fav_dog_situation: string;
  side_spread_situation: string;
  home_away_situation: string | null;
  rest_bucket: string;
  rest_comp: string;
  // ATS records (format: "W-L-P" e.g., "15-3-0")
  ats_last_game_record: string;
  ats_last_game_cover_pct: number;
  ats_fav_dog_record: string;
  ats_fav_dog_cover_pct: number;
  ats_side_fav_dog_record: string;
  ats_side_fav_dog_cover_pct: number;
  ats_home_away_record: string | null;
  ats_home_away_cover_pct: number | null;
  ats_rest_bucket_record: string;
  ats_rest_bucket_cover_pct: number;
  ats_rest_comp_record: string;
  ats_rest_comp_cover_pct: number;
  // OU records (format: "O-U-P" e.g., "10-8-0")
  ou_last_game_record: string;
  ou_last_game_over_pct: number;
  ou_last_game_under_pct: number;
  ou_fav_dog_record: string;
  ou_fav_dog_over_pct: number;
  ou_fav_dog_under_pct: number;
  ou_side_fav_dog_record: string;
  ou_side_fav_dog_over_pct: number;
  ou_side_fav_dog_under_pct: number;
  ou_home_away_record: string | null;
  ou_home_away_over_pct: number | null;
  ou_home_away_under_pct: number | null;
  ou_rest_bucket_record: string;
  ou_rest_bucket_over_pct: number;
  ou_rest_bucket_under_pct: number;
  ou_rest_comp_record: string;
  ou_rest_comp_over_pct: number;
  ou_rest_comp_under_pct: number;
}

/**
 * Combined game trends data with home and away team trends
 */
export interface NCAABGameTrendsData {
  gameId: number;
  gameDate: string;
  tipoffTime: string | null;
  awayTeam: NCAABSituationalTrendRow;
  homeTeam: NCAABSituationalTrendRow;
  // Team logos from ncaab_team_mapping
  awayTeamLogo: string | null;
  homeTeamLogo: string | null;
  // Calculated scores for sorting
  ouConsensusScore?: number;
  atsDominanceScore?: number;
}

/**
 * Helper function to parse record string (e.g., "15-3-0") into parts
 */
export function parseNCAABRecord(record: string | null | undefined): { wins: number; losses: number; pushes: number; total: number } {
  if (!record) return { wins: 0, losses: 0, pushes: 0, total: 0 };

  const parts = record.split('-').map(Number);
  const wins = parts[0] || 0;
  const losses = parts[1] || 0;
  const pushes = parts[2] || 0;
  const total = wins + losses + pushes;

  return { wins, losses, pushes, total };
}

/**
 * Format situation code to readable text
 */
export function formatNCAABSituation(situation: string | null | undefined): string {
  if (!situation) return '-';

  const situationMap: { [key: string]: string } = {
    'is_after_loss': 'After Loss',
    'is_after_win': 'After Win',
    'is_fav': 'Favorite',
    'is_dog': 'Underdog',
    'is_home_fav': 'Home Favorite',
    'is_away_fav': 'Away Favorite',
    'is_home_dog': 'Home Underdog',
    'is_away_dog': 'Away Underdog',
    'one_day_off': '1 Day Off',
    'two_three_days_off': '2-3 Days Off',
    'four_plus_days_off': '4+ Days Off',
    'rest_advantage': 'Rest Advantage',
    'rest_disadvantage': 'Rest Disadvantage',
    'rest_equal': 'Rest Equal',
  };
  return situationMap[situation] || situation.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export type NCAABTrendsSortMode = 'time' | 'ou-consensus' | 'ats-dominance';
