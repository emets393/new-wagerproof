import { supabase } from "@/integrations/supabase/client";
import { collegeFootballSupabase } from "@/integrations/supabase/college-football-client";
import { LiveGame, GamePredictions, PredictionStatus } from "@/types/liveScores";
import { gamesMatch } from "@/utils/teamMatching";
import debug from "@/utils/debug";

interface NFLPrediction {
  training_key: string;
  home_team: string;
  away_team: string;
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  game_date?: string;
  game_time?: string;
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
  // CFB-specific fields from cfb_api_predictions
  home_spread_diff: number | null; // Spread edge
  over_line_diff: number | null; // O/U edge
  pred_away_score: number | null; // Predicted away score
  pred_home_score: number | null; // Predicted home score
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

  // Check if this is a CFB prediction with score/edge data
  const isCFB = 'pred_home_score' in prediction && prediction.pred_home_score !== null;

  // Moneyline prediction
  let mlProb = 'home_away_ml_prob' in prediction 
    ? prediction.home_away_ml_prob 
    : prediction.pred_ml_proba;

  // For CFB, derive moneyline from predicted scores if probability not available
  if (mlProb === null && isCFB) {
    const cfbPred = prediction as CFBPrediction;
    if (cfbPred.pred_home_score !== null && cfbPred.pred_away_score !== null) {
      // If home predicted score > away predicted score, model picks home
      mlProb = cfbPred.pred_home_score > cfbPred.pred_away_score ? 0.6 : 0.4;
      debug.log(`      📊 CFB ML: Derived from predicted scores (Home: ${cfbPred.pred_home_score}, Away: ${cfbPred.pred_away_score})`);
    }
  }

  if (mlProb !== null) {
    const predictedWinner = mlProb > 0.5 ? 'Home' : 'Away';
    const isHitting = (predictedWinner === 'Home' && homeScore > awayScore) ||
                     (predictedWinner === 'Away' && awayScore > homeScore);
    
    debug.log(`      📊 ML: prob=${mlProb}, predicted=${predictedWinner}, awayScore=${awayScore}, homeScore=${homeScore}, hitting=${isHitting}`);
    
    predictions.moneyline = {
      predicted: predictedWinner,
      isHitting,
      probability: predictedWinner === 'Home' ? mlProb : (1 - mlProb),
      currentDifferential: scoreDiff
    };

    if (isHitting) predictions.hasAnyHitting = true;
  }

  // Spread prediction
  let spreadProb = 'home_away_spread_cover_prob' in prediction
    ? prediction.home_away_spread_cover_prob
    : prediction.pred_spread_proba;

  const spreadLine = 'home_spread' in prediction
    ? prediction.home_spread
    : prediction.api_spread;

  // For CFB, derive spread pick from home_spread_diff if probability not available
  if (spreadProb === null && isCFB) {
    const cfbPred = prediction as CFBPrediction;
    if (cfbPred.home_spread_diff !== null) {
      // Positive home_spread_diff = edge to home, negative = edge to away
      spreadProb = cfbPred.home_spread_diff > 0 ? 0.6 : 0.4;
      debug.log(`      📊 CFB Spread: Derived from home_spread_diff (${cfbPred.home_spread_diff})`);
    }
  }

