import { supabase } from "@/integrations/supabase/client";
import { collegeFootballSupabase } from "@/integrations/supabase/college-football-client";
import { LiveGame, GamePredictions, PredictionStatus } from "@/types/liveScores";
import { gamesMatch } from "@/utils/teamMatching";

interface NFLPrediction {
  training_key: string;
  home_team: string;
  away_team: string;
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
}

interface NFLBettingLine {
  training_key: string;
  home_team: string;
  away_team: string;
  home_spread: number | null;
  away_spread: number | null;
  over_line: number | null;
}

interface NFLPredictionWithLines extends NFLPrediction {
  home_spread: number | null;
  away_spread: number | null;
  over_line: number | null;
}

interface CFBPrediction {
  home_team: string;
  away_team: string;
  pred_ml_proba: number | null;
  pred_spread_proba: number | null;
  pred_total_proba: number | null;
  api_spread: number | null;
  api_over_line: number | null;
}

/**
 * Calculate if predictions are hitting based on current scores
 */
function calculatePredictionStatus(
  game: LiveGame,
  prediction: NFLPredictionWithLines | CFBPrediction
): GamePredictions {
  const awayScore = game.away_score;
  const homeScore = game.home_score;
  const totalScore = awayScore + homeScore;
  const scoreDiff = homeScore - awayScore; // Positive means home winning

  const predictions: GamePredictions = {
    hasAnyHitting: false
  };

  // Moneyline prediction
  const mlProb = 'home_away_ml_prob' in prediction 
    ? prediction.home_away_ml_prob 
    : prediction.pred_ml_proba;

  if (mlProb !== null) {
    const predictedWinner = mlProb > 0.5 ? 'Home' : 'Away';
    const isHitting = (predictedWinner === 'Home' && homeScore > awayScore) ||
                     (predictedWinner === 'Away' && awayScore > homeScore);
    
    predictions.moneyline = {
      predicted: predictedWinner,
      isHitting,
      probability: predictedWinner === 'Home' ? mlProb : (1 - mlProb),
      currentDifferential: scoreDiff
    };

    if (isHitting) predictions.hasAnyHitting = true;
  }

  // Spread prediction
  const spreadProb = 'home_away_spread_cover_prob' in prediction
    ? prediction.home_away_spread_cover_prob
    : prediction.pred_spread_proba;

  const spreadLine = 'home_spread' in prediction
    ? prediction.home_spread
    : prediction.api_spread;

  if (spreadProb !== null && spreadLine !== null) {
    const predictedCover = spreadProb > 0.5 ? 'Home' : 'Away';
    
    // Check if spread is being covered
    // If home is favored (negative spread), they need to win by more than the absolute value
    // If away is favored (positive home spread), home needs to lose by less than the spread
    const adjustedDiff = scoreDiff + spreadLine; // Adjust score diff by spread
    const isHitting = (predictedCover === 'Home' && adjustedDiff > 0) ||
                     (predictedCover === 'Away' && adjustedDiff < 0);

    predictions.spread = {
      predicted: predictedCover,
      isHitting,
      probability: predictedCover === 'Home' ? spreadProb : (1 - spreadProb),
      line: spreadLine,
      currentDifferential: adjustedDiff
    };

    if (isHitting) predictions.hasAnyHitting = true;
  }

  // Over/Under prediction
  const ouProb = 'ou_result_prob' in prediction
    ? prediction.ou_result_prob
    : prediction.pred_total_proba;

  const ouLine = 'over_line' in prediction
    ? prediction.over_line
    : prediction.api_over_line;

  if (ouProb !== null && ouLine !== null) {
    const predictedResult = ouProb > 0.5 ? 'Over' : 'Under';
    const isHitting = (predictedResult === 'Over' && totalScore > ouLine) ||
                     (predictedResult === 'Under' && totalScore < ouLine);

    predictions.overUnder = {
      predicted: predictedResult,
      isHitting,
      probability: predictedResult === 'Over' ? ouProb : (1 - ouProb),
      line: ouLine,
      currentDifferential: totalScore - ouLine
    };

    if (isHitting) predictions.hasAnyHitting = true;
  }

  return predictions;
}

