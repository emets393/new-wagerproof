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
 * Fetch active NFL games from nfl_betting_lines
 * Uses training_key as the game ID (same as EditorsPicks.tsx)
 * Deduplicates by training_key, keeping the most recent line per game
 */
async function fetchNFLGames(): Promise<GameOption[]> {
  try {
    debug.log('📊 Fetching NFL games from nfl_betting_lines...');
    const { data, error } = await collegeFootballSupabase
      .from('nfl_betting_lines')
      .select('training_key, away_team, home_team, game_date, away_spread, home_spread, away_ml, home_ml, over_line, as_of_ts')
      .order('as_of_ts', { ascending: false }); // Most recent first

    if (error) {
      debug.error('❌ Error fetching NFL games:', error);
      console.error('NFL fetch error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      debug.log('⚠️ No NFL games found in nfl_betting_lines');
      console.log('No NFL games found');
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

    debug.log(`✅ Found ${uniqueGames.length} unique NFL games (from ${data.length} total lines)`);
    console.log(`NFL unique games: ${uniqueGames.length}`);
    if (uniqueGames.length > 0) {
      console.log('Sample NFL game:', uniqueGames[0]);
    }
    
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
    debug.error('❌ Exception fetching NFL games:', error);
    console.error('NFL exception:', error);
    return [];
  }
}

/**
 * Fetch active CFB games from cfb_live_weekly_inputs
 * Uses game.id as the game ID (same as EditorsPicks.tsx)
 */
async function fetchCFBGames(): Promise<GameOption[]> {
  try {
    debug.log('📊 Fetching CFB games from cfb_live_weekly_inputs...');
    // Use select('*') like EditorsPicks.tsx does to get all available columns
    const { data, error } = await collegeFootballSupabase
      .from('cfb_live_weekly_inputs')
      .select('*');

    if (error) {
      debug.error('❌ Error fetching CFB games:', error);
      console.error('CFB fetch error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      debug.log('⚠️ No CFB games found in cfb_live_weekly_inputs');
      console.log('No CFB games found');
      return [];
    }

    debug.log(`✅ Found ${data.length} CFB games from cfb_live_weekly_inputs`);
    console.log(`CFB games found: ${data.length}`);
    if (data.length > 0) {
      console.log('Sample CFB game:', data[0]);
      console.log('CFB column names:', Object.keys(data[0]));
    }

    return data.map((game: any) => {
      // CFB uses start_time or start_date - try both
      const startTimeString = game.start_time || game.start_date;
      let gameDate = new Date().toISOString().split('T')[0]; // Default to today
      
      if (startTimeString) {
        try {
          // Parse the datetime and get the date in ET timezone
          const utcDate = new Date(startTimeString);
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          
          const parts = formatter.formatToParts(utcDate);
          const year = parts.find(p => p.type === 'year')?.value;
          const month = parts.find(p => p.type === 'month')?.value;
          const day = parts.find(p => p.type === 'day')?.value;
          
          if (year && month && day) {
            gameDate = `${year}-${month}-${day}`;
          }
        } catch (e) {
          console.error('Error parsing CFB date:', startTimeString, e);
        }
      }
      
      return {
        id: String(game.id), // Use game.id as the primary ID
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
    debug.error('❌ Exception fetching CFB games:', error);
    console.error('CFB exception:', error);
    return [];
  }
}

/**
 * Fetch active NBA games from nba_input_values_view
 * Uses game_id as the game ID (same as EditorsPicks.tsx)
 */
async function fetchNBAGames(): Promise<GameOption[]> {
  try {
    debug.log('📊 Fetching NBA games from nba_input_values_view...');
    
    const { data, error } = await collegeFootballSupabase
      .from('nba_input_values_view')
      .select('game_id, away_team, home_team, game_date, home_spread, home_moneyline, total_line')
      .order('game_date', { ascending: true })
      .order('tipoff_time_et', { ascending: true });

    if (error) {
      debug.error('❌ Error fetching NBA games:', error);
      console.error('NBA fetch error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      debug.log('⚠️ No NBA games found in nba_input_values_view');
      console.log('No NBA games found');
      return [];
    }

    debug.log(`✅ Found ${data.length} NBA games from nba_input_values_view`);
    console.log(`NBA games found: ${data.length}`);
    if (data.length > 0) {
      console.log('Sample NBA game:', data[0]);
    }

    return data.map((game: any) => {
      // Calculate away ML from home ML (same as EditorsPicks.tsx)
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
    debug.error('❌ Exception fetching NBA games:', error);
    console.error('NBA exception:', error);
    return [];
  }
}

/**
 * Fetch active NCAAB games from v_cbb_input_values
 * Uses game_id as the game ID (same as EditorsPicks.tsx)
 */
async function fetchNCAABGames(): Promise<GameOption[]> {
  try {
    debug.log('📊 Fetching NCAAB games from v_cbb_input_values...');
    
    const { data, error } = await collegeFootballSupabase
      .from('v_cbb_input_values')
      .select('game_id, away_team, home_team, game_date_et, spread, over_under, awayMoneyline, homeMoneyline')
      .order('game_date_et', { ascending: true })
      .order('tipoff_time_et', { ascending: true });

    if (error) {
      debug.error('❌ Error fetching NCAAB games:', error);
      console.error('NCAAB fetch error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      debug.log('⚠️ No NCAAB games found in v_cbb_input_values');
      console.log('No NCAAB games found');
      return [];
    }

    debug.log(`✅ Found ${data.length} NCAAB games from v_cbb_input_values`);
    console.log(`NCAAB games found: ${data.length}`);
    if (data.length > 0) {
      console.log('Sample NCAAB game:', data[0]);
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
    debug.error('❌ Exception fetching NCAAB games:', error);
    console.error('NCAAB exception:', error);
    return [];
  }
}

/**
 * Fetch all active games across all supported sports
 */
export async function fetchActiveGames(sport?: string): Promise<GameOption[]> {
  console.log(`🎯 fetchActiveGames called with sport: ${sport}`);
  const games: GameOption[] = [];

  if (!sport || sport === 'nfl') {
    console.log('Fetching NFL games...');
    const nflGames = await fetchNFLGames();
    console.log(`NFL games returned: ${nflGames.length}`);
    games.push(...nflGames);
  }

  if (!sport || sport === 'cfb') {
    console.log('Fetching CFB games...');
    const cfbGames = await fetchCFBGames();
    console.log(`CFB games returned: ${cfbGames.length}`);
    games.push(...cfbGames);
  }

  if (!sport || sport === 'nba') {
    console.log('Fetching NBA games...');
    const nbaGames = await fetchNBAGames();
    console.log(`NBA games returned: ${nbaGames.length}`);
    games.push(...nbaGames);
  }

  if (!sport || sport === 'ncaab') {
    console.log('Fetching NCAAB games...');
    const ncaabGames = await fetchNCAABGames();
    console.log(`NCAAB games returned: ${ncaabGames.length}`);
    games.push(...ncaabGames);
  }

  console.log(`Total games before filter: ${games.length}`);

  // Filter out games in the past - use date string comparison to avoid timezone issues
  // Get today's date in YYYY-MM-DD format
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  console.log(`Today's date for filtering: ${todayStr}`);
  
  const filteredGames = games.filter(game => {
    if (!game.gameDate) {
      console.log(`Game ${game.id} has no gameDate, excluding`);
      return false;
    }
    // Compare date strings directly (YYYY-MM-DD format)
    // This avoids timezone issues with Date parsing
    const gameDateStr = game.gameDate.split('T')[0]; // Handle ISO format if present
    const include = gameDateStr >= todayStr;
    if (!include) {
      console.log(`Game ${game.id} (${gameDateStr}) is before today (${todayStr}), excluding`);
    }
    return include;
  });

  console.log(`Games after date filter: ${filteredGames.length}`);
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



