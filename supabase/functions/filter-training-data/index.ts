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
    "primary_team", "primary_pitcher", "opponent_team", "opponent_pitcher", "team_status",
    "ou_line_min", "ou_line_max", "home_handedness", "away_handedness",
    "ou_handle_min", "ou_handle_max", "ou_bets_min", "ou_bets_max",
    "home_ml_handle_min", "home_ml_handle_max", "home_ml_bets_min", "home_ml_bets_max",
    "home_rl_handle_min", "home_rl_handle_max", "home_rl_bets_min", "home_rl_bets_max"
  ];

  let query = supabase.from('training_data').select('*').order('date', { ascending: false });
  console.log('Starting with base query (no limit)');

  // Apply filters to the query
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

    // Handle O/U line range filter
    if (key === 'ou_line_min') {
      console.log(`Applying O/U line min filter: o_u_line >= ${val}`);
      query = query.gte('o_u_line', parseFloat(val));
      continue;
    }
    if (key === 'ou_line_max') {
      console.log(`Applying O/U line max filter: o_u_line <= ${val}`);
      query = query.lte('o_u_line', parseFloat(val));
      continue;
    }

    // Handle betting volume filters
    if (key === 'ou_handle_min') {
      console.log(`Applying O/U handle min filter: ou_handle_over >= ${val}`);
      query = query.gte('ou_handle_over', parseFloat(val));
      continue;
    }
    if (key === 'ou_handle_max') {
      console.log(`Applying O/U handle max filter: ou_handle_over <= ${val}`);
      query = query.lte('ou_handle_over', parseFloat(val));
      continue;
    }
    if (key === 'ou_bets_min') {
      console.log(`Applying O/U bets min filter: ou_bets_over >= ${val}`);
      query = query.gte('ou_bets_over', parseFloat(val));
      continue;
    }
    if (key === 'ou_bets_max') {
      console.log(`Applying O/U bets max filter: ou_bets_over <= ${val}`);
      query = query.lte('ou_bets_over', parseFloat(val));
      continue;
    }
    if (key === 'home_ml_handle_min') {
      console.log(`Applying home ML handle min filter: home_ml_handle >= ${val}`);
      query = query.gte('home_ml_handle', parseFloat(val));
      continue;
    }
    if (key === 'home_ml_handle_max') {
      console.log(`Applying home ML handle max filter: home_ml_handle <= ${val}`);
      query = query.lte('home_ml_handle', parseFloat(val));
      continue;
    }
    if (key === 'home_ml_bets_min') {
      console.log(`Applying home ML bets min filter: home_ml_bets >= ${val}`);
      query = query.gte('home_ml_bets', parseFloat(val));
      continue;
    }
    if (key === 'home_ml_bets_max') {
      console.log(`Applying home ML bets max filter: home_ml_bets <= ${val}`);
      query = query.lte('home_ml_bets', parseFloat(val));
      continue;
    }
    if (key === 'home_rl_handle_min') {
      console.log(`Applying home RL handle min filter: home_rl_handle >= ${val}`);
      query = query.gte('home_rl_handle', parseFloat(val));
      continue;
    }
    if (key === 'home_rl_handle_max') {
      console.log(`Applying home RL handle max filter: home_rl_handle <= ${val}`);
      query = query.lte('home_rl_handle', parseFloat(val));
      continue;
    }
    if (key === 'home_rl_bets_min') {
      console.log(`Applying home RL bets min filter: home_rl_bets >= ${val}`);
      query = query.gte('home_rl_bets', parseFloat(val));
      continue;
    }
    if (key === 'home_rl_bets_max') {
      console.log(`Applying home RL bets max filter: home_rl_bets <= ${val}`);
      query = query.lte('home_rl_bets', parseFloat(val));
      continue;
    }

    // Handle pitcher handedness filters
    if (key === 'home_handedness') {
      const handednessValue = val === 'right' ? 1 : 2;
      console.log(`Applying home handedness filter: home_handedness = ${handednessValue} (${val})`);
      query = query.eq('home_handedness', handednessValue);
      continue;
    }
    if (key === 'away_handedness') {
      const handednessValue = val === 'right' ? 1 : 2;
      console.log(`Applying away handedness filter: away_handedness = ${handednessValue} (${val})`);
      query = query.eq('away_handedness', handednessValue);
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

  console.log('Executing query...');
  let { data, error } = await query;

  // JS-side fallback: filter out any rows with ou_result === null
  let allValid = [];
  let mostRecent100 = [];
  if (data) {
    const before = data.length;
    allValid = data.filter(row => row.ou_result !== null);
    const after = allValid.length;
    if (before !== after) {
      console.log(`Filtered out ${before - after} rows with null ou_result in JS fallback.`);
    }
    // Take the 25 most recent valid games
    mostRecent100 = allValid.slice(0, 25);
    console.log(`Returning ${mostRecent100.length} most recent valid games for table.`);
    // Log date ranges
    if (allValid.length > 0) {
      const allDates = allValid.map(row => row.date).filter(Boolean).sort();
      console.log('ALL: Earliest date:', allDates[0]);
      console.log('ALL: Latest date:', allDates[allDates.length - 1]);
      console.log('ALL: Total valid games:', allValid.length);
    }
    if (mostRecent100.length > 0) {
      const tableDates = mostRecent100.map(row => row.date).filter(Boolean).sort();
      console.log('TABLE: Earliest date:', tableDates[0]);
      console.log('TABLE: Latest date:', tableDates[tableDates.length - 1]);
      console.log('TABLE: Total games:', mostRecent100.length);
      console.log('TABLE: First 10 dates:', mostRecent100.slice(0, 10).map(row => row.date));
    }
  }

  // Calculate summary stats from allValid
  const totalGames = allValid.length;
  const homeWins = allValid.filter(game => game.ha_winner === 1).length;
  const awayWins = allValid.filter(game => game.ha_winner === 0).length;
  const homeCovers = allValid.filter(game => game.run_line_winner === 1).length;
  const awayCovers = allValid.filter(game => game.run_line_winner === 0).length;
  const overs = allValid.filter(game => game.ou_result === 1).length;
  const unders = allValid.filter(game => game.ou_result === 0).length;

  const overPct = totalGames > 0 ? +(overs / totalGames * 100).toFixed(1) : 0;
  const underPct = +(100.0 - overPct).toFixed(1);
  const homeWinPct = totalGames > 0 ? +(homeWins / totalGames * 100).toFixed(1) : 0;
  const awayWinPct = +(100.0 - homeWinPct).toFixed(1);
  const homeCoverPct = totalGames > 0 ? +(homeCovers / totalGames * 100).toFixed(1) : 0;
  const awayCoverPct = +(100.0 - homeCoverPct).toFixed(1);
  const summary = {
    homeWinPct,
    awayWinPct,
    homeCoverPct,
    awayCoverPct,
    overPct,
    underPct,
    totalGames
  };

  // Select only the columns needed for the display table
  const displayColumns = [
    'date', 'home_team', 'away_team',
    'home_pitcher', 'home_era', 'home_whip',
    'away_pitcher', 'away_era', 'away_whip',
    'home_score', 'away_score', 'o_u_line',
    'home_rl', 'away_rl',
    'home_ml_handle', 'away_ml_handle', 'home_ml_bets', 'away_ml_bets',
    'home_rl_handle', 'away_rl_handle', 'home_rl_bets', 'away_rl_bets',
    'ou_handle_over', 'ou_bets_over'
  ];
  const gameRows = mostRecent100.map(row => {
    const obj = {};
    displayColumns.forEach(col => { obj[col] = row[col]; });
    return obj;
  });

  console.log(`Query completed successfully. Returned ${mostRecent100?.length || 0} records for table, ${allValid?.length || 0} for summary.`);

  // Log some sample data if available
  if (mostRecent100 && mostRecent100.length > 0) {
    console.log('Sample record o_u_line values:', mostRecent100.slice(0, 3).map(r => r.o_u_line));
  }

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

  return new Response(JSON.stringify({ summary, gameRows }), {
    status: 200,
    headers
  });
});
