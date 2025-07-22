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
  dominant_side: string; // 'primary' or 'opponent'
  dominant_win_pct: number; // The higher win percentage
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
  primary_vs_opponent_id: string; // Add orientation identifier
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

    // Map the clean target name to database column
    const targetColumn = getTargetColumn(target);

    // Save model configuration (skip for now to avoid table dependency issues)
    const modelData = {
      model_id: `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Get training data from the team format table - filter to one perspective per game
    const { data: rawTrainingData, error: trainingError } = await supabase
      .from('training_data_team_with_orientation')
      .select('*')
      .limit(5000); // Limit to prevent timeouts

    if (trainingError) {
      console.error('Error fetching training data:', trainingError);
      throw new Error(`Failed to fetch training data: ${trainingError.message}`);
    }

    // Filter to only include one perspective per unique game to eliminate double-counting
    const seenGames = new Set<string>();
    const trainingData = rawTrainingData?.filter(row => {
      if (!row.unique_id) return false;
      if (seenGames.has(row.unique_id)) return false;
      seenGames.add(row.unique_id);
      return true;
    }) || [];
    
    console.log(`Loaded ${trainingData.length} training records (one perspective per game, filtered from ${rawTrainingData?.length || 0} total)`);
    console.log('Sample training data row:', trainingData[0]);

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
        // Limit to prevent memory issues - take top 10 combinations
        const limitedFiveCombos = fiveFeatureCombos.slice(0, 10);
        limitedFiveCombos.forEach(combo => {
          featureCombinations.push({ features: combo, size: 5 });
        });
      }
      
      // Add 4-feature combinations if we have 5+ features
      if (selected_features.length >= 5) {
        const fourFeatureCombos = generateCombinations(selected_features, 4);
        // Limit to prevent memory issues - take top 15 combinations
        const limitedFourCombos = fourFeatureCombos.slice(0, 15);
        limitedFourCombos.forEach(combo => {
          featureCombinations.push({ features: combo, size: 4 });
        });
      }

      console.log(`Total feature combinations to analyze: ${featureCombinations.length}`);

      // Process each feature combination
      for (const { features, size } of featureCombinations) {
        console.log(`Processing ${size}-feature combination:`, features);
        
        // Separate maps for each perspective to prevent inverse pattern matching
        const primaryComboMap = new Map<string, { wins: number; total: number }>();

        // Process training data
        let processedCount = 0;
        for (const row of trainingData) {
          if (!row) continue;
          
          processedCount++;

          // Create binned feature combination for this specific feature set
          const binnedFeatures = features.map(feature => {
            const value = row[feature];
            const binned = binValue(feature, value);
            if (processedCount === 1) {
              console.log(`Feature ${feature}: value=${value}, binned=${binned}`);
            }
            return binned;
          });

          const combo = binnedFeatures.join('|');
          
          // Always treat rows as 'primary' perspective - each team's data represents their own performance
          // This allows both teams to be evaluated against historical primary team patterns
          const perspective = 'primary';
          const comboMap = primaryComboMap;

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
        console.log(`Primary combo map has ${primaryComboMap.size} combinations`);
        for (const [combo, data] of primaryComboMap.entries()) {
          const minGames = size >= 5 ? 50 : 100; // Lower thresholds to find more patterns
          
          console.log(`Combo "${combo}": ${data.wins}/${data.total} wins (${(data.wins/data.total*100).toFixed(1)}%), min required: ${minGames}`);
          
          if (data.total >= minGames) {
            const winPct = data.wins / data.total;
            const oppWinPct = 1 - winPct;
            
            // Include pattern if either side has a strong win percentage (>= 57%)
            if (winPct >= 0.57 || oppWinPct >= 0.57) {
              // Determine which side is dominant (the one with higher win percentage)
              const dominant_side = winPct >= oppWinPct ? 'primary' : 'opponent';
              const dominant_win_pct = Math.max(winPct, oppWinPct);
              
              console.log(`Adding pattern: ${combo} (${(dominant_win_pct*100).toFixed(1)}% ${dominant_side} dominant)`);
              
              allTrendMatches.push({
                combo,
                games: data.total,
                win_pct: winPct,
                opponent_win_pct: oppWinPct,
                dominant_side: dominant_side,
                dominant_win_pct: dominant_win_pct,
                feature_count: size,
                features: features,
                perspective: 'primary'
              });
            } else {
              console.log(`Pattern ${combo} doesn't meet win percentage threshold (${(winPct*100).toFixed(1)}% vs ${(oppWinPct*100).toFixed(1)}%)`);
            }
          } else {
            console.log(`Pattern ${combo} doesn't meet minimum games threshold (${data.total} < ${minGames})`);
          }
        }

        // Check memory usage after each combination
        const memUsage = Deno.memoryUsage();
        console.log(`Memory after ${size}-feature combo:`, { 
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), 
          external: Math.round(memUsage.external / 1024 / 1024) 
        });
      }

      // Sort patterns by dominant win percentage (highest first)
      allTrendMatches.sort((a, b) => b.dominant_win_pct - a.dominant_win_pct);
      
      // Take the top 20 (or all available if less than 20)
      topTrendMatches = allTrendMatches.slice(0, 20);
      
      console.log(`Selected top ${topTrendMatches.length} trend matches from ${allTrendMatches.length} total patterns`);
    }

    // Get today's games and match them ONLY against the top patterns
    const allTodayMatches: TodayMatch[] = [];
    // Get today's date in Eastern Time (ET) for consistent date handling
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const today = easternTime.toISOString().split('T')[0];
    console.log('Fetching games for ET date:', today);
    
    const { data: todaysGames, error: todayError } = await supabase
      .from('input_values_team_format_view')
      .select('*')
      .eq('date', today);

    if (todayError) {
      console.error('Error fetching today\'s games:', todayError);
      throw new Error(`Failed to fetch today's games: ${todayError.message}`);
    }

    if (todaysGames && topTrendMatches.length > 0) {
      console.log(`Found ${todaysGames.length} rows for today's games`);
      
      // Group games by unique_id to prevent duplicate inverse matches
      const groupedGames = new Map<string, any[]>();
      
      for (const game of todaysGames) {
        const uniqueId = game.unique_id;
        if (!groupedGames.has(uniqueId)) {
          groupedGames.set(uniqueId, []);
        }
        groupedGames.get(uniqueId)!.push(game);
      }
      
      console.log(`Grouped into ${groupedGames.size} unique games`);
      
      // Process each unique game (avoiding inverse duplicates)
      for (const [uniqueId, gameVariants] of groupedGames.entries()) {
        let gameMatchFound = false;
        
        // Track patterns already matched for this unique game to avoid duplicates
        const matchedCombos = new Set<string>();
        
        for (const game of gameVariants) {
          for (const trend of topTrendMatches) {
            // Only match against primary perspective patterns
            if (trend.perspective !== 'primary') {
              continue;
            }
            
            const gameBinnedFeatures = trend.features.map(feature => {
              const value = game[feature];
              return binValue(feature, value);
            });
            
            const gameCombo = gameBinnedFeatures.join('|');
            
            // Skip if we already matched this combo for this unique game
            if (matchedCombos.has(gameCombo)) {
              continue;
            }

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
                perspective: trend.perspective,
                primary_vs_opponent_id: game.primary_vs_opponent_id || `${game.primary_team}_vs_${game.opponent_team}`
              });
              
              matchedCombos.add(gameCombo);
              gameMatchFound = true;
            }
          }
        }
        
        // Log when a unique game doesn't match any patterns
        if (!gameMatchFound) {
          const firstVariant = gameVariants[0];
          console.log(`No pattern match found for unique game: ${firstVariant.unique_id}`);
        }
      }
    }

    console.log(`Found ${topTrendMatches.length} trend matches and ${allTodayMatches.length} today matches`);
    console.log('Final memory usage:', Deno.memoryUsage());

    const response = {
      model_id: modelData.model_id,
      trend_matches: topTrendMatches, // Return the top 20 patterns
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
