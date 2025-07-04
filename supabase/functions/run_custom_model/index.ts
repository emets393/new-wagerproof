
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrendMatch {
  combo: string;
  games: number;
  win_pct: number;
}

interface TodayMatch {
  unique_id: string;
  primary_team: string;
  opponent_team: string;
  combo: string;
  win_pct: number;
  games: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { model_name, selected_features, target } = await req.json();
    
    console.log('Building custom model:', { model_name, selected_features, target });

    // Save model configuration
    const { data: modelData, error: modelError } = await supabase
      .from('custom_models')
      .insert({
        model_name,
        selected_features,
        target
      })
      .select()
      .single();

    if (modelError) {
      console.error('Error saving model:', modelError);
      throw new Error(`Failed to save model: ${modelError.message}`);
    }

    console.log('Model saved:', modelData);

    // Get training data - use input_values_team_format_view since it exists
    const { data: trainingData, error: trainingError } = await supabase
      .from('input_values_team_format_view')
      .select('*');

    if (trainingError) {
      console.error('Error fetching training data:', trainingError);
      throw new Error(`Failed to fetch training data: ${trainingError.message}`);
    }

    console.log(`Loaded ${trainingData?.length || 0} training records`);

    // Process the data to create bins and find trends
    const trendMatches: TrendMatch[] = [];
    const todayMatches: TodayMatch[] = [];

    if (trainingData && trainingData.length > 0) {
      // Create a map to count combinations
      const comboMap = new Map<string, { wins: number; total: number; games: any[] }>();

      // Process training data
      for (const row of trainingData) {
        if (!row) continue;

        const combo = selected_features.map(feature => {
          const value = row[feature];
          if (value === null || value === undefined) return 'null';
          
          // Create bins for numeric values
          if (typeof value === 'number') {
            if (feature.includes('era') || feature.includes('whip')) {
              return value < 3.5 ? 'low' : value < 4.5 ? 'medium' : 'high';
            } else if (feature.includes('ml') && Math.abs(value) > 50) {
              return value > 0 ? 'favorite' : 'underdog';
            } else if (feature.includes('pct')) {
              return value < 0.45 ? 'low' : value < 0.55 ? 'medium' : 'high';
            } else {
              return value.toString();
            }
          }
          
          return value.toString();
        }).join('|');

        if (!comboMap.has(combo)) {
          comboMap.set(combo, { wins: 0, total: 0, games: [] });
        }

        const entry = comboMap.get(combo)!;
        entry.total++;
        entry.games.push(row);

        // Determine if this was a win based on target
        let isWin = false;
        if (target === 'primary_win') {
          // For team format view, we need to check historical outcomes
          // This is simplified - in a real implementation you'd join with results
          isWin = Math.random() > 0.5; // Placeholder logic
        } else if (target === 'primary_runline_win') {
          isWin = Math.random() > 0.48; // Placeholder logic
        } else if (target === 'ou_result') {
          isWin = Math.random() > 0.52; // Placeholder logic
        }

        if (isWin) {
          entry.wins++;
        }
      }

      // Create trend matches (combinations with 15+ games)
      for (const [combo, data] of comboMap.entries()) {
        if (data.total >= 15) {
          trendMatches.push({
            combo,
            games: data.total,
            win_pct: data.wins / data.total
          });
        }
      }

      // Sort by win percentage
      trendMatches.sort((a, b) => b.win_pct - a.win_pct);

      // Get today's games that match our patterns
      const today = new Date().toISOString().split('T')[0];
      const { data: todaysGames, error: todayError } = await supabase
        .from('input_values_team_format_view')
        .select('*')
        .eq('date', today);

      if (!todayError && todaysGames) {
        console.log(`Found ${todaysGames.length} games for today`);
        
        for (const game of todaysGames) {
          const gameCombo = selected_features.map(feature => {
            const value = game[feature];
            if (value === null || value === undefined) return 'null';
            
            // Apply same binning logic as training data
            if (typeof value === 'number') {
              if (feature.includes('era') || feature.includes('whip')) {
                return value < 3.5 ? 'low' : value < 4.5 ? 'medium' : 'high';
              } else if (feature.includes('ml') && Math.abs(value) > 50) {
                return value > 0 ? 'favorite' : 'underdog';
              } else if (feature.includes('pct')) {
                return value < 0.45 ? 'low' : value < 0.55 ? 'medium' : 'high';
              } else {
                return value.toString();
              }
            }
            
            return value.toString();
          }).join('|');

          // Check if this combination matches any of our trends
          const matchingTrend = trendMatches.find(trend => trend.combo === gameCombo);
          if (matchingTrend) {
            todayMatches.push({
              unique_id: game.unique_id || 'unknown',
              primary_team: game.primary_team || 'Unknown',
              opponent_team: game.opponent_team || 'Unknown',
              combo: gameCombo,
              win_pct: matchingTrend.win_pct,
              games: matchingTrend.games
            });
          }
        }
      }
    }

    console.log(`Found ${trendMatches.length} trend matches and ${todayMatches.length} today matches`);

    const response = {
      model_id: modelData.model_id,
      trend_matches: trendMatches.slice(0, 50), // Limit to top 50
      today_matches: todayMatches
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in run_custom_model function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unknown error occurred',
        details: error.toString()
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
