import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reuse the binValue function from the main model
function binValue(feature: string, value: any): string {
  if (value === null || value === undefined) return 'null';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (feature.includes('era') || feature.includes('whip')) {
    if (isNaN(numValue)) return 'null';
    return numValue < 3.5 ? 'good' : numValue < 4.5 ? 'average' : 'poor';
  }
  
  if (feature.includes('win_pct')) {
    if (isNaN(numValue)) return 'null';
    return numValue < 0.45 ? 'poor' : numValue < 0.55 ? 'average' : 'good';
  }
  
  if (feature.includes('ops')) {
    if (isNaN(numValue)) return 'null';
    return numValue < 0.700 ? 'poor' : numValue < 0.800 ? 'average' : 'good';
  }
  
  if (feature.includes('streak')) {
    if (isNaN(numValue)) return 'null';
    return numValue < -2 ? 'cold' : numValue > 2 ? 'hot' : 'neutral';
  }
  
  if (feature.includes('last_runs')) {
    if (isNaN(numValue)) return 'null';
    return numValue < 3 ? 'low' : numValue > 6 ? 'high' : 'medium';
  }
  
  if (feature === 'primary_rl') {
    if (isNaN(numValue)) return 'null';
    return numValue < 0 ? 'favorite' : 'underdog';
  }
  
  if (feature === 'o_u_line') {
    if (isNaN(numValue)) return 'null';
    return numValue < 8.5 ? 'low' : numValue > 9.5 ? 'high' : 'medium';
  }
  
  if (feature.includes('handle') || feature.includes('bets')) {
    if (isNaN(numValue) || numValue <= 0) return 'minimal';
    if (numValue < 1000) return 'low';
    if (numValue < 10000) return 'medium';
    return 'high';
  }
  
  if (feature.includes('handedness') || feature.includes('same_') || feature.includes('last_win')) {
    return value ? 'yes' : 'no';
  }
  
  if (feature.includes('last_3')) {
    if (isNaN(numValue)) return 'null';
    return numValue < 0.333 ? 'poor' : numValue > 0.667 ? 'good' : 'average';
  }
  
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
    
    console.log('Checking saved patterns for user:', userId);

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

    // Get today's games using local timezone instead of UTC
    const today = new Date().toLocaleDateString('en-CA'); // Returns YYYY-MM-DD format in local timezone
    const { data: todaysGames, error: todayError } = await supabase
      .from('input_values_team_format_view')
      .select('*')
      .eq('date', today);

    if (todayError || !todaysGames) {
      console.log('No games found for today or error:', todayError);
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
            target: pattern.target
          });

          // Insert into pattern_daily_matches table
          await supabase
            .from('pattern_daily_matches')
            .upsert({
              saved_pattern_id: pattern.id,
              match_date: today,
              unique_id: game.unique_id,
              primary_team: game.primary_team || 'Unknown',
              opponent_team: game.opponent_team || 'Unknown',
              is_home_game: game.is_home_team || false
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
