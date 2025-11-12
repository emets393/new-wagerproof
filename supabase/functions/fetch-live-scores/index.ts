import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ESPNGame {
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
    team: {
      displayName: string;
      abbreviation: string;
      color?: string;
    };
    score: string;
    homeAway: 'home' | 'away';
  }>;
}

interface ParsedGame {
  game_id: string;
  league: string;
  away_team: string;
  away_abbr: string;
  away_score: number;
  away_color: string | null;
  home_team: string;
  home_abbr: string;
  home_score: number;
  home_color: string | null;
  status: string;
  period: string | null;
  time_remaining: string | null;
  is_live: boolean;
}

async function fetchESPNScores(endpoint: string, leagueName: string): Promise<ESPNGame[]> {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      console.error(`ESPN API error for ${leagueName}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    // Extract games from competitions
    const games: ESPNGame[] = [];
    if (data.events && Array.isArray(data.events)) {
      for (const event of data.events) {
        if (event.competitions && event.competitions.length > 0) {
          const competition = event.competitions[0];
          games.push({
            id: event.id,
            status: competition.status,
            competitors: competition.competitors
          });
        }
      }
    }
    
    return games;
  } catch (error) {
    console.error(`Error fetching ${leagueName} scores:`, error);
    return [];
  }
}

function parseGame(game: ESPNGame, league: string): ParsedGame | null {
  try {
    // Find home and away teams
    const homeTeam = game.competitors.find(c => c.homeAway === 'home');
    const awayTeam = game.competitors.find(c => c.homeAway === 'away');
    
    if (!homeTeam || !awayTeam) {
      console.error('Missing home or away team for game:', game.id);
      return null;
    }
    
    // Determine if game is live
    const state = game.status.type.state;
    const isLive = state === 'in' || state === 'live';
    
    // Get period info
    let period = null;
    let timeRemaining = null;
    
    if (isLive) {
      // Format period based on sport type
      if (league === 'NFL' || league === 'NCAAF') {
        period = game.status.period ? `Q${game.status.period}` : null;
      } else if (league === 'NBA' || league === 'NCAAB') {
        // Basketball has different period names
        const periodNum = game.status.period;
        if (periodNum <= 2) {
          period = `${periodNum === 1 ? '1st' : '2nd'} Half`;
        } else if (periodNum === 3) {
          period = `OT`;
        } else if (periodNum > 3) {
          period = `${periodNum - 2}OT`;
        }
      } else if (league === 'NHL') {
        period = game.status.period ? `P${game.status.period}` : null;
      } else if (league === 'MLB') {
        period = game.status.period ? `Inning ${game.status.period}` : null;
      } else {
        // For soccer and other sports
        period = game.status.period ? `${game.status.period}H` : null;
      }
      timeRemaining = game.status.displayClock || null;
    }
    
    return {
      game_id: `${league}-${game.id}`,
      league,
      away_team: awayTeam.team.displayName,
      away_abbr: awayTeam.team.abbreviation,
      away_score: parseInt(awayTeam.score) || 0,
      away_color: awayTeam.team.color ? `#${awayTeam.team.color}` : null,
      home_team: homeTeam.team.displayName,
      home_abbr: homeTeam.team.abbreviation,
      home_score: parseInt(homeTeam.score) || 0,
      home_color: homeTeam.team.color ? `#${homeTeam.team.color}` : null,
      status: game.status.type.shortDetail || game.status.type.description,
      period,
      time_remaining: timeRemaining,
      is_live: isLive
    };
  } catch (error) {
    console.error('Error parsing game:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
      }
    });
  }

  try {
    console.log('Fetching live scores from ESPN...');
    
    // Define all ESPN endpoints
    const sportEndpoints = [
      { league: 'NFL', url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard' },
      { league: 'NCAAF', url: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard' },
      { league: 'NBA', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard' },
      { league: 'NCAAB', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard' },
      { league: 'NHL', url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard' },
      { league: 'MLB', url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard' },
      { league: 'MLS', url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard' },
      { league: 'EPL', url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard' },
    ];
    
    // Fetch scores from all leagues
    const allGamesResults = await Promise.all(
      sportEndpoints.map(({ league, url }) => 
        fetchESPNScores(url, league)
      )
    );
    
    // Log fetch results
    sportEndpoints.forEach((sport, index) => {
      const count = allGamesResults[index].length;
      if (count > 0) {
        console.log(`Fetched ${count} ${sport.league} games`);
      }
    });
    
    // Parse games from all sports
    const parsedGames: ParsedGame[] = [];
    
    sportEndpoints.forEach((sport, index) => {
      const games = allGamesResults[index];
      for (const game of games) {
        const parsed = parseGame(game, sport.league);
        if (parsed) parsedGames.push(parsed);
      }
    });
    
    console.log(`Parsed ${parsedGames.length} total games across all sports`);
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Get all existing game IDs
    const { data: existingGames } = await supabase
      .from('live_scores')
      .select('game_id');
    
    const existingGameIds = new Set(existingGames?.map(g => g.game_id) || []);
    const currentGameIds = new Set(parsedGames.map(g => g.game_id));
    
    // Mark games that are no longer in the feed as not live
    const gamesToMarkInactive = Array.from(existingGameIds)
      .filter(id => !currentGameIds.has(id));
    
    if (gamesToMarkInactive.length > 0) {
      console.log(`Marking ${gamesToMarkInactive.length} games as inactive`);
      await supabase
        .from('live_scores')
        .update({ is_live: false })
        .in('game_id', gamesToMarkInactive);
    }
    
    // Upsert current games
    if (parsedGames.length > 0) {
      const { error: upsertError } = await supabase
        .from('live_scores')
        .upsert(
          parsedGames.map(game => ({
            ...game,
            last_updated: new Date().toISOString()
          })),
          { onConflict: 'game_id' }
        );
      
      if (upsertError) {
        console.error('Error upserting games:', upsertError);
        throw upsertError;
      }
    }
    
    // Delete old non-live games (older than 6 hours)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('live_scores')
      .delete()
      .eq('is_live', false)
      .lt('last_updated', sixHoursAgo);
    
    // Count live games
    const liveGamesCount = parsedGames.filter(g => g.is_live).length;
    
    console.log(`Successfully updated scores. ${liveGamesCount} live games.`);
    
    return new Response(
      JSON.stringify({
        success: true,
        totalGames: parsedGames.length,
        liveGames: liveGamesCount,
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('Error in fetch-live-scores function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});

