
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
  opponent_win_pct: number;
}

interface TodayMatch {
  unique_id: string;
  primary_team: string;
  opponent_team: string;
  is_home_team: boolean;
  combo: string;
  win_pct: number;
  opponent_win_pct: number;
  games: number;
}

// Map clean target names to actual database columns
function getTargetColumn(target: string): string {
  if (target === "moneyline") return "primary_win";
  if (target === "runline") return "primary_runline_win"; 
  if (target === "over_under") return "ou_result";
  return target; // fallback
}

// Smart binning function for different feature types
function binValue(feature: string, value: any): string {
  if (value === null || value === undefined) return 'null';
  
  // Convert to number if it's a string representation of a number
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // ERA and WHIP (pitching stats) - lower is better
  if (feature.includes('era') || feature.includes('whip')) {
    if (isNaN(numValue)) return 'null';
    return numValue < 3.5 ? 'good' : numValue < 4.5 ? 'average' : 'poor';
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
  
  // Betting volume (handles and bets) - log scale binning
  if (feature.includes('handle') || feature.includes('bets')) {
    if (isNaN(numValue) || numValue <= 0) return 'minimal';
    if (numValue < 1000) return 'low';
    if (numValue < 10000) return 'medium';
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

    // Map the clean target name to database column
    const targetColumn = getTargetColumn(target);
    console.log(`Target mapping: ${target} -> ${targetColumn}`);

    // Save model configuration
    const { data: modelData, error: modelError } = await supabase
      .from('custom_models')
      .insert({
        model_name,
        selected_features,
        target: targetColumn // Store the actual column name
      })
      .select()
      .single();

    if (modelError) {
      console.error('Error saving model:', modelError);
      throw new Error(`Failed to save model: ${modelError.message}`);
    }

    console.log('Model saved:', modelData);

    // Get training data from the team format view
    const { data: trainingData, error: trainingError } = await supabase
      .from('training_data_team_view')
      .select('*');

    if (trainingError) {
      console.error('Error fetching training data:', trainingError);
      throw new Error(`Failed to fetch training data: ${trainingError.message}`);
    }

    console.log(`Loaded ${trainingData?.length || 0} training records`);

    const trendMatches: TrendMatch[] = [];
    const todayMatches: TodayMatch[] = [];

    if (trainingData && trainingData.length > 0) {
      // Create combination maps for analysis
      const comboMap = new Map<string, { wins: number; total: number; games: any[] }>();
      const fourFeatureMap = new Map<string, { wins: number; total: number }>();
      const fiveFeatureMap = new Map<string, { wins: number; total: number }>();

      // Process training data
      for (const row of trainingData) {
        if (!row) continue;

        // Create binned feature combination
        const binnedFeatures = selected_features.map(feature => {
          const value = row[feature];
          return binValue(feature, value);
        });

        const combo = binnedFeatures.join('|');
        
        // Also create 4-feature and 5-feature combinations for deeper analysis
        if (selected_features.length >= 4) {
          const fourFeatureCombo = binnedFeatures.slice(0, 4).join('|');
          if (!fourFeatureMap.has(fourFeatureCombo)) {
            fourFeatureMap.set(fourFeatureCombo, { wins: 0, total: 0 });
          }
        }
        
        if (selected_features.length >= 5) {
          const fiveFeatureCombo = binnedFeatures.slice(0, 5).join('|');
          if (!fiveFeatureMap.has(fiveFeatureCombo)) {
            fiveFeatureMap.set(fiveFeatureCombo, { wins: 0, total: 0 });
          }
        }

        if (!comboMap.has(combo)) {
          comboMap.set(combo, { wins: 0, total: 0, games: [] });
        }

        const entry = comboMap.get(combo)!;
        entry.total++;
        entry.games.push(row);

        // Determine if this was a win based on target outcome
        let isWin = false;
        const outcome = row[targetColumn];
        
        if (targetColumn === 'primary_win') {
          isWin = outcome === 1 || outcome === true;
        } else if (targetColumn === 'primary_runline_win') {
          isWin = outcome === 1 || outcome === true;
        } else if (targetColumn === 'ou_result') {
          isWin = outcome === 1 || outcome === true; // 1 for over, 0 for under
        }

        if (isWin) {
          entry.wins++;
          
          // Update 4-feature and 5-feature maps
          if (selected_features.length >= 4) {
            const fourFeatureCombo = binnedFeatures.slice(0, 4).join('|');
            fourFeatureMap.get(fourFeatureCombo)!.wins++;
          }
          
          if (selected_features.length >= 5) {
            const fiveFeatureCombo = binnedFeatures.slice(0, 5).join('|');
            fiveFeatureMap.get(fiveFeatureCombo)!.wins++;
          }
        }
        
        // Update totals for sub-combinations
        if (selected_features.length >= 4) {
          const fourFeatureCombo = binnedFeatures.slice(0, 4).join('|');
          fourFeatureMap.get(fourFeatureCombo)!.total++;
        }
        
        if (selected_features.length >= 5) {
          const fiveFeatureCombo = binnedFeatures.slice(0, 5).join('|');
          fiveFeatureMap.get(fiveFeatureCombo)!.total++;
        }
      }

      // Create trend matches (combinations with 30+ games and >55% win rate)
      for (const [combo, data] of comboMap.entries()) {
        if (data.total >= 30) {
          const winPct = data.wins / data.total;
          if (winPct >= 0.55) { // Only include patterns with meaningful edge
            trendMatches.push({
              combo,
              games: data.total,
              win_pct: winPct,
              opponent_win_pct: 1 - winPct
            });
          }
        }
      }

      // Sort by win percentage and sample size
      trendMatches.sort((a, b) => {
        const scoreA = a.win_pct * Math.log(a.games);
        const scoreB = b.win_pct * Math.log(b.games);
        return scoreB - scoreA;
      });

      // Get today's games that match our patterns
      const today = new Date().toISOString().split('T')[0];
      const { data: todaysGames, error: todayError } = await supabase
        .from('input_values_team_format_view')
        .select('*')
        .eq('date', today);

      if (!todayError && todaysGames) {
        console.log(`Found ${todaysGames.length} games for today`);
        
        for (const game of todaysGames) {
          const gameBinnedFeatures = selected_features.map(feature => {
            const value = game[feature];
            return binValue(feature, value);
          });
          
          const gameCombo = gameBinnedFeatures.join('|');

          // Check if this combination matches any of our successful trends
          const matchingTrend = trendMatches.find(trend => trend.combo === gameCombo);
          if (matchingTrend) {
            todayMatches.push({
              unique_id: game.unique_id || 'unknown',
              primary_team: game.primary_team || 'Unknown',
              opponent_team: game.opponent_team || 'Unknown',
              is_home_team: game.is_home_team || false,
              combo: gameCombo,
              win_pct: matchingTrend.win_pct,
              opponent_win_pct: matchingTrend.opponent_win_pct,
              games: matchingTrend.games
            });
          }
        }
      }
    }

    console.log(`Found ${trendMatches.length} trend matches and ${todayMatches.length} today matches`);

    const response = {
      model_id: modelData.model_id,
      trend_matches: trendMatches.slice(0, 15), // Top 15 patterns
      today_matches: todayMatches,
      target: target // Include target for frontend logic
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
