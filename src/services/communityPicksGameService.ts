import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';

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
 * Fetch active NFL games from v_input_values_with_epa
 */
async function fetchNFLGames(): Promise<GameOption[]> {
  try {
    const { data, error } = await collegeFootballSupabase
      .from('v_input_values_with_epa')
      .select('*')
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true });

    if (error) {
      debug.error('Error fetching NFL games:', error);
      return [];
    }

    if (!data) return [];

    return data.map((game: any) => ({
      id: game.unique_id || `${game.away_team}_${game.home_team}_${game.game_date}`,
      sport: 'nfl',
      awayTeam: game.away_team,
      homeTeam: game.home_team,
      gameDate: game.game_date,
      awaySpread: game.away_spread,
      homeSpread: game.home_spread,
      awayML: game.away_ml,
      homeML: game.home_ml,
      total: game.total_line || game.over_line,
      displayText: `${game.away_team} @ ${game.home_team} - ${game.game_date}`,
    }));
  } catch (error) {
    debug.error('Exception fetching NFL games:', error);
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
      .select('*')
      .order('start_date', { ascending: true });

    if (error) {
      debug.error('Error fetching CFB games:', error);
      return [];
    }

    if (!data) return [];

    return data.map((game: any) => {
      // Extract date from start_time or start_date
      const gameDate = game.start_date || game.start_time?.split('T')[0] || new Date().toISOString().split('T')[0];
      
      return {
        id: game.training_key || `${game.away_team}_${game.home_team}_${gameDate}`,
        sport: 'cfb',
        awayTeam: game.away_team,
        homeTeam: game.home_team,
        gameDate,
        awaySpread: game.away_spread,
        homeSpread: game.home_spread || (game.api_spread ? -game.api_spread : null),
        awayML: game.away_moneyline,
        homeML: game.home_moneyline,
        total: game.api_over_line,
        displayText: `${game.away_team} @ ${game.home_team} - ${gameDate}`,
      };
    });
  } catch (error) {
    debug.error('Exception fetching CFB games:', error);
    return [];
  }
}

/**
 * Fetch all active games across all supported sports
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

  // Filter out games in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const filteredGames = games.filter(game => {
    const gameDate = new Date(game.gameDate);
    gameDate.setHours(0, 0, 0, 0);
    return gameDate >= today;
  });

  debug.log(`Fetched ${filteredGames.length} active games for community picks`);
  
  return filteredGames;
}

/**
 * Get pick options for a specific game and team
 */
export function getPickOptions(game: GameOption, team: 'away' | 'home'): {
  moneyline?: { label: string; value: number };
  spread?: { label: string; value: number };
  total?: { label: string; value: number };
} {
  const options: any = {};

  if (team === 'away') {
    if (game.awayML) {
      options.moneyline = {
        label: `${game.awayTeam} ML ${game.awayML > 0 ? '+' : ''}${game.awayML}`,
        value: game.awayML,
      };
    }
    if (game.awaySpread) {
      options.spread = {
        label: `${game.awayTeam} ${game.awaySpread > 0 ? '+' : ''}${game.awaySpread}`,
        value: game.awaySpread,
      };
    }
  } else {
    if (game.homeML) {
      options.moneyline = {
        label: `${game.homeTeam} ML ${game.homeML > 0 ? '+' : ''}${game.homeML}`,
        value: game.homeML,
      };
    }
    if (game.homeSpread) {
      options.spread = {
        label: `${game.homeTeam} ${game.homeSpread > 0 ? '+' : ''}${game.homeSpread}`,
        value: game.homeSpread,
      };
    }
  }

  if (game.total) {
    options.total = {
      label: `Total ${game.total}`,
      value: game.total,
    };
  }

  return options;
}