/**
 * Fetch NFL predictions from nfl_predictions_epa table and betting lines
 */
async function fetchNFLPredictions(): Promise<NFLPredictionWithLines[]> {
  try {
    // Get today's date for filtering
    const today = new Date().toISOString().split('T')[0];

    // First get the latest run_id
    const { data: latestRun, error: runError } = await collegeFootballSupabase
      .from('nfl_predictions_epa')
      .select('run_id')
      .gte('game_date', today)
      .order('run_id', { ascending: false })
      .limit(1)
      .single();

    if (runError || !latestRun?.run_id) {
      console.log('No NFL predictions found for today');
      return [];
    }

    // Fetch predictions with the latest run_id
    const { data: predictions, error: predsError } = await collegeFootballSupabase
      .from('nfl_predictions_epa')
      .select('training_key, home_team, away_team, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob')
      .gte('game_date', today)
      .eq('run_id', latestRun.run_id);

    if (predsError) {
      console.error('Error fetching NFL predictions:', predsError);
      return [];
    }

    // Fetch betting lines
    const { data: bettingLines, error: linesError } = await collegeFootballSupabase
      .from('nfl_betting_lines')
      .select('training_key, home_team, away_team, home_spread, away_spread, over_line');

    if (linesError) {
      console.error('Error fetching NFL betting lines:', linesError);
    }

    // Merge predictions with betting lines
    const merged = (predictions || []).map(pred => {
      const line = bettingLines?.find(l => l.training_key === pred.training_key);
      return {
        ...pred,
        home_spread: line?.home_spread || null,
        away_spread: line?.away_spread || null,
        over_line: line?.over_line || null
      } as NFLPredictionWithLines;
    });

    console.log(`📊 Fetched ${merged.length} NFL predictions with lines`);
    if (merged.length > 0) {
      console.log(`📊 Sample NFL prediction teams:`, {
        home: merged[0].home_team,
        away: merged[0].away_team
      });
    }
    return merged;
  } catch (error) {
    console.error('Error in fetchNFLPredictions:', error);
    return [];
  }
}

/**
 * Fetch CFB predictions from cfb_live_weekly_inputs table
 */
async function fetchCFBPredictions(): Promise<CFBPrediction[]> {
  try {
    // Use select('*') like the CollegeFootball page does
    const { data, error } = await collegeFootballSupabase
      .from('cfb_live_weekly_inputs')
      .select('*');

    if (error) {
      console.error('❌ Error fetching CFB predictions:', error);
      return [];
    }

    console.log(`📊 Fetched ${(data || []).length} CFB predictions from cfb_live_weekly_inputs`);
    if (data && data.length > 0) {
      console.log(`📊 Sample CFB prediction row (all columns):`, data[0]);
      console.log(`📊 CFB column names:`, Object.keys(data[0]));
    }

    // Map to our CFBPrediction interface
    return (data || []).map((row: any) => ({
      home_team: row.home_team,
      away_team: row.away_team,
      pred_ml_proba: row.pred_ml_proba,
      pred_spread_proba: row.pred_spread_proba,
      pred_total_proba: row.pred_total_proba,
      api_spread: row.api_spread,
      api_over_line: row.api_over_line
    })) as CFBPrediction[];
  } catch (error) {
    console.error('❌ Error in fetchCFBPredictions:', error);
    return [];
  }
}

/**
 * Enrich live games with prediction data
 */
