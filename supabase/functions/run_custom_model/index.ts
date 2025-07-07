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
  feature_count: number;
  features: string[];
  perspective: string; // 'primary' or 'opponent'
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
  feature_count: number;
  features: string[];
  perspective: string; // 'primary' or 'opponent'
}

interface ModelResults {
  model_id: string;
  trend_matches: TrendMatch[];
  today_matches: TodayMatch[];
  target: string;
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

// Generate combinations of features
function generateCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (size > arr.length) return [];
  
  const result: T[][] = [];
  
  function backtrack(start: number, current: T[]) {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  
  backtrack(0, []);
  return result;
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
    console.log('Memory usage before processing:', Deno.memoryUsage());

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

    // Get training data from the team format view - both perspectives for richer patterns
    const { data: rawTrainingData, error: trainingError } = await supabase
      .from('training_data_team_view')
      .select('*'); // Get all perspectives for dual-perspective training

    if (trainingError) {
      console.error('Error fetching training data:', trainingError);
      throw new Error(`Failed to fetch training data: ${trainingError.message}`);
    }

    const trainingData = rawTrainingData;
    console.log(`Loaded ${trainingData?.length || 0} training records (both perspectives)`);

    const allTrendMatches: TrendMatch[] = [];
    let topTrendMatches: TrendMatch[] = [];

    if (trainingData && trainingData.length > 0) {
      // Generate feature combinations to analyze
      const featureCombinations: Array<{ features: string[], size: number }> = [];
      
      // Always include the full feature set
      featureCombinations.push({ 
        features: selected_features, 
        size: selected_features.length 
      });
      
      // Add 5-feature combinations if we have 6+ features
      if (selected_features.length >= 6) {
        const fiveFeatureCombos = generateCombinations(selected_features, 5);
        // Limit to prevent memory issues - take top 20 combinations
        const limitedFiveCombos = fiveFeatureCombos.slice(0, 20);
        limitedFiveCombos.forEach(combo => {
          featureCombinations.push({ features: combo, size: 5 });
        });
        console.log(`Added ${limitedFiveCombos.length} five-feature combinations`);
      }
      
      // Add 4-feature combinations if we have 5+ features
      if (selected_features.length >= 5) {
        const fourFeatureCombos = generateCombinations(selected_features, 4);
        // Limit to prevent memory issues - take top 30 combinations
        const limitedFourCombos = fourFeatureCombos.slice(0, 30);
        limitedFourCombos.forEach(combo => {
          featureCombinations.push({ features: combo, size: 4 });
        });
        console.log(`Added ${limitedFourCombos.length} four-feature combinations`);
      }

      console.log(`Total feature combinations to analyze: ${featureCombinations.length}`);

      // Process each feature combination
      for (const { features, size } of featureCombinations) {
        console.log(`Processing ${size}-feature combination:`, features);
        
        // Separate maps for each perspective to prevent inverse pattern matching
        const primaryComboMap = new Map<string, { wins: number; total: number }>();
        const opponentComboMap = new Map<string, { wins: number; total: number }>();

        // Process training data
        let processedCount = 0;
        for (const row of trainingData) {
          if (!row) continue;
          
          processedCount++;

          // Create binned feature combination for this specific feature set
          const binnedFeatures = features.map(feature => {
            const value = row[feature];
            return binValue(feature, value);
          });

          const combo = binnedFeatures.join('|');
          
          // Determine perspective based on whether this row represents primary or opponent view
          const perspective = row.is_home_team ? 'primary' : 'opponent';
          const comboMap = perspective === 'primary' ? primaryComboMap : opponentComboMap;

          // Initialize or get existing combo data
          if (!comboMap.has(combo)) {
            comboMap.set(combo, { wins: 0, total: 0 });
          }

          const entry = comboMap.get(combo)!;
          entry.total++;

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
          }
        }

        // Create trend matches for primary perspective
        for (const [combo, data] of primaryComboMap.entries()) {
          const minGames = size >= 5 ? 25 : 30;
          
          if (data.total >= minGames) {
            const winPct = data.wins / data.total;
            
            if (winPct >= 0.55 || winPct <= 0.45) {
              allTrendMatches.push({
                combo,
                games: data.total,
                win_pct: winPct,
                opponent_win_pct: 1 - winPct,
                feature_count: size,
                features: features,
                perspective: 'primary'
              });
            }
          }
        }

        // Create trend matches for opponent perspective
        for (const [combo, data] of opponentComboMap.entries()) {
          const minGames = size >= 5 ? 25 : 30;
          
          if (data.total >= minGames) {
            const winPct = data.wins / data.total;
            
            if (winPct >= 0.55 || winPct <= 0.45) {
              allTrendMatches.push({
                combo,
                games: data.total,
                win_pct: winPct,
                opponent_win_pct: 1 - winPct,
                feature_count: size,
                features: features,
                perspective: 'opponent'
              });
            }
          }
        }

        // Check memory usage after each combination
        const memUsage = Deno.memoryUsage();
        console.log(`Memory after ${size}-feature combo:`, { 
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), 
          external: Math.round(memUsage.external / 1024 / 1024) 
        });
      }

