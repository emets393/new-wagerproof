import { supabase } from './supabase';
import { collegeFootballSupabase } from './collegeFootballClient';
import { LiveGame, GamePredictions } from '@/types/liveScores';
import { gamesMatch } from '@/utils/teamMatching';

interface NFLPrediction {
  training_key: string;
  home_team: string;
  away_team: string;
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
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
  home_spread_diff: number | null;
  over_line_diff: number | null;
  pred_away_score: number | null;
  pred_home_score: number | null;
}

/**
 * Calculate if predictions are hitting based on current scores
 */
function calculatePredictionStatus(
  game: LiveGame,
  prediction: NFLPrediction | CFBPrediction
): GamePredictions {
  const awayScore = game.away_score;
  const homeScore = game.home_score;
  const totalScore = awayScore + homeScore;
  const scoreDiff = homeScore - awayScore;

  const predictions: GamePredictions = {
    hasAnyHitting: false
  };

  const isCFB = 'pred_home_score' in prediction && prediction.pred_home_score !== null;

  // Moneyline prediction
  let mlProb = 'home_away_ml_prob' in prediction 
    ? prediction.home_away_ml_prob 
    : prediction.pred_ml_proba;

  if (mlProb === null && isCFB) {
    const cfbPred = prediction as CFBPrediction;
    if (cfbPred.pred_home_score !== null && cfbPred.pred_away_score !== null) {
      mlProb = cfbPred.pred_home_score > cfbPred.pred_away_score ? 0.6 : 0.4;
    }
  }

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
  let spreadProb = 'home_away_spread_cover_prob' in prediction
    ? prediction.home_away_spread_cover_prob
    : prediction.pred_spread_proba;

  const spreadLine = 'home_spread' in prediction
    ? prediction.home_spread
    : prediction.api_spread;

  if (spreadProb === null && isCFB) {
    const cfbPred = prediction as CFBPrediction;
    if (cfbPred.home_spread_diff !== null) {
      spreadProb = cfbPred.home_spread_diff > 0 ? 0.6 : 0.4;
    }
  }

  if (spreadProb !== null && spreadLine !== null) {
    const predictedCover = spreadProb > 0.5 ? 'Home' : 'Away';
    const adjustedDiff = scoreDiff + spreadLine;
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
  let ouProb = 'ou_result_prob' in prediction
    ? prediction.ou_result_prob
    : prediction.pred_total_proba;

  const ouLine = 'over_line' in prediction
    ? prediction.over_line
    : prediction.api_over_line;

  if (ouProb === null && isCFB) {
    const cfbPred = prediction as CFBPrediction;
    if (cfbPred.over_line_diff !== null) {
      ouProb = cfbPred.over_line_diff > 0 ? 0.6 : 0.4;
    }
  }

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
 * Fetch NFL predictions
 */
async function fetchNFLPredictions(): Promise<NFLPrediction[]> {
  try {
    // Get yesterday's date to catch games that started recently
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: latestRun, error: runError } = await collegeFootballSupabase
      .from('nfl_predictions_epa')
      .select('run_id')
      .order('run_id', { ascending: false })
      .limit(1)
      .single();

    if (runError || !latestRun?.run_id) {
      return [];
    }

    const { data: predictions, error: predsError } = await collegeFootballSupabase
      .from('nfl_predictions_epa')
      .select('training_key, home_team, away_team, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, game_date, game_time')
      .gte('game_date', yesterdayStr)
      .eq('run_id', latestRun.run_id);

    if (predsError) {
      console.error('Error fetching NFL predictions:', predsError);
      return [];
    }

    const { data: bettingLines, error: linesError } = await collegeFootballSupabase
      .from('nfl_betting_lines')
      .select('training_key, home_team, away_team, home_spread, away_spread, over_line, game_date, game_time');

    if (linesError) {
      console.error('Error fetching NFL betting lines:', linesError);
    }

    const merged = (predictions || []).map(pred => {
      const line = bettingLines?.find(l => l.training_key === pred.training_key);
      return {
        ...pred,
        home_spread: line?.home_spread || null,
        away_spread: line?.away_spread || null,
        over_line: line?.over_line || null,
        game_date: pred.game_date || line?.game_date,
        game_time: pred.game_time || line?.game_time
      } as NFLPrediction;
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
        console.error('Error parsing game time:', error);
        return true;
      }
    });

    console.log(`📊 Fetched ${merged.length} NFL predictions, ${filtered.length} within 6hr window`);
    if (filtered.length > 0) {
      console.log('📊 Sample NFL prediction:', {
        home: filtered[0].home_team,
        away: filtered[0].away_team,
        ml_prob: filtered[0].home_away_ml_prob,
        spread: filtered[0].home_spread
      });
    }

    return filtered;
  } catch (error) {
    console.error('Error in fetchNFLPredictions:', error);
    return [];
  }
}