async function enrichGamesWithPredictions(games: LiveGame[]): Promise<LiveGame[]> {
  if (!games || games.length === 0) return games;

  // Fetch predictions for both leagues
  const [nflPredictions, cfbPredictions] = await Promise.all([
    fetchNFLPredictions(),
    fetchCFBPredictions()
  ]);

  console.log(`Fetched ${nflPredictions.length} NFL predictions and ${cfbPredictions.length} CFB predictions`);

  // Enrich each game with its predictions
  return games.map(game => {
    let matchedPrediction: NFLPredictionWithLines | CFBPrediction | null = null;

    if (game.league === 'NFL') {
      console.log(`🔍 Trying to match NFL game: ${game.away_team} @ ${game.home_team}`);
      
      matchedPrediction = nflPredictions.find(pred => {
        const matches = gamesMatch(
          { home_team: game.home_team, away_team: game.away_team },
          { home_team: pred.home_team, away_team: pred.away_team }
        );
        
        if (!matches) {
          console.log(`   ❌ No match with prediction: ${pred.away_team} @ ${pred.home_team}`);
        }
        return matches;
      }) || null;
      
      if (matchedPrediction) {
        console.log(`   ✅ Matched NFL game: ${game.away_team} @ ${game.home_team}`, {
          prediction: matchedPrediction,
          scores: { away: game.away_score, home: game.home_score }
        });
      } else {
        console.log(`   ⚠️  No prediction found for NFL game: ${game.away_team} @ ${game.home_team}`);
      }
    } else if (game.league === 'NCAAF') {
      console.log(`🔍 Trying to match CFB game: ${game.away_team} @ ${game.home_team}`);
      
      matchedPrediction = cfbPredictions.find(pred => {
        const matches = gamesMatch(
          { home_team: game.home_team, away_team: game.away_team },
          { home_team: pred.home_team, away_team: pred.away_team }
        );
        
        if (!matches) {
          console.log(`   ❌ No match with prediction: ${pred.away_team} @ ${pred.home_team}`);
        }
        return matches;
      }) || null;
      
      if (matchedPrediction) {
        console.log(`   ✅ Matched CFB game: ${game.away_team} @ ${game.home_team}`, {
          prediction: matchedPrediction,
          scores: { away: game.away_score, home: game.home_score }
        });
      } else {
        console.log(`   ⚠️  No prediction found for CFB game: ${game.away_team} @ ${game.home_team}`);
      }
    }

    if (matchedPrediction) {
      const predictions = calculatePredictionStatus(game, matchedPrediction);
      console.log(`   📊 Prediction status:`, predictions);
      return { ...game, predictions };
    }

    return game;
  });
}

export async function getLiveScores(): Promise<LiveGame[]> {
  const { data, error } = await supabase
    .from('live_scores')
    .select('*')
    .eq('is_live', true)
    .order('league', { ascending: true })
    .order('away_abbr', { ascending: true });
  
  if (error) {
    console.error('Error fetching live scores:', error);
    return [];
  }
  
  const games = (data || []) as LiveGame[];
  
  console.log(`📺 Fetched ${games.length} live games from ESPN`);
  if (games.length > 0) {
    console.log(`📺 Sample live game teams:`, {
      league: games[0].league,
      home: games[0].home_team,
      away: games[0].away_team
    });
  }
  
  // Enrich with predictions
  return enrichGamesWithPredictions(games);
}

export async function refreshLiveScores(): Promise<{ success: boolean; liveGames: number }> {
  try {
    // Call the edge function to refresh scores
    const { data, error } = await supabase.functions.invoke('fetch-live-scores');
    
    if (error) {
      console.error('Error refreshing live scores:', error);
      return { success: false, liveGames: 0 };
    }
    
    return {
      success: data?.success || false,
      liveGames: data?.liveGames || 0
    };
  } catch (error) {
    console.error('Error calling refresh function:', error);
    return { success: false, liveGames: 0 };
  }
}

export async function checkIfRefreshNeeded(): Promise<boolean> {
  // Check if we have recent data (within last 2 minutes)
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('live_scores')
    .select('last_updated')
    .gte('last_updated', twoMinutesAgo)
    .limit(1);
  
  if (error) {
    console.error('Error checking refresh status:', error);
    return true; // Refresh on error
  }
  
  // If no recent data, refresh is needed
  return !data || data.length === 0;
}

