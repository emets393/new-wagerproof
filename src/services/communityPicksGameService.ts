import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import { resolveNflCurrentWeek, resolveCfbCurrentWeek } from '@/features/games/api/footballSlate';

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
 * Fetch active NFL games from nfl_slate_feed (current week resolved dynamically).
 */
async function fetchNFLGames(): Promise<GameOption[]> {
  try {
    debug.log('📊 Fetching NFL games from nfl_slate_feed...');
    const { season, week } = await resolveNflCurrentWeek();
    const { data, error } = await collegeFootballSupabase
      .from('nfl_slate_feed')
      .select('game_id, away_team, home_team, gameday, kickoff, fg_spread_close, fg_ml_home_close, fg_ml_away_close, fg_total_close')
      .eq('season', season)
      .eq('week', week)
      .order('kickoff', { ascending: true });

    if (error) {
      debug.error('❌ Error fetching NFL games:', error);
      return [];
    }

    if (!data || data.length === 0) {
      debug.log('⚠️ No NFL games found in nfl_slate_feed');
      return [];
    }

    debug.log(`✅ Found ${data.length} NFL games (S${season} W${week})`);

    return data.map((game: any) => {
      const homeSpread = game.fg_spread_close ?? null;
      const gameDate = game.gameday || (game.kickoff ? String(game.kickoff).slice(0, 10) : '');
      return {
        id: game.game_id,
        sport: 'nfl',
        awayTeam: game.away_team,
        homeTeam: game.home_team,
        gameDate,
        awaySpread: homeSpread !== null ? -Number(homeSpread) : null,
        homeSpread,
        awayML: game.fg_ml_away_close ?? null,
        homeML: game.fg_ml_home_close ?? null,
        total: game.fg_total_close ?? null,
        displayText: `${game.away_team} @ ${game.home_team} - ${gameDate}`,
      };
    });
  } catch (error) {
    debug.error('❌ Exception fetching NFL games:', error);
    return [];
  }
}

/**
 * Fetch active CFB games from cfb_slate_feed (current week resolved dynamically).
 */
async function fetchCFBGames(): Promise<GameOption[]> {
  try {
    debug.log('📊 Fetching CFB games from cfb_slate_feed...');
    const { season, week } = await resolveCfbCurrentWeek();
    const { data, error } = await collegeFootballSupabase
      .from('cfb_slate_feed')
      .select('game_id, away_team, home_team, kickoff, fg_spread_close, fg_ml_home_close, fg_ml_away_close, fg_total_close')
      .eq('season', season)
      .eq('week', week)
      .order('kickoff', { ascending: true });

    if (error) {
      debug.error('❌ Error fetching CFB games:', error);
      return [];
    }

    if (!data || data.length === 0) {
      debug.log('⚠️ No CFB games found in cfb_slate_feed');
      return [];
    }

    debug.log(`✅ Found ${data.length} CFB games (S${season} W${week})`);

    return data.map((game: any) => {
      let gameDate = new Date().toISOString().split('T')[0];
      if (game.kickoff) {
        try {
          const utcDate = new Date(game.kickoff);
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
          if (year && month && day) gameDate = `${year}-${month}-${day}`;
        } catch {
          gameDate = String(game.kickoff).slice(0, 10);
        }
      }
      const homeSpread = game.fg_spread_close ?? null;
      return {
        id: String(game.game_id),
        sport: 'cfb',
        awayTeam: game.away_team,
        homeTeam: game.home_team,
        gameDate,
        awaySpread: homeSpread !== null ? -Number(homeSpread) : null,
        homeSpread,
        awayML: game.fg_ml_away_close ?? null,
        homeML: game.fg_ml_home_close ?? null,
        total: game.fg_total_close ?? null,
        displayText: `${game.away_team} @ ${game.home_team} - ${gameDate}`,
      };
    });
  } catch (error) {
    debug.error('❌ Exception fetching CFB games:', error);
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
      .select('game_id, away_team, home_team, game_date, home_spread, home_moneyline, away_moneyline, total_line')
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
      // Prefer the explicit away_moneyline column from nba_input_values_view;
      // fall back to the complement formula only if the DB value is missing.
      const homeML = game.home_moneyline;
      const awayML = game.away_moneyline
        ?? (homeML ? (homeML > 0 ? -(homeML + 100) : 100 - homeML) : null);
      
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