/**
 * Fetch CFB predictions
 */
async function fetchCFBPredictions(): Promise<CFBPrediction[]> {
  try {
    const { data, error } = await collegeFootballSupabase
      .from('cfb_live_weekly_inputs')
      .select('*');

    if (error) {
      console.error('Error fetching CFB predictions:', error);
      return [];
    }

    const { data: apiPreds, error: apiPredsError } = await collegeFootballSupabase
      .from('cfb_api_predictions')
      .select('*');

    if (apiPredsError) {
      console.error('Error fetching CFB API predictions:', apiPredsError);
    }

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
        home_spread_diff: apiPred?.home_spread_diff ?? null,
        over_line_diff: apiPred?.over_line_diff ?? null,
        pred_away_score: apiPred?.pred_away_score ?? row.pred_away_score ?? null,
        pred_home_score: apiPred?.pred_home_score ?? row.pred_home_score ?? null
      };
    }) as CFBPrediction[];

    return predictions;
  } catch (error) {
    console.error('Error in fetchCFBPredictions:', error);
    return [];
  }
}

/**
 * Enrich live games with prediction data
 */
async function enrichGamesWithPredictions(games: LiveGame[]): Promise<LiveGame[]> {
  if (!games || games.length === 0) return games;

  const [nflPredictions, cfbPredictions] = await Promise.all([
    fetchNFLPredictions(),
    fetchCFBPredictions()
  ]);

  console.log(`🔄 Enriching ${games.length} live games with predictions`);
  console.log(`   Available: ${nflPredictions.length} NFL, ${cfbPredictions.length} CFB predictions`);

  return games.map(game => {
    let matchedPrediction: NFLPrediction | CFBPrediction | null = null;

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
    } else if (game.league === 'NCAAF' || game.league === 'CFB') {
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
        console.log(`   ✅ Matched CFB game: ${game.away_team} @ ${game.home_team}`);
      } else {
        console.log(`   ⚠️  No prediction found for CFB game: ${game.away_team} @ ${game.home_team}`);
      }
    }

    if (matchedPrediction) {
      console.log(`   📊 Calculating prediction status for: ${game.away_abbr} ${game.away_score} @ ${game.home_abbr} ${game.home_score}`);
      const predictions = calculatePredictionStatus(game, matchedPrediction);
      return { ...game, predictions };
    }

    return game;
  });
}

/**
 * Get live scores from database
 */
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
  
  // Map database fields to LiveGame interface
  // Database has 'period' but LiveGame expects 'quarter'
  const games: LiveGame[] = (data || []).map((game: any) => ({
    id: game.id,
    league: game.league,
    home_team: game.home_team,
    away_team: game.away_team,
    home_abbr: game.home_abbr,
    away_abbr: game.away_abbr,
    home_score: game.home_score,
    away_score: game.away_score,
    quarter: game.period || '', // Map period to quarter
    time_remaining: game.time_remaining || '',
    is_live: game.is_live,
    game_status: game.status || '',
    last_updated: game.last_updated || new Date().toISOString(),
  }));
  
  console.log(`📺 Fetched ${games.length} live games from database`);
  if (games.length > 0) {
    console.log(`📺 Sample live game:`, {
      league: games[0].league,
      home: games[0].home_team,
      away: games[0].away_team,
      score: `${games[0].away_score} - ${games[0].home_score}`,
      quarter: games[0].quarter,
      time_remaining: games[0].time_remaining
    });
  }
  
  return enrichGamesWithPredictions(games);
}

