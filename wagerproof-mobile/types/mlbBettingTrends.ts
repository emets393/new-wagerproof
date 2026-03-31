/**
 * Types for MLB Situational Betting Trends
 * Data from mlb_situational_trends_today table
 *
 * MLB trends differ from NBA/NCAAB:
 * - Uses win_pct_* (moneyline win %) and over_pct_* (over %) instead of ATS records
 * - Has league_situation and division_situation (NBA doesn't)
 * - No W-L-P records — only percentages
 */

/**
 * Raw row from the mlb_situational_trends_today table
 */
export interface MLBSituationalTrendRow {
  game_pk: number;
  game_date_et: string;
  team_id: number | string;
  team_name: string;
  team_side: 'home' | 'away';
  // Situation labels
  last_game_situation: string;
  home_away_situation: string | null;
  fav_dog_situation: string;
  rest_bucket: string;
  rest_comp: string;
  league_situation: string | null;
  division_situation: string | null;
  // Win percentages (moneyline)
  win_pct_last_game: number | string | null;
  win_pct_home_away: number | string | null;
  win_pct_fav_dog: number | string | null;
  win_pct_rest_bucket: number | string | null;
  win_pct_rest_comp: number | string | null;
  win_pct_league: number | string | null;
  win_pct_division: number | string | null;
  // Over percentages
  over_pct_last_game: number | string | null;
  over_pct_home_away: number | string | null;
  over_pct_fav_dog: number | string | null;
  over_pct_rest_bucket: number | string | null;
  over_pct_rest_comp: number | string | null;
  over_pct_league: number | string | null;
  over_pct_division: number | string | null;
}

/**
 * Combined game trends data with home and away team trends
 */
export interface MLBGameTrendsData {
  gamePk: number;
  gameDateEt: string;
  gameTimeEt: string | null;
  awayTeam: MLBSituationalTrendRow;
  homeTeam: MLBSituationalTrendRow;
  // Calculated scores for sorting
  ouConsensusScore?: number;
  mlDominanceScore?: number;
}

export type MLBTrendsSortMode = 'time' | 'ou-consensus' | 'ml-dominance';

/**
 * Situation types for MLB trends
 * MLB has 7 situations vs NBA's 5 (adds league and division)
 */
export type MLBSituationType =
  | 'lastGame'
  | 'homeAway'
  | 'favDog'
  | 'restBucket'
  | 'restComp'
  | 'league'
  | 'division';

/**
 * Safely parse a trend percentage value.
 * Handles numeric, string, null. Converts 0-1 range to 0-100.
 */
export function toTrendPct(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'string' ? parseFloat(String(value).replace(/%/g, '').trim()) : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n < 1) return n * 100;
  return n;
}

/**
 * Format situation code to readable text
 */
export function formatMLBSituation(situation: string | null | undefined): string {
  if (!situation) return '—';

  const situationMap: Record<string, string> = {
    is_after_loss: 'After Loss',
    is_after_win: 'After Win',
    is_fav: 'Favorite',
    is_dog: 'Underdog',
    is_home: 'Home',
    is_away: 'Away',
    is_home_fav: 'Home Favorite',
    is_away_fav: 'Away Favorite',
    is_home_dog: 'Home Underdog',
    is_away_dog: 'Away Underdog',
    one_day_off: '1 Day Off',
    two_three_days_off: '2-3 Days Off',
    four_plus_days_off: '4+ Days Off',
    no_rest: 'No Rest',
    rest_advantage: 'Rest Advantage',
    rest_disadvantage: 'Rest Disadvantage',
    rest_equal: 'Equal Rest',
    equal_rest: 'Equal Rest',
    non_league: 'Non-League',
    non_division: 'Non-Division',
    league: 'League',
    division: 'Division',
  };
  return situationMap[situation] ?? situation.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
