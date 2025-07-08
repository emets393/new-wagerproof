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
  }

  console.log('Games today edge function received filters:', filters);
  
  // Get today's date in YYYY-MM-DD format using local timezone instead of UTC
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-CA'); // Returns YYYY-MM-DD format in local timezone
  console.log('Today date for filtering:', todayStr);
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // First, let's check if there are ANY games today
  console.log('Checking for any games today...');
  const { data: allTodaysGames, error: checkError } = await supabase
    .from('training_data_team_view_enhanced')
    .select('date, primary_team, opponent_team')
    .eq('date', todayStr)
    .limit(5);
  
  if (checkError) {
    console.error('Error checking for today\'s games:', checkError);
  } else {
    console.log(`Found ${allTodaysGames?.length || 0} total games today (sample):`, allTodaysGames);
  }

  const numericFiltersWithOperators = new Set([
    "season", "month", "day", "series_game_number", "o_u_line", "primary_ml", "primary_rl",
    "primary_ml_handle", "primary_ml_bets", "primary_rl_handle", "primary_rl_bets",
    "primary_win_pct", "primary_last_win", "primary_last_runs", "primary_last_runs_allowed",
    "primary_ops_last_3", "primary_team_last_3", "primary_whip", "primary_era", "primary_streak",
    "opponent_ml", "opponent_rl", "opponent_ml_handle", "opponent_ml_bets", "opponent_rl_handle",
    "opponent_rl_bets", "opponent_win_pct", "opponent_last_win", "opponent_last_runs",
    "opponent_last_runs_allowed", "opponent_ops_last_3", "opponent_team_last_3", "opponent_whip",
    "opponent_era", "opponent_division_number", "opponent_league_number", "opponent_streak",
    "start_time_minutes", "series_primary_wins", "series_opponent_wins", "series_overs",
    "series_unders", "ou_handle_over", "ou_bets_over", "primary_days_between_games",
    "primary_travel_distance_miles", "same_division", "primary_handedness", "opponent_handedness"
  ]);

  const booleanFilters = new Set([
    "is_home_team", "same_league"
  ]);

  const allFilters = [
    ...numericFiltersWithOperators,
    ...booleanFilters,
    "primary_team", "primary_pitcher", "opponent_team", "opponent_pitcher", "team_status"
  ];

  // Build query for today's games
  let todaysQuery = supabase.from('training_data_team_view_enhanced').select('*').eq('date', todayStr);
  
  // Apply the same filters to today's games query
  for (const key of allFilters) {
    const val = filters[key];
    if (!val) continue;

    console.log(`Processing filter for today's games: ${key} = ${val}`);

    // Handle special team_status filter for favored/underdog
    if (key === 'team_status') {
      if (val === 'favored') {
        console.log('Applying favored filter to today\'s games: primary_ml < opponent_ml');
        todaysQuery = todaysQuery.filter('primary_ml', 'lt', 'opponent_ml');
      } else if (val === 'underdog') {
        console.log('Applying underdog filter to today\'s games: primary_ml > opponent_ml');
        todaysQuery = todaysQuery.filter('primary_ml', 'gt', 'opponent_ml');
      }
      continue;
    }

    // Handle boolean filters
    if (booleanFilters.has(key)) {
      const boolValue = val === 'true';
      console.log(`Applying boolean filter to today's games: ${key} = ${boolValue}`);
      todaysQuery = todaysQuery.eq(key, boolValue);
      continue;
    }

    if (numericFiltersWithOperators.has(key)) {
      if (val.startsWith('gt:')) {
        const value = val.slice(3);
        console.log(`Applying gt filter to today's games: ${key} > ${value}`);
        todaysQuery = todaysQuery.gt(key, value);
      } else if (val.startsWith('gte:')) {
        const value = val.slice(4);
        console.log(`Applying gte filter to today's games: ${key} >= ${value}`);
        todaysQuery = todaysQuery.gte(key, value);
      } else if (val.startsWith('lt:')) {
        const value = val.slice(3);
        console.log(`Applying lt filter to today's games: ${key} < ${value}`);
        todaysQuery = todaysQuery.lt(key, value);
      } else if (val.startsWith('lte:')) {
        const value = val.slice(4);
        console.log(`Applying lte filter to today's games: ${key} <= ${value}`);
        todaysQuery = todaysQuery.lte(key, value);
      } else if (val.startsWith('between:')) {
        const [min, max] = val.slice(8).split(',');
        console.log(`Applying between filter to today's games: ${key} between ${min} and ${max}`);
        todaysQuery = todaysQuery.gte(key, min).lte(key, max);
      } else {
        console.log(`Applying eq filter to today's games: ${key} = ${val}`);
        todaysQuery = todaysQuery.eq(key, val);
      }
    } else {
      console.log(`Applying text eq filter to today's games: ${key} = ${val}`);
      todaysQuery = todaysQuery.eq(key, val);
    }
  }

  console.log('Executing today\'s games query...');
  const { data: todaysGames, error: todaysError } = await todaysQuery;

  if (todaysError) {
    console.error('Today\'s games query error:', todaysError);
    return new Response(JSON.stringify({ error: todaysError.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  console.log(`Found ${todaysGames?.length || 0} games today matching filters`);

  // If no games today match the filters, return early
  if (!todaysGames || todaysGames.length === 0) {
    return new Response(JSON.stringify({ 
      todaysGames: [], 
      historicalData: [],
      message: "No games today match the current filters"
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Extract unique teams from today's games
  const teamsPlayingToday = new Set<string>();
  todaysGames.forEach(game => {
    if (game.primary_team) teamsPlayingToday.add(game.primary_team);
    if (game.opponent_team) teamsPlayingToday.add(game.opponent_team);
  });

  console.log('Teams playing today:', Array.from(teamsPlayingToday));

  // Now get historical data for these teams with the same filters (excluding today)
  let historicalQuery = supabase.from('training_data_team_view_enhanced')
    .select('*')
    .lt('date', todayStr)
    .limit(100000);

  // Filter for teams playing today
  if (teamsPlayingToday.size > 0) {
    historicalQuery = historicalQuery.in('primary_team', Array.from(teamsPlayingToday));
  }

  // Apply the same filters to historical data
  for (const key of allFilters) {
    const val = filters[key];
    if (!val) continue;

    // Skip team filters since we're already filtering by teams playing today
    if (key === 'primary_team' || key === 'opponent_team') continue;

    console.log(`Processing filter for historical data: ${key} = ${val}`);

    if (key === 'team_status') {
      if (val === 'favored') {
        console.log('Applying favored filter to historical data: primary_ml < opponent_ml');
        historicalQuery = historicalQuery.filter('primary_ml', 'lt', 'opponent_ml');
      } else if (val === 'underdog') {
        console.log('Applying underdog filter to historical data: primary_ml > opponent_ml');
        historicalQuery = historicalQuery.filter('primary_ml', 'gt', 'opponent_ml');
      }
      continue;
    }

    if (booleanFilters.has(key)) {
      const boolValue = val === 'true';
      console.log(`Applying boolean filter to historical data: ${key} = ${boolValue}`);
      historicalQuery = historicalQuery.eq(key, boolValue);
      continue;
    }

    if (numericFiltersWithOperators.has(key)) {
      if (val.startsWith('gt:')) {
        const value = val.slice(3);
        historicalQuery = historicalQuery.gt(key, value);
      } else if (val.startsWith('gte:')) {
        const value = val.slice(4);
        historicalQuery = historicalQuery.gte(key, value);
      } else if (val.startsWith('lt:')) {
        const value = val.slice(3);
        historicalQuery = historicalQuery.lt(key, value);
      } else if (val.startsWith('lte:')) {
        const value = val.slice(4);
        historicalQuery = historicalQuery.lte(key, value);
      } else if (val.startsWith('between:')) {
        const [min, max] = val.slice(8).split(',');
        historicalQuery = historicalQuery.gte(key, min).lte(key, max);
      } else {
        historicalQuery = historicalQuery.eq(key, val);
      }
    } else {
      historicalQuery = historicalQuery.eq(key, val);
    }
  }

  console.log('Executing historical data query...');
  const { data: historicalData, error: historicalError } = await historicalQuery;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };

  if (historicalError) {
    console.error('Historical data query error:', historicalError);
    return new Response(JSON.stringify({ error: historicalError.message }), {
      status: 500,
      headers
    });
  }

  console.log(`Historical data query completed. Returned ${historicalData?.length || 0} records`);

  return new Response(JSON.stringify({
    todaysGames: todaysGames || [],
    historicalData: historicalData || [],
    teamsPlayingToday: Array.from(teamsPlayingToday)
  }), {
    status: 200,
    headers
  });
});
