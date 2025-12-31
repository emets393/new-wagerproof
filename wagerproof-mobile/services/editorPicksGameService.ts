import { collegeFootballSupabase } from '@/services/collegeFootballClient';

export interface GameOption {
  id: string;
  sport: string;
  awayTeam: string;
  homeTeam: string;
  gameDate: string; // YYYY-MM-DD
  awaySpread?: number | null;
  homeSpread?: number | null;
  awayML?: number | null;
  homeML?: number | null;
  total?: number | null;
  displayText: string; // e.g., "Ravens @ Dolphins - 11/10/2025"
}

/**
 * Fetch active NFL games from nfl_betting_lines
 */
async function fetchNFLGames(): Promise<GameOption[]> {
  try {
    const { data, error } = await collegeFootballSupabase
      .from('nfl_betting_lines')
      .select('training_key, away_team, home_team, game_date, away_spread, home_spread, away_ml, home_ml, over_line, as_of_ts')
      .order('as_of_ts', { ascending: false });

    if (error || !data || data.length === 0) {
      return [];
    }

    // Deduplicate: keep only the first (most recent) entry per training_key
    const seenKeys = new Set<string>();
    const uniqueGames = data.filter((game: any) => {
      if (seenKeys.has(game.training_key)) {
        return false;
      }
      seenKeys.add(game.training_key);
      return true;
    });

    return uniqueGames.map((game: any) => ({
      id: game.training_key,
      sport: 'nfl',
      awayTeam: game.away_team,
      homeTeam: game.home_team,
      gameDate: game.game_date,
      awaySpread: game.away_spread,
      homeSpread: game.home_spread,
      awayML: game.away_ml,
      homeML: game.home_ml,
      total: game.over_line,
      displayText: `${game.away_team} @ ${game.home_team} - ${game.game_date}`,
    }));
  } catch (error) {
    console.error('Error fetching NFL games:', error);
    return [];
  }
}

/**
 * Fetch active CFB games from cfb_live_weekly_inputs
 */
async function fetchCFBGames(): Promise<GameOption[]> {
  try {
    const { data, error } = await collegeFootballSupabase
      .from('cfb_live_weekly_inputs')
      .select('*');

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map((game: any) => {
      const startTimeString = game.start_time || game.start_date;
      let gameDate = new Date().toISOString().split('T')[0];

      if (startTimeString) {
        try {
          const utcDate = new Date(startTimeString);
          const year = utcDate.getFullYear();
          const month = String(utcDate.getMonth() + 1).padStart(2, '0');
          const day = String(utcDate.getDate()).padStart(2, '0');
          gameDate = `${year}-${month}-${day}`;
        } catch (e) {
          console.error('Error parsing CFB date:', startTimeString, e);
        }
      }

      return {
        id: String(game.id),
        sport: 'cfb',
        awayTeam: game.away_team,
        homeTeam: game.home_team,
        gameDate,
        awaySpread: game.api_spread ? -game.api_spread : null,
        homeSpread: game.api_spread,
        awayML: game.away_moneyline,
        homeML: game.home_moneyline,
        total: game.api_over_line,
        displayText: `${game.away_team} @ ${game.home_team} - ${gameDate}`,
      };
    });
  } catch (error) {
    console.error('Error fetching CFB games:', error);
    return [];
  }
}

/**
 * Fetch active NBA games from nba_input_values_view
 */
async function fetchNBAGames(): Promise<GameOption[]> {
  try {
    const { data, error } = await collegeFootballSupabase
      .from('nba_input_values_view')
      .select('game_id, away_team, home_team, game_date, home_spread, home_moneyline, total_line')
      .order('game_date', { ascending: true })
      .order('tipoff_time_et', { ascending: true });

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map((game: any) => {
      const homeML = game.home_moneyline;
      let awayML = null;
      if (homeML) {
        awayML = homeML > 0 ? -(homeML + 100) : 100 - homeML;
      }

      return {
        id: String(game.game_id),
        sport: 'nba',
        awayTeam: game.away_team,
        homeTeam: game.home_team,
        gameDate: game.game_date,
        awaySpread: game.home_spread ? -game.home_spread : null,
        homeSpread: game.home_spread,
        awayML,
        homeML,
        total: game.total_line,
        displayText: `${game.away_team} @ ${game.home_team} - ${game.game_date}`,
      };
    });
  } catch (error) {
    console.error('Error fetching NBA games:', error);
    return [];
  }
}

/**
 * Fetch active NCAAB games from v_cbb_input_values
 */
async function fetchNCAABGames(): Promise<GameOption[]> {
  try {
    const { data, error } = await collegeFootballSupabase
      .from('v_cbb_input_values')
      .select('game_id, away_team, home_team, game_date_et, spread, over_under, awayMoneyline, homeMoneyline')
      .order('game_date_et', { ascending: true })
      .order('tipoff_time_et', { ascending: true });

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map((game: any) => ({
      id: String(game.game_id),
      sport: 'ncaab',
      awayTeam: game.away_team,
      homeTeam: game.home_team,
      gameDate: game.game_date_et,
      awaySpread: game.spread ? -game.spread : null,
      homeSpread: game.spread,
      awayML: game.awayMoneyline,
      homeML: game.homeMoneyline,
      total: game.over_under,
      displayText: `${game.away_team} @ ${game.home_team} - ${game.game_date_et}`,
    }));
  } catch (error) {
    console.error('Error fetching NCAAB games:', error);
    return [];
  }
}

/**
 * Fetch all active games for a specific sport or all sports
 */
export async function fetchActiveGames(sport?: string): Promise<GameOption[]> {
  const games: GameOption[] = [];

  if (!sport || sport === 'nfl') {
    const nflGames = await fetchNFLGames();
    games.push(...nflGames);
  }

  if (!sport || sport === 'cfb') {
    const cfbGames = await fetchCFBGames();
    games.push(...cfbGames);
  }

  if (!sport || sport === 'nba') {
    const nbaGames = await fetchNBAGames();
    games.push(...nbaGames);
  }

  if (!sport || sport === 'ncaab') {
    const ncaabGames = await fetchNCAABGames();
    games.push(...ncaabGames);
  }

  // Filter out games in the past
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const filteredGames = games.filter(game => {
    if (!game.gameDate) return false;
    const gameDateStr = game.gameDate.split('T')[0];
    return gameDateStr >= todayStr;
  });

  return filteredGames;
}
