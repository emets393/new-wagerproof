import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { format } from "https://esm.sh/date-fns@3.6.0";
import { toZonedTime } from "https://esm.sh/date-fns-tz@3.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Get today's date in Eastern Time (ET) formatted as YYYY-MM-DD
 * This ensures consistent date handling between frontend and backend
 */
function getTodayInET(): string {
  const now = new Date();
  const easternTime = toZonedTime(now, 'America/New_York');
  return format(easternTime, 'yyyy-MM-dd');
}

/**
 * Get current date and time info for logging purposes
 */
function getDateDebugInfo() {
  const now = new Date();
  const easternTime = toZonedTime(now, 'America/New_York');
  const utcTime = now.toISOString();
  const etDate = format(easternTime, 'yyyy-MM-dd');
  const etDateTime = format(easternTime, 'yyyy-MM-dd HH:mm:ss zzz');
  
  return {
    utcTime,
    etDate,
    etDateTime,
    easternTime
  };
}

// Smart binning function for different feature types - MUST match run_custom_model exactly
function binValue(feature: string, value: any): string {
  if (value === null || value === undefined) return 'null';
  
  // Convert to number if it's a string representation of a number
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // ERA (pitching stats) - lower is better
  if (feature.includes('era')) {
    if (isNaN(numValue)) return 'null';
    return numValue < 3.5 ? 'good' : numValue < 4.5 ? 'average' : 'poor';
  }
  
  // WHIP (pitching stats) - lower is better, different thresholds than ERA
  if (feature.includes('whip')) {
    if (isNaN(numValue)) return 'null';
    return numValue < 1.2 ? 'good' : numValue < 1.4 ? 'average' : 'poor';
  }
  
  // Win percentage - standard ranges
  if (feature.includes('win_pct')) {
    if (isNaN(numValue)) return 'null';
    return numValue < 0.45 ? 'poor' : numValue < 0.55 ? 'average' : 'good';
  }
  
  // OPS (offensive stats) - higher is better
  if (feature.includes('ops')) {
    if (isNaN(numValue)) return 'null';
    return numValue < 0.700 ? 'poor' : numValue < 0.800 ? 'average' : 'good';
  }
  
  // Streaks - can be positive or negative
  if (feature.includes('streak')) {
    if (isNaN(numValue)) return 'null';
    return numValue < -2 ? 'cold' : numValue > 2 ? 'hot' : 'neutral';
  }
  
  // Last runs scored/allowed
  if (feature.includes('last_runs')) {
    if (isNaN(numValue)) return 'null';
    return numValue < 3 ? 'low' : numValue > 6 ? 'high' : 'medium';
  }
  
  // Run line spread (primary_rl) - indicates favorite/underdog
  if (feature === 'primary_rl') {
    if (isNaN(numValue)) return 'null';
    return numValue < 0 ? 'favorite' : 'underdog';
  }
  
  // Over/Under line
  if (feature === 'o_u_line') {
    if (isNaN(numValue)) return 'null';
    return numValue < 8.5 ? 'low' : numValue > 9.5 ? 'high' : 'medium';
  }
  
  // Betting volume (handles and bets) - these appear to be percentages (0.61 = 61%)
  if (feature.includes('handle') || feature.includes('bets')) {
    if (isNaN(numValue) || numValue <= 0) return 'minimal';
    // Treat as percentages: 0.0-1.0 range
    if (numValue < 0.3) return 'low';
    if (numValue < 0.6) return 'medium';
    return 'high';
  }
  
  // Boolean fields (handedness, same_league, same_division, last_win)
  if (feature.includes('handedness') || feature.includes('same_') || feature.includes('last_win')) {
    return value ? 'yes' : 'no';
  }
  
  // Team performance over last 3 games
  if (feature.includes('last_3')) {
    if (isNaN(numValue)) return 'null';
    return numValue < 0.333 ? 'poor' : numValue > 0.667 ? 'good' : 'average';
  }
  
  // Default: convert to string
  return String(value);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId } = await req.json();
    
    const debugInfo = getDateDebugInfo();
    console.log('=== EDGE FUNCTION DATE DEBUG INFO ===');
    console.log('Checking saved patterns for user:', userId);
    console.log('UTC Time:', debugInfo.utcTime);
    console.log('ET Date:', debugInfo.etDate);
    console.log('ET DateTime:', debugInfo.etDateTime);
    console.log('=====================================');

    // Get user's saved patterns
    const { data: savedPatterns, error: patternsError } = await supabase
      .from('saved_trend_patterns')
      .select('*')
      .eq('user_id', userId);

    if (patternsError) {
      throw new Error(`Failed to fetch saved patterns: ${patternsError.message}`);
    }

    if (!savedPatterns || savedPatterns.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get today's games using Eastern Time consistently
    const today = getTodayInET();
    console.log('Fetching games for ET date:', today);
    const dateDebugInfo = getDateDebugInfo();
    console.log('=== EDGE FUNCTION DATE DEBUG INFO ===');
    console.log('UTC Time:', dateDebugInfo.utcTime);
    console.log('ET Date:', dateDebugInfo.etDate);
    console.log('ET DateTime:', dateDebugInfo.etDateTime);
    console.log('=====================================');
    
    const { data: todaysGames, error: todayError } = await supabase
      .from('input_values_team_format_view')
      .select('*')
      .eq('date', today);

    if (todayError || !todaysGames) {
      console.log('No games found for today or error:', todayError);
      console.log('Searched for date:', today);
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${todaysGames.length} games for ET date: ${today}`);

    const allMatches = [];

    // Check each saved pattern against today's games
    for (const pattern of savedPatterns) {
      for (const game of todaysGames) {
        const gameBinnedFeatures = pattern.features.map((feature: string) => {
          const value = game[feature];
          return binValue(feature, value);
        });
        
        const gameCombo = gameBinnedFeatures.join('|');

        if (gameCombo === pattern.combo) {
          // Fetch latest betting lines from circa_lines
          let circaLines = null;
          try {
            const { data: lines, error: linesError } = await supabase
              .from('circa_lines')
              .select('o_u_line, Money_Home, Money_Away, RL_Home, RL_Away')
              .eq('unique_id', game.unique_id)
              .order('import_time', { ascending: false })
              .limit(1)
              .single();
            if (!linesError && lines) {
              circaLines = lines;
            }
          } catch (e) {
            circaLines = null;
          }

          // Properly map betting lines based on actual home/away team status
          const homeTeam = game.is_home_team ? game.primary_team : game.opponent_team;
          const awayTeam = game.is_home_team ? game.opponent_team : game.primary_team;
          
          console.log(`Game ${game.unique_id}: ${awayTeam} @ ${homeTeam}`);
          console.log(`Primary team: ${game.primary_team}, Is home: ${game.is_home_team}`);
          console.log(`Home ML: ${circaLines?.Money_Home ?? (game.is_home_team ? game.primary_ml : game.opponent_ml)}`);
          console.log(`Away ML: ${circaLines?.Money_Away ?? (game.is_home_team ? game.opponent_ml : game.primary_ml)}`);

          allMatches.push({
            pattern_id: pattern.id,
            pattern_name: pattern.pattern_name,
            unique_id: game.unique_id,
            primary_team: game.primary_team,
            opponent_team: game.opponent_team,
            is_home_game: game.is_home_team,
            win_pct: pattern.win_pct,
            opponent_win_pct: pattern.opponent_win_pct,
            games: pattern.games,
            target: pattern.target,
            // Use circa_lines if available, otherwise fallback to view fields
            o_u_line: circaLines?.o_u_line ?? game.o_u_line,
            // Home team's lines (regardless of primary/opponent status)
            home_ml: circaLines?.Money_Home ?? (game.is_home_team ? game.primary_ml : game.opponent_ml),
            away_ml: circaLines?.Money_Away ?? (game.is_home_team ? game.opponent_ml : game.primary_ml),
            home_rl: circaLines?.RL_Home ?? (game.is_home_team ? game.primary_rl : game.opponent_rl),
            away_rl: circaLines?.RL_Away ?? (game.is_home_team ? game.opponent_rl : game.primary_rl)
          });

          // Get game data from training_data_team_view for the new columns
          const { data: gameData } = await supabase
            .from('training_data_team_view')
            .select('primary_ml, primary_rl, opponent_ml, opponent_rl, ou_result, primary_win, primary_runline_win')
            .eq('unique_id', game.unique_id)
            .eq('primary_team', game.primary_team)
            .eq('opponent_team', game.opponent_team)
            .single();

          // Insert into pattern_daily_matches table
          await supabase
            .from('pattern_daily_matches')
            .upsert({
              saved_pattern_id: pattern.id,
              match_date: today,
              unique_id: game.unique_id,
              primary_team: game.primary_team || 'Unknown',
              opponent_team: game.opponent_team || 'Unknown',
              is_home_game: game.is_home_team || false,
              primary_ml: gameData?.primary_ml || null,
              primary_rl: gameData?.primary_rl || null,
              opponent_ml: gameData?.opponent_ml || null,
              opponent_rl: gameData?.opponent_rl || null,
              ou_result: gameData?.ou_result || null,
              primary_win: gameData?.primary_win || null,
              primary_runline_win: gameData?.primary_runline_win || null
            });
        }
      }
    }

    console.log(`Found ${allMatches.length} matches for ${savedPatterns.length} saved patterns`);

    return new Response(JSON.stringify({ matches: allMatches }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check_saved_patterns function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unknown error occurred',
        matches: []
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