      // Sort all trend matches by predictive strength and sample size
      allTrendMatches.sort((a, b) => {
        const scoreA = Math.max(a.win_pct, a.opponent_win_pct) * Math.log(a.games) * (a.feature_count / 10); // Slight bonus for more features
        const scoreB = Math.max(b.win_pct, b.opponent_win_pct) * Math.log(b.games) * (b.feature_count / 10);
        return scoreB - scoreA;
      });

      // Take top 15 patterns - these are the ones we'll return AND use for matching
      topTrendMatches = allTrendMatches.slice(0, 15);

      console.log(`Selected top ${topTrendMatches.length} trend matches from ${allTrendMatches.length} total patterns`);
    }

    // Get today's games and match them ONLY against the top patterns
    const allTodayMatches: TodayMatch[] = [];
    const today = new Date().toISOString().split('T')[0];
    const { data: todaysGames, error: todayError } = await supabase
      .from('input_values_team_format_view')
      .select('*')
      .eq('date', today);

    if (!todayError && todaysGames && topTrendMatches.length > 0) {
      console.log(`Found ${todaysGames.length} games for today`);
      
      // Check each game perspective independently against trend patterns
      for (const game of todaysGames) {
        let foundMatch = false;
        
        // Determine the perspective of this game
        const gamePerspective = game.is_home_team ? 'primary' : 'opponent';
        
        for (const trend of topTrendMatches) {
          // Only match within the same perspective to prevent inverse predictions
          if (trend.perspective !== gamePerspective) {
            continue;
          }
          
          const gameBinnedFeatures = trend.features.map(feature => {
            const value = game[feature];
            return binValue(feature, value);
          });
          
          const gameCombo = gameBinnedFeatures.join('|');

          // Check if this exact combination matches the trend pattern
          if (gameCombo === trend.combo) {
            allTodayMatches.push({
              unique_id: game.unique_id || 'unknown',
              primary_team: game.primary_team || 'Unknown',
              opponent_team: game.opponent_team || 'Unknown',
              is_home_team: game.is_home_team || false,
              combo: gameCombo,
              win_pct: trend.win_pct,
              opponent_win_pct: trend.opponent_win_pct,
              games: trend.games,
              feature_count: trend.feature_count,
              features: trend.features,
              perspective: trend.perspective
            });
            foundMatch = true;
            break; // Only match each game perspective once per pattern
          }
        }
        
        // Log when a game perspective doesn't match any patterns
        if (!foundMatch) {
          console.log(`No pattern match found for ${game.primary_team} vs ${game.opponent_team} (${game.is_home_team ? 'home' : 'away'}) perspective: ${gamePerspective}`);
        }
      }
    }

    console.log(`Found ${topTrendMatches.length} trend matches and ${allTodayMatches.length} today matches`);
    console.log('Final memory usage:', Deno.memoryUsage());

    const response = {
      model_id: modelData.model_id,
      trend_matches: topTrendMatches, // Return the top 15 patterns
      today_matches: allTodayMatches,
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
