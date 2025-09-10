import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  // Get filters from request body
  let filters: Record<string, string> = {};
  
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      filters = body.filters || {};
    } catch (error) {
      console.error('Error parsing request body:', error);
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  } else {
    // Fallback to query parameters for GET requests
    const url = new URL(req.url);
    filters = Object.fromEntries(url.searchParams.entries());
  }

  console.log('NFL Edge function received filters:', filters);
  console.log('Season filter value:', filters.season, 'Type:', typeof filters.season);
  console.log('Week filter value:', filters.week, 'Type:', typeof filters.week);
  
  const supabase = createClient(
    "https://jpxnjuwglavsjbgbasnl.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo"
  );

  // NFL Team Logo mapping function (same as NFL page)
  const getNFLTeamLogo = (teamName: string): string => {
    const logoMap: { [key: string]: string } = {
      'Arizona': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
      'Atlanta': 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
      'Baltimore': 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
      'Buffalo': 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
      'Carolina': 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
      'Chicago': 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
      'Cincinnati': 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
      'Cleveland': 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
      'Dallas': 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
      'Denver': 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
      'Detroit': 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
      'Green Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
      'Houston': 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
      'Indianapolis': 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
      'Jacksonville': 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
      'Kansas City': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
      'Las Vegas': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
      'LA Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
      'LA Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
      'Miami': 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
      'Minnesota': 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
      'New England': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
      'New Orleans': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
      'NY Giants': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
      'NY Jets': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
      'Philadelphia': 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
      'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
      'San Francisco': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
      'Seattle': 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
      'Tampa Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
      'Tennessee': 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
      'Washington': 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
    };
    return logoMap[teamName] || '/placeholder.svg';
  };

  // Determine view type
  const viewType = filters.view_type || "individual";
  
  let query;
  let teamStats = [];
  let summary = {};

  if (viewType === "individual") {
    // Individual Team Performance - use v_nfl_training_exploded
    // First get all teams from nfl_team_mapping
    const { data: teamMapping, error: teamMappingError } = await supabase
      .from('nfl_team_mapping')
      .select('team_id, city_and_name, team_name');

    if (teamMappingError) {
      console.error('Team mapping error:', teamMappingError);
      return new Response(JSON.stringify({ error: teamMappingError.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    console.log('Team mapping data:', teamMapping);
    console.log('Team mapping count:', teamMapping?.length);

    // If no team mapping data, return empty result
    if (!teamMapping || teamMapping.length === 0) {
      console.log('No team mapping data found');
      return new Response(JSON.stringify({ 
        teamStats: [], 
        summary: {},
        viewType: "individual",
        debug: "No team mapping data found"
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Initialize team map with all teams
    const teamMap = new Map();
    teamMapping?.forEach(team => {
      teamMap.set(team.team_id, {
        teamId: team.team_id,
        teamName: team.city_and_name,
        teamLogo: getNFLTeamLogo(team.team_name),
        games: 0,
        wins: 0,
        covers: 0,
        overs: 0,
        totalGames: 0
      });
    });

    console.log('Initialized teams:', teamMap.size);

    // Now get filtered data from v_nfl_training_exploded
    query = supabase.from('v_nfl_training_exploded').select('*');
    
    // Apply filters (but don't filter by priority_team_id to get all teams)
    if (filters.opponent_team_id) {
      query = query.eq('opponent_team_id', filters.opponent_team_id);
    }
    if (filters.season) {
      if (filters.season.includes(',')) {
        // Range filter: "2020,2024"
        const [minSeason, maxSeason] = filters.season.split(',').map(Number);
        query = query.gte('season', minSeason).lte('season', maxSeason);
      } else {
        query = query.eq('season', filters.season);
      }
    }
    if (filters.week) {
      if (filters.week.includes(',')) {
        // Range filter: "1,18"
        const [minWeek, maxWeek] = filters.week.split(',').map(Number);
        query = query.gte('week', minWeek).lte('week', maxWeek);
      } else {
        query = query.eq('week', filters.week);
      }
    }
    if (filters.start) {
      query = query.eq('start', filters.start);
    }
    if (filters.ou_vegas_line) {
      query = query.eq('ou_vegas_line', filters.ou_vegas_line);
    }
    if (filters.spread_closing) {
      query = query.eq('spread_closing', filters.spread_closing);
    }
    if (filters.surface) {
      query = query.eq('surface', filters.surface);
    }
    if (filters.game_stadium_dome) {
      query = query.eq('game_stadium_dome', filters.game_stadium_dome);
    }
    if (filters.temperature) {
      query = query.eq('temperature', filters.temperature);
    }
    if (filters.precipitation_type) {
      query = query.eq('precipitation_type', filters.precipitation_type);
    }
    if (filters.wind_speed) {
      query = query.eq('wind_speed', filters.wind_speed);
    }
    if (filters.conference_game) {
      query = query.eq('conference_game', filters.conference_game === 'true');
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Query error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    console.log('Filtered data count:', data?.length);
    console.log('Sample data row:', data?.[0]);

    // If no data from v_nfl_training_exploded, still return all teams with 0 stats
    if (!data || data.length === 0) {
      console.log('No data from v_nfl_training_exploded, returning teams with 0 stats');
    }

    // Process the filtered data and update team stats
    data?.forEach(row => {
      const teamId = row.priority_team_id;
      if (teamMap.has(teamId)) {
        const team = teamMap.get(teamId);
        team.games++;
        team.totalGames++;
        
        if (row.priority_team_won === 1) team.wins++;
        if (row.priority_team_covered === 1) team.covers++;
        if (row.ou_result === 1) team.overs++;
      }
    });

    // Convert to array and calculate percentages
    teamStats = Array.from(teamMap.values()).map(team => ({
      teamId: team.teamId,
      teamName: team.teamName,
      teamLogo: team.teamLogo,
      games: team.games,
      winPercentage: team.games > 0 ? (team.wins / team.games * 100).toFixed(1) : 0,
      coverPercentage: team.games > 0 ? (team.covers / team.games * 100).toFixed(1) : 0,
      overPercentage: team.games > 0 ? (team.overs / team.games * 100).toFixed(1) : 0
    }));

    console.log('Final team stats count:', teamStats.length);

  } else {
    // Game Level Performance - use nfl_training_data
    query = supabase.from('nfl_training_data').select('*');
    
    // Apply filters
    if (filters.home_team_id) {
      query = query.eq('home_team_id', filters.home_team_id);
    }
    if (filters.away_team_id) {
      query = query.eq('away_team_id', filters.away_team_id);
    }
    if (filters.home_spread) {
      query = query.eq('home_spread', filters.home_spread);
    }
    if (filters.start) {
      query = query.eq('start', filters.start);
    }
    if (filters.temperature) {
      query = query.eq('temperature', filters.temperature);
    }
    if (filters.wind_speed) {
      query = query.eq('wind_speed', filters.wind_speed);
    }
    if (filters.precipitation_type) {
      query = query.eq('precipitation_type', filters.precipitation_type);
    }
    if (filters.game_stadium_dome) {
      query = query.eq('game_stadium_dome', filters.game_stadium_dome);
    }
    if (filters.conference_game) {
      query = query.eq('conference_game', filters.conference_game === 'true');
    }
    if (filters.surface) {
      query = query.eq('surface', filters.surface);
    }
    if (filters.week) {
      if (filters.week.includes(',')) {
        // Range filter: "1,18"
        const [minWeek, maxWeek] = filters.week.split(',').map(Number);
        query = query.gte('week', minWeek).lte('week', maxWeek);
      } else {
        query = query.eq('week', filters.week);
      }
    }
    if (filters.season) {
      if (filters.season.includes(',')) {
        // Range filter: "2020,2024"
        const [minSeason, maxSeason] = filters.season.split(',').map(Number);
        query = query.gte('season', minSeason).lte('season', maxSeason);
      } else {
        query = query.eq('season', filters.season);
      }
    }
    if (filters.ou_vegas_line) {
      query = query.eq('ou_vegas_line', filters.ou_vegas_line);
    }

    console.log('About to execute query with filters:', {
      season: filters.season,
      week: filters.week,
      seasonType: typeof filters.season,
      weekType: typeof filters.week
    });

    const { data, error } = await query;
    
    if (error) {
      console.error('Query error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Calculate summary stats for game level
    const totalGames = data?.length || 0;
    const homeWins = data?.filter(row => row.home_away_ml === 1).length || 0;
    const homeCovers = data?.filter(row => row.home_away_spread_cover === 1).length || 0;
    const overs = data?.filter(row => row.ou_result === 1).length || 0;

    summary = {
      totalGames,
      homeWinPercentage: totalGames > 0 ? (homeWins / totalGames * 100).toFixed(1) : 0,
      awayWinPercentage: totalGames > 0 ? ((totalGames - homeWins) / totalGames * 100).toFixed(1) : 0,
      homeCoverPercentage: totalGames > 0 ? (homeCovers / totalGames * 100).toFixed(1) : 0,
      awayCoverPercentage: totalGames > 0 ? ((totalGames - homeCovers) / totalGames * 100).toFixed(1) : 0,
      overPercentage: totalGames > 0 ? (overs / totalGames * 100).toFixed(1) : 0,
      underPercentage: totalGames > 0 ? ((totalGames - overs) / totalGames * 100).toFixed(1) : 0
    };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };

  return new Response(JSON.stringify({ 
    teamStats, 
    summary,
    viewType 
  }), {
    status: 200,
    headers
  });
});