  if (spreadProb !== null && spreadLine !== null) {
    const predictedCover = spreadProb > 0.5 ? 'Home' : 'Away';
    
    // Check if spread is being covered
    // If home is favored (negative spread), they need to win by more than the absolute value
    // If away is favored (positive home spread), home needs to lose by less than the spread
    const adjustedDiff = scoreDiff + spreadLine; // Adjust score diff by spread
    const isHitting = (predictedCover === 'Home' && adjustedDiff > 0) ||
                     (predictedCover === 'Away' && adjustedDiff < 0);

    debug.log(`      📊 Spread: prob=${spreadProb}, line=${spreadLine}, predicted=${predictedCover}, scoreDiff=${scoreDiff}, adjustedDiff=${adjustedDiff}, hitting=${isHitting}`);

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
  let ouProb = 'ou_result_prob' in prediction
    ? prediction.ou_result_prob
    : prediction.pred_total_proba;

  const ouLine = 'over_line' in prediction
    ? prediction.over_line
    : prediction.api_over_line;

  // For CFB, derive O/U pick from over_line_diff if probability not available
  if (ouProb === null && isCFB) {
    const cfbPred = prediction as CFBPrediction;
    if (cfbPred.over_line_diff !== null) {
      // Positive over_line_diff = edge to over, negative = edge to under
      ouProb = cfbPred.over_line_diff > 0 ? 0.6 : 0.4;
      debug.log(`      📊 CFB O/U: Derived from over_line_diff (${cfbPred.over_line_diff})`);
    }
  }

  if (ouProb !== null && ouLine !== null) {
    const predictedResult = ouProb > 0.5 ? 'Over' : 'Under';
    const isHitting = (predictedResult === 'Over' && totalScore > ouLine) ||
                     (predictedResult === 'Under' && totalScore < ouLine);

    debug.log(`      📊 O/U: prob=${ouProb}, line=${ouLine}, predicted=${predictedResult}, total=${totalScore}, hitting=${isHitting}`);

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
    // Get yesterday's date to catch games that started recently
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // First get the latest run_id (without date filter)
    const { data: latestRun, error: runError } = await collegeFootballSupabase
      .from('nfl_predictions_epa')
      .select('run_id')
      .order('run_id', { ascending: false })
      .limit(1)
      .single();

    if (runError || !latestRun?.run_id) {
      debug.log('No NFL predictions found');
      return [];
    }

    // Fetch predictions with the latest run_id from yesterday onwards
    // Include game_date and game_time for filtering
    const { data: predictions, error: predsError } = await collegeFootballSupabase
      .from('nfl_predictions_epa')
      .select('training_key, home_team, away_team, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, game_date, game_time')
      .gte('game_date', yesterdayStr)
      .eq('run_id', latestRun.run_id);

    if (predsError) {
      debug.error('Error fetching NFL predictions:', predsError);
      return [];
    }

    // Fetch betting lines
    const { data: bettingLines, error: linesError } = await collegeFootballSupabase
      .from('nfl_betting_lines')
      .select('training_key, home_team, away_team, home_spread, away_spread, over_line, game_date, game_time');

    if (linesError) {
      debug.error('Error fetching NFL betting lines:', linesError);
    }

    // Merge predictions with betting lines
    const merged = (predictions || []).map(pred => {
      const line = bettingLines?.find(l => l.training_key === pred.training_key);
      return {
        ...pred,
        home_spread: line?.home_spread || null,
        away_spread: line?.away_spread || null,
        over_line: line?.over_line || null,
        game_date: pred.game_date || line?.game_date,
        game_time: pred.game_time || line?.game_time
      } as NFLPredictionWithLines;
    });

    // Filter out games more than 6 hours past their start time
    const currentTime = new Date();
    const filtered = merged.filter(pred => {
      if (!pred.game_date || !pred.game_time) {
        return true; // Keep games without time info
      }
      
      try {
        const gameDateTime = new Date(`${pred.game_date}T${pred.game_time}Z`);
        const sixHoursAfterGame = new Date(gameDateTime.getTime() + (6 * 60 * 60 * 1000));
        return currentTime < sixHoursAfterGame;
      } catch (error) {
        debug.error('Error parsing game time:', error);
        return true;
      }
    });

    debug.log(`📊 Fetched ${merged.length} NFL predictions, ${filtered.length} within 6hr window`);
    if (filtered.length > 0) {
      debug.log(`📊 Sample NFL prediction teams:`, {
        home: filtered[0].home_team,
        away: filtered[0].away_team
      });
    }
    return filtered;
  } catch (error) {
    debug.error('Error in fetchNFLPredictions:', error);
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
      debug.error('❌ Error fetching CFB predictions:', error);
      return [];
    }

    debug.log(`📊 Fetched ${(data || []).length} CFB predictions from cfb_live_weekly_inputs`);
    if (data && data.length > 0) {
      debug.log(`📊 Sample CFB prediction row (all columns):`, data[0]);
      debug.log(`📊 CFB column names:`, Object.keys(data[0]));
    }

    // Fetch API predictions to get edge data
    const { data: apiPreds, error: apiPredsError } = await collegeFootballSupabase
      .from('cfb_api_predictions')
      .select('*');

    if (apiPredsError) {
      debug.error('❌ Error fetching CFB API predictions:', apiPredsError);
    }

    debug.log(`📊 Fetched ${apiPreds?.length || 0} CFB API predictions with edge data`);

    // Map to our CFBPrediction interface - include edge data from cfb_api_predictions
    const predictions = (data || []).map((row: any) => {
      const apiPred: any = apiPreds?.find((ap: any) => ap.id === row.id);
      
      return {
        home_team: row.home_team,
        away_team: row.away_team,
        pred_ml_proba: row.pred_ml_proba ?? null,
        pred_spread_proba: row.pred_spread_proba ?? null,
        pred_total_proba: row.pred_total_proba ?? null,
        api_spread: row.api_spread ?? null,
        api_over_line: row.api_over_line ?? null,
        // Edge data from cfb_api_predictions
        home_spread_diff: apiPred?.home_spread_diff ?? null,
        over_line_diff: apiPred?.over_line_diff ?? null,
        // Score predictions
        pred_away_score: apiPred?.pred_away_score ?? row.pred_away_score ?? (apiPred as any)?.pred_away_points ?? null,
        pred_home_score: apiPred?.pred_home_score ?? row.pred_home_score ?? (apiPred as any)?.pred_home_points ?? null
      };
    }) as CFBPrediction[];

    debug.log(`📊 Mapped ${predictions.length} CFB predictions with edge data`);
    if (predictions.length > 0) {
      debug.log(`📊 Sample CFB prediction:`, predictions[0]);
    }
    
    return predictions;
  } catch (error) {
    debug.error('❌ Error in fetchCFBPredictions:', error);
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

  debug.log(`Fetched ${nflPredictions.length} NFL predictions and ${cfbPredictions.length} CFB predictions`);

  // Enrich each game with its predictions
  return games.map(game => {
    let matchedPrediction: NFLPredictionWithLines | CFBPrediction | null = null;

    if (game.league === 'NFL') {
      debug.log(`🔍 Trying to match NFL game: ${game.away_team} @ ${game.home_team}`);
      
      matchedPrediction = nflPredictions.find(pred => {
        const matches = gamesMatch(
          { home_team: game.home_team, away_team: game.away_team },
          { home_team: pred.home_team, away_team: pred.away_team }
        );
        
        if (!matches) {
          debug.log(`   ❌ No match with prediction: ${pred.away_team} @ ${pred.home_team}`);
        }
        return matches;
      }) || null;
      
      if (matchedPrediction) {
        debug.log(`   ✅ Matched NFL game: ${game.away_team} @ ${game.home_team}`, {
          prediction: matchedPrediction,
          scores: { away: game.away_score, home: game.home_score }
        });
      } else {
        debug.log(`   ⚠️  No prediction found for NFL game: ${game.away_team} @ ${game.home_team}`);
      }
    } else if (game.league === 'NCAAF') {
      debug.log(`🔍 Trying to match CFB game: ${game.away_team} @ ${game.home_team}`);
      
      matchedPrediction = cfbPredictions.find(pred => {
        const matches = gamesMatch(
          { home_team: game.home_team, away_team: game.away_team },
          { home_team: pred.home_team, away_team: pred.away_team }
        );
        
        if (!matches) {
          debug.log(`   ❌ No match with prediction: ${pred.away_team} @ ${pred.home_team}`);
        }
        return matches;
      }) || null;
      
      if (matchedPrediction) {
        debug.log(`   ✅ Matched CFB game: ${game.away_team} @ ${game.home_team}`, {
          prediction: matchedPrediction,
          scores: { away: game.away_score, home: game.home_score }
        });
      } else {
        debug.log(`   ⚠️  No prediction found for CFB game: ${game.away_team} @ ${game.home_team}`);
      }
    }

    if (matchedPrediction) {
      debug.log(`   📊 Calculating prediction status for: ${game.away_abbr} ${game.away_score} @ ${game.home_abbr} ${game.home_score}`);
      const predictions = calculatePredictionStatus(game, matchedPrediction);
      debug.log(`   ✅ Result:`, predictions);
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
    debug.error('Error fetching live scores:', error);
    return [];
  }
  
  const games = (data || []) as LiveGame[];
  
  debug.log(`📺 Fetched ${games.length} live games from ESPN`);
  if (games.length > 0) {
    debug.log(`📺 Sample live game teams:`, {
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
      debug.error('Error refreshing live scores:', error);
      return { success: false, liveGames: 0 };
    }
    
    return {
      success: data?.success || false,
      liveGames: data?.liveGames || 0
    };
  } catch (error) {
    debug.error('Error calling refresh function:', error);
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
    debug.error('Error checking refresh status:', error);
    return true; // Refresh on error
  }
  
  // If no recent data, refresh is needed
  return !data || data.length === 0;
}

