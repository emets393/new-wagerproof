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
  
  // Get today's date in Eastern Time
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const today = easternTime.toISOString().split('T')[0];
  console.log(`Current UTC time: ${now.toISOString()}`);
  console.log(`Current Eastern time: ${easternTime.toISOString()}`);
  console.log(`Using 'today' as: ${today}`);
  
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

  let query = supabase.from('training_data').select('*').order('date', { ascending: false });
  console.log('Starting with base query (no limit)');

  // NO DATE FILTER

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
    // Take the 100 most recent valid games
    mostRecent100 = allValid.slice(0, 100);
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
