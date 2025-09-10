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

  console.log('NFL Edge function received filters:', filters);
  
  // Get today's date in Eastern Time (ET) for consistent date handling
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const today = easternTime.toISOString().split('T')[0];
  console.log('=== NFL DATE DEBUG INFO ===');
  console.log('Current UTC time:', now.toISOString());
  console.log('Current ET time:', easternTime.toISOString());
  console.log('Using today as:', today);
  console.log('==========================');
  
  // Use the college football Supabase client for NFL data
  const supabase = createClient(
    "https://jpxnjuwglavsjbgbasnl.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo"
  );

  // NFL-specific filters
  const numericFiltersWithOperators = new Set([
    "season", "week", "o_u_line", "home_spread", "away_spread", "home_ml", "away_ml",
    "home_ml_handle", "home_ml_bets", "away_ml_handle", "away_ml_bets",
    "home_spread_handle", "home_spread_bets", "away_spread_handle", "away_spread_bets",
    "ou_handle_over", "ou_bets_over", "temperature", "wind_speed", "precipitation"
  ]);

  const booleanFilters = new Set([
    "is_home_team"
  ]);

  const allFilters = [
    ...numericFiltersWithOperators,
    ...booleanFilters,
    "home_team", "away_team", "team_status", "view_type", // view_type: "team" or "game"
    "ou_line_min", "ou_line_max", "spread_min", "spread_max",
    "ou_handle_min", "ou_handle_max", "ou_bets_min", "ou_bets_max",
    "home_ml_handle_min", "home_ml_handle_max", "home_ml_bets_min", "home_ml_bets_max",
    "home_spread_handle_min", "home_spread_handle_max", "home_spread_bets_min", "home_spread_bets_max"
  ];

  // Determine which table to query based on view_type
  const viewType = filters.view_type || "team"; // Default to team view
  // Try different table names that might exist
  const tableName = "nfl_training_data"; // Use the table that exists based on H2HModal
  
  let query = supabase.from(tableName).select('*').order('game_date', { ascending: false });
  console.log(`Starting with base query on ${tableName} (view_type: ${viewType})`);

  // Apply filters to the query
  for (const key of allFilters) {
    const val = filters[key];
    if (!val) continue;

    console.log(`Processing filter: ${key} = ${val}`);

    // Handle special team_status filter for home/away favored
    if (key === 'team_status') {
      if (val === 'home_favored') {
        console.log('Applying home favored filter: home_spread < 0');
        query = query.filter('home_spread', 'lt', 0);
      } else if (val === 'away_favored') {
        console.log('Applying away favored filter: away_spread < 0');
        query = query.filter('away_spread', 'lt', 0);
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

    // Handle multi-select for season and week
    if ((key === 'season' || key === 'week') && val.includes(',')) {
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

    // Handle spread range filters
    if (key === 'spread_min') {
      console.log(`Applying spread min filter: home_spread >= ${val}`);
      query = query.gte('home_spread', parseFloat(val));
      continue;
    }
    if (key === 'spread_max') {
      console.log(`Applying spread max filter: home_spread <= ${val}`);
      query = query.lte('home_spread', parseFloat(val));
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

    // Handle home ML betting filters
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

    // Handle home spread betting filters
    if (key === 'home_spread_handle_min') {
      console.log(`Applying home spread handle min filter: home_spread_handle >= ${val}`);
      query = query.gte('home_spread_handle', parseFloat(val));
      continue;
    }
    if (key === 'home_spread_handle_max') {
      console.log(`Applying home spread handle max filter: home_spread_handle <= ${val}`);
      query = query.lte('home_spread_handle', parseFloat(val));
      continue;
    }
    if (key === 'home_spread_bets_min') {
      console.log(`Applying home spread bets min filter: home_spread_bets >= ${val}`);
      query = query.gte('home_spread_bets', parseFloat(val));
      continue;
    }
    if (key === 'home_spread_bets_max') {
      console.log(`Applying home spread bets max filter: home_spread_bets <= ${val}`);
      query = query.lte('home_spread_bets', parseFloat(val));
      continue;
    }

    // Handle team filters
    if (key === 'home_team' && val.includes(',')) {
      const teams = val.split(',').map(t => t.trim());
      console.log(`Applying home team filter: home_team in`, teams);
      query = query.in('home_team', teams);
      continue;
    }
    if (key === 'away_team' && val.includes(',')) {
      const teams = val.split(',').map(t => t.trim());
      console.log(`Applying away team filter: away_team in`, teams);
      query = query.in('away_team', teams);
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
      } else if ((key === 'season' || key === 'week') && val.includes(',')) {
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

  // JS-side fallback: filter out any rows with null results
  let allValid = [];
  let mostRecent100 = [];
  if (data) {
    const before = data.length;
    allValid = data.filter(row => row.ou_result !== null);
    const after = allValid.length;
    if (before !== after) {
      console.log(`Filtered out ${before - after} rows with null ou_result in JS fallback.`);
    }

    // If view_type is "game", deduplicate by unique_id
    if (viewType === "game") {
      console.log('Deduplicating data by unique_id for game-level view');
      const uniqueGames = new Map();
      allValid.forEach(row => {
        if (row.unique_id && !uniqueGames.has(row.unique_id)) {
          uniqueGames.set(row.unique_id, row);
        }
      });
      allValid = Array.from(uniqueGames.values());
      console.log(`Deduplicated from ${data.length} to ${allValid.length} unique games`);
    }

    // Take the 25 most recent valid games
    mostRecent100 = allValid.slice(0, 25);
    console.log(`Returning ${mostRecent100.length} most recent valid games for table.`);
    
    // Log date ranges
    if (allValid.length > 0) {
      const allDates = allValid.map(row => row.game_date).filter(Boolean).sort();
      console.log('ALL: Earliest date:', allDates[0]);
      console.log('ALL: Latest date:', allDates[allDates.length - 1]);
      console.log('ALL: Total valid games:', allValid.length);
    }
    if (mostRecent100.length > 0) {
      const tableDates = mostRecent100.map(row => row.game_date).filter(Boolean).sort();
      console.log('TABLE: Earliest date:', tableDates[0]);
      console.log('TABLE: Latest date:', tableDates[tableDates.length - 1]);
      console.log('TABLE: Total games:', mostRecent100.length);
    }
  }

  // Calculate summary stats from allValid
  const totalGames = allValid.length;
  const homeWins = allValid.filter(game => game.home_score > game.away_score).length;
  const awayWins = allValid.filter(game => game.away_score > game.home_score).length;
  const homeCovers = allValid.filter(game => game.home_away_spread_cover === 1).length;
  const awayCovers = allValid.filter(game => game.home_away_spread_cover === 0).length;
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
    'game_date', 'home_team', 'away_team', 'home_score', 'away_score',
    'o_u_line', 'home_spread', 'away_spread', 'home_ml', 'away_ml',
    'home_ml_handle', 'away_ml_handle', 'home_ml_bets', 'away_ml_bets',
    'home_spread_handle', 'away_spread_handle', 'home_spread_bets', 'away_spread_bets',
    'ou_handle_over', 'ou_bets_over', 'temperature', 'wind_speed', 'precipitation',
    'home_away_spread_cover', 'ou_result'
  ];
  
  const gameRows = mostRecent100.map(row => {
    const obj = {};
    displayColumns.forEach(col => { obj[col] = row[col]; });
    return obj;
  });

  console.log(`Query completed successfully. Returned ${mostRecent100?.length || 0} records for table, ${allValid?.length || 0} for summary.`);

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
