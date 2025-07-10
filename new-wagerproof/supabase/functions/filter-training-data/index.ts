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

  // Get filters from request body for POST requests
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

  console.log('Edge function received filters:', filters);
  
  // Get today's date in Eastern Time (ET) for consistent date handling
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const today = easternTime.toISOString().split('T')[0];
  console.log('=== DATE DEBUG INFO ===');
  console.log('Current UTC time:', now.toISOString());
  console.log('Current ET time:', easternTime.toISOString());
  console.log('Using today as:', today);
  console.log('======================');
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

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

  let query = supabase.from('training_data_team_view_enhanced').select('*').limit(100000);
  console.log('Starting with base query');

  for (const key of allFilters) {
    const val = filters[key];
    if (!val) continue;
    console.log(`Processing filter: ${key} = ${val}`);

    // Handle special team_status filter for home/away favored
    if (key === 'team_status') {
      if (val === 'home_favored') {
        console.log('Applying home favored filter: home_rl < 0');
        query = query.filter('home_rl', 'lt', 0);
      } else if (val === 'away_favored') {
        console.log('Applying away favored filter: away_rl < 0');
        query = query.filter('away_rl', 'lt', 0);
      }
      continue;
    }

    // Handle boolean filters
    if (booleanFilters.has(key)) {
      const boolValue = val === 'true';
      console.log(`Applying boolean filter: ${key} = ${boolValue}`);
      query = query.eq(key, boolValue);
      continue;
    }

    // Handle multi-select for season and month
    if ((key === 'season' || key === 'month') && val.includes(',')) {
      const values = val.split(',').map(v => v.trim());
      console.log(`Applying multi-select filter: ${key} in`, values);
      query = query.in(key, values);
      continue;
    }

    if (numericFiltersWithOperators.has(key)) {
      if (val.startsWith('gt:')) {
        const value = val.slice(3);
        console.log(`Applying gt filter: ${key} > ${value}`);
        query = query.gt(key, value);
      } else if (val.startsWith('gte:')) {
        const value = val.slice(4);
        console.log(`Applying gte filter: ${key} >= ${value}`);
        query = query.gte(key, value);
      } else if (val.startsWith('lt:')) {
        const value = val.slice(3);
        console.log(`Applying lt filter: ${key} < ${value}`);
        query = query.lt(key, value);
      } else if (val.startsWith('lte:')) {
        const value = val.slice(4);
        console.log(`Applying lte filter: ${key} <= ${value}`);
        query = query.lte(key, value);
      } else if (val.startsWith('between:')) {
        const [min, max] = val.slice(8).split(',');
        console.log(`Applying between filter: ${key} between ${min} and ${max}`);
        query = query.gte(key, min).lte(key, max);
      } else if (key === 'season' && val.includes(',')) {
        // Already handled above
        continue;
      } else {
        console.log(`Applying eq filter: ${key} = ${val}`);
        query = query.eq(key, val);
      }
    } else {
      console.log(`Applying text eq filter: ${key} = ${val}`);
      query = query.eq(key, val);
    }
  }

  // Exclude today's games
  console.log(`Applying date filter: date < ${today}`);
  query = query.lt('date', today);

  // HARD FILTER for testing: only return games where season = 2025
  query = query.eq('season', 2025);

  console.log('Executing query...');
  let { data, error } = await query;
  console.log('Query executed. Number of rows returned:', data ? data.length : 0);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };

  if (error) {
    console.error('Query error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers
    });
  }

  console.log(`Query completed successfully. Returned ${data?.length || 0} records`);
  
  // Log some sample data if available
  if (data && data.length > 0) {
    console.log('Sample record o_u_line values:', data.slice(0, 3).map(r => r.o_u_line));
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers
  });
});
