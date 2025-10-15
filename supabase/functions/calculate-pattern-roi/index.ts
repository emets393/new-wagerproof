import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SavedPattern {
  id: string;
  pattern_name: string;
  target: string;
  win_pct: number;
  opponent_win_pct: number;
  created_at: string;
  primary_vs_opponent_id?: string;
  dominant_side?: string;
}

interface PatternMatch {
  unique_id: string;
  primary_team: string;
  opponent_team: string;
  primary_ml: number | null;
  primary_rl: number | null;
  opponent_ml: number | null;
  opponent_rl: number | null;
  ou_result: number | null;
  primary_win: number | null;
  primary_runline_win: number | null;
  match_date: string;
}

interface ROICalculation {
  saved_pattern_id: string;
  total_games: number;
  wins: number;
  losses: number;
  total_roi_percentage: number;
  average_roi_percentage: number;
}

// Helper function to calculate ROI for a single bet with American odds
function calculateBetROI(odds: number, won: boolean): number {
  if (!won) {
    return -100; // Loss = -100%
  }
  
  if (odds > 0) {
    return odds; // +150 odds = +150% ROI
  } else {
    return 10000 / Math.abs(odds); // -150 odds = 66.67% ROI
  }
}

// Helper function to determine prediction based on win percentages and dominant side
function getPrediction(winPct: number, opponentWinPct: number, target: string, dominantSide?: string): {
  predictsPrimary: boolean;
  predictsOver: boolean;
} {
  // Use dominant_side if available, otherwise fall back to win percentage comparison
  let primaryWins = winPct > opponentWinPct;
  
  if (dominantSide) {
    primaryWins = dominantSide === 'primary';
  }
  
  return {
    predictsPrimary: primaryWins,
    predictsOver: primaryWins // For over/under, higher win_pct means predict over
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting ROI calculation for all saved patterns...');

    // Get all saved patterns with orientation information
    const { data: savedPatterns, error: patternsError } = await supabase
      .from('saved_trend_patterns')
      .select('id, pattern_name, target, win_pct, opponent_win_pct, created_at, primary_vs_opponent_id, dominant_side');

    if (patternsError) {
      throw new Error(`Failed to fetch saved patterns: ${patternsError.message}`);
    }

    if (!savedPatterns || savedPatterns.length === 0) {
      console.log('No saved patterns found');
      return new Response(JSON.stringify({ message: 'No saved patterns found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${savedPatterns.length} saved patterns to process`);

    const roiCalculations: ROICalculation[] = [];

    // Process each saved pattern
    for (const pattern of savedPatterns) {
      console.log(`Processing pattern: ${pattern.pattern_name}`);
      console.log(`Pattern orientation: ${pattern.primary_vs_opponent_id}`);
      console.log(`Pattern dominant side: ${pattern.dominant_side}`);

      // Get all matches for this pattern from created_at onwards
      console.log(`Looking for matches for pattern ${pattern.id} from ${pattern.created_at.split('T')[0]}`);
      
      const { data: matches, error: matchesError } = await supabase
        .from('pattern_daily_matches')
        .select(`
          unique_id, primary_team, opponent_team, 
          primary_ml, primary_rl, opponent_ml, opponent_rl,
          ou_result, primary_win, primary_runline_win, match_date
        `)
        .eq('saved_pattern_id', pattern.id)
        .gte('match_date', pattern.created_at.split('T')[0]) // Only games from pattern creation onwards
        .order('match_date', { ascending: true });

      console.log(`Found ${matches?.length || 0} matches for pattern ${pattern.id}`);

      if (matchesError) {
        console.error(`Error fetching matches for pattern ${pattern.id}:`, matchesError);
        continue;
      }

      if (!matches || matches.length === 0) {
        // No matches yet - create ROI record with 0 values
        roiCalculations.push({
          saved_pattern_id: pattern.id,
          total_games: 0,
          wins: 0,
          losses: 0,
          total_roi_percentage: 0,
          average_roi_percentage: 0
        });
        continue;
      }

      let totalGames = 0;
      let wins = 0;
      let losses = 0;
      let totalROI = 0;

      const prediction = getPrediction(pattern.win_pct, pattern.opponent_win_pct, pattern.target, pattern.dominant_side);

      // Process each match
      for (const match of matches) {
        console.log(`Processing match: ${match.unique_id} - ${match.primary_team} vs ${match.opponent_team} on ${match.match_date}`);
        console.log(`Pattern predicts: ${prediction.predictsPrimary ? 'Primary' : 'Opponent'} team`);

        let betWon = false;
        let betROI = 0;

        switch (pattern.target) {
          case 'moneyline':
            // Check if we have the required data
            if (match.primary_win === null || match.primary_ml === null) {
              console.log(`Missing moneyline data for game: ${match.unique_id}`);
              continue; // Skip games with missing data
            }

            if (prediction.predictsPrimary) {
              // Predicted primary team to win
              betWon = match.primary_win === 1;
              betROI = calculateBetROI(match.primary_ml, betWon);
              console.log(`Moneyline prediction: Primary team (${match.primary_ml}), Result: ${betWon ? 'WIN' : 'LOSS'}`);
            } else {
              // Predicted opponent team to win
              betWon = match.primary_win === 0;
              betROI = calculateBetROI(match.opponent_ml || 0, betWon);
              console.log(`Moneyline prediction: Opponent team (${match.opponent_ml}), Result: ${betWon ? 'WIN' : 'LOSS'}`);
            }
            break;

          case 'runline':
            // Check if we have the required data
            if (match.primary_runline_win === null || match.primary_rl === null) {
              console.log(`Missing runline data for game: ${match.unique_id}`);
              continue; // Skip games with missing data
            }

            if (prediction.predictsPrimary) {
              // Predicted primary team to cover
              betWon = match.primary_runline_win === 1;
              betROI = calculateBetROI(match.primary_rl, betWon);
              console.log(`Runline prediction: Primary team (${match.primary_rl}), Result: ${betWon ? 'WIN' : 'LOSS'}`);
            } else {
              // Predicted opponent team to cover
              betWon = match.primary_runline_win === 0;
              betROI = calculateBetROI(match.opponent_rl || 0, betWon);
              console.log(`Runline prediction: Opponent team (${match.opponent_rl}), Result: ${betWon ? 'WIN' : 'LOSS'}`);
            }
            break;

          case 'over_under':
            // Check if we have the required data
            if (match.ou_result === null) {
              console.log(`Missing over/under data for game: ${match.unique_id}`);
              continue; // Skip games with missing data
            }

            if (prediction.predictsOver) {
              // Predicted over
              betWon = match.ou_result === 1;
              // For over/under, we need to get the line from training_data_team_view
              // For now, assume -110 odds (standard O/U odds)
              betROI = calculateBetROI(-110, betWon);
              console.log(`Over/Under prediction: Over, Result: ${betWon ? 'WIN' : 'LOSS'}`);
            } else {
              // Predicted under
              betWon = match.ou_result === 0;
              // For under, also assume -110 odds
              betROI = calculateBetROI(-110, betWon);
              console.log(`Over/Under prediction: Under, Result: ${betWon ? 'WIN' : 'LOSS'}`);
            }
            break;

          default:
            console.log(`Unknown target type: ${pattern.target}`);
            continue; // Skip unknown target types
        }

        totalGames++;
        if (betWon) {
          wins++;
        } else {
          losses++;
        }
        totalROI += betROI;
      }

      const averageROI = totalGames > 0 ? totalROI / totalGames : 0;

      roiCalculations.push({
        saved_pattern_id: pattern.id,
        total_games: totalGames,
        wins: wins,
        losses: losses,
        total_roi_percentage: totalROI,
        average_roi_percentage: averageROI
      });

      console.log(`Pattern ${pattern.pattern_name}: ${totalGames} games, ${wins} wins, ${losses} losses, Avg ROI: ${averageROI.toFixed(2)}%`);
    }

    // Update or insert ROI records
    for (const roi of roiCalculations) {
      const { error: upsertError } = await supabase
        .from('pattern_roi')
        .upsert({
          saved_pattern_id: roi.saved_pattern_id,
          total_games: roi.total_games,
          wins: roi.wins,
          losses: roi.losses,
          total_bet_amount: roi.total_games, // Each game counts as 1 unit
          total_payout: roi.total_games + (roi.total_roi_percentage / 100), // Convert ROI back to payout
          roi_percentage: roi.average_roi_percentage,
          last_updated: new Date().toISOString()
        });

      if (upsertError) {
        console.error(`Error upserting ROI for pattern ${roi.saved_pattern_id}:`, upsertError);
      }
    }

    console.log('ROI calculation completed successfully');

    return new Response(
      JSON.stringify({ 
        message: 'ROI calculation completed successfully',
        processed_patterns: roiCalculations.length,
        calculations: roiCalculations
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-pattern-roi:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 