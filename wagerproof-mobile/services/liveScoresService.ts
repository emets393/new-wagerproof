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

interface NBAPrediction {
  game_id: number;
  home_team: string;
  away_team: string;
  home_win_prob: number | null;
  away_win_prob: number | null;
  home_spread: number | null;
  over_line: number | null;
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  model_fair_home_spread: number | null;
  pred_total_points: number | null;
}

interface NCAABPrediction {
  game_id: number;
  home_team: string;
  away_team: string;
  home_win_prob: number | null;
  away_win_prob: number | null;
  vegas_home_spread: number | null;
  vegas_total: number | null;
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  pred_total_points: number | null;
  model_fair_home_spread: number | null;
}

type AnyPrediction = NFLPrediction | CFBPrediction | NBAPrediction | NCAABPrediction;

/**
 * Calculate if predictions are hitting based on current scores
 */
function calculatePredictionStatus(
  game: LiveGame,
  prediction: AnyPrediction
): GamePredictions {
  const awayScore = game.away_score;
  const homeScore = game.home_score;
  const totalScore = awayScore + homeScore;
  const scoreDiff = homeScore - awayScore;

  const predictions: GamePredictions = {
    hasAnyHitting: false
  };

  const isCFB = 'pred_home_score' in prediction && prediction.pred_home_score !== null;
  const isNBA = 'game_id' in prediction && typeof (prediction as any).game_id === 'number' && !('vegas_home_spread' in prediction);
  const isNCAAB = 'game_id' in prediction && 'vegas_home_spread' in prediction;

  // Moneyline prediction
  let mlProb: number | null = null;
  if ('home_away_ml_prob' in prediction) {
    mlProb = prediction.home_away_ml_prob;
  } else if ('pred_ml_proba' in prediction) {
    mlProb = prediction.pred_ml_proba;
  } else if ('home_win_prob' in prediction) {
    mlProb = (prediction as NBAPrediction | NCAABPrediction).home_win_prob;
  }

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
  let spreadProb: number | null = null;
  if ('home_away_spread_cover_prob' in prediction) {
    spreadProb = prediction.home_away_spread_cover_prob;
  } else if ('pred_spread_proba' in prediction) {
    spreadProb = prediction.pred_spread_proba;
  } else if ('home_win_prob' in prediction) {
    spreadProb = (prediction as NBAPrediction | NCAABPrediction).home_win_prob;
  }

  let spreadLine: number | null = null;
  if ('home_spread' in prediction) {
    spreadLine = prediction.home_spread;
  } else if ('api_spread' in prediction) {
    spreadLine = prediction.api_spread;
  } else if ('vegas_home_spread' in prediction) {
    spreadLine = (prediction as NCAABPrediction).vegas_home_spread;
  }

  if (spreadProb === null && isCFB) {
    const cfbPred = prediction as CFBPrediction;
    if (cfbPred.home_spread_diff !== null) {
      spreadProb = cfbPred.home_spread_diff > 0 ? 0.6 : 0.4;
    }
  }
  
  // For basketball, derive spread probability from model_fair_home_spread vs vegas if available
  if (spreadProb === null && (isNBA || isNCAAB)) {
    const bballPred = prediction as NBAPrediction | NCAABPrediction;
    if (bballPred.model_fair_home_spread !== null && spreadLine !== null) {
      const spreadDiff = spreadLine - bballPred.model_fair_home_spread;
      spreadProb = spreadDiff < 0 ? 0.6 : 0.4;
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
  let ouLine: number | null = null;
  if ('over_line' in prediction) {
    ouLine = prediction.over_line;
  } else if ('api_over_line' in prediction) {
    ouLine = prediction.api_over_line;
  } else if ('vegas_total' in prediction) {
    ouLine = (prediction as NCAABPrediction).vegas_total;
  }

  let ouProb: number | null = null;
  if ('ou_result_prob' in prediction) {
    ouProb = prediction.ou_result_prob;
  } else if ('pred_total_proba' in prediction) {
    ouProb = prediction.pred_total_proba;
  }

  if (ouProb === null && isCFB) {
    const cfbPred = prediction as CFBPrediction;
    if (cfbPred.over_line_diff !== null) {
      ouProb = cfbPred.over_line_diff > 0 ? 0.6 : 0.4;
    }
  }
  
  // For basketball, derive O/U from pred_total_points vs vegas_total
  if (ouProb === null && (isNBA || isNCAAB)) {
    const bballPred = prediction as NBAPrediction | NCAABPrediction;
    if (bballPred.pred_total_points !== null && ouLine !== null) {
      ouProb = bballPred.pred_total_points > ouLine ? 0.6 : 0.4;
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
    const { data: anchor } = await collegeFootballSupabase
      .from('nfl_dryrun_games')
      .select('season, week')
      .order('season', { ascending: false })
      .order('week', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!anchor) return [];

    const { data, error } = await collegeFootballSupabase
      .from('nfl_dryrun_games')
      .select('game_id, home_team, away_team, fg_home_win_prob, fg_home_cover_prob, fg_spread_close, fg_total_close')
      .eq('season', (anchor as any).season)
      .eq('week', (anchor as any).week);

    if (error) {
      console.error('Error fetching NFL predictions:', error);
      return [];
    }

    const merged = (data || []).map((r: any) => {
      const homeSpread = r.fg_spread_close ?? null;
      return {
        training_key: r.game_id,
        home_team: r.home_team,
        away_team: r.away_team,
        home_away_ml_prob: r.fg_home_win_prob ?? null,
        home_away_spread_cover_prob: r.fg_home_cover_prob ?? null,
        ou_result_prob: null,
        home_spread: homeSpread,
        away_spread: homeSpread !== null ? -Number(homeSpread) : null,
        over_line: r.fg_total_close ?? null,
      } as NFLPrediction;
    });

    console.log(`📊 Fetched ${merged.length} NFL predictions from nfl_dryrun_games`);
    return merged;
  } catch (error) {
    console.error('Error in fetchNFLPredictions:', error);
    return [];
  }
}

async function fetchCFBPredictions(): Promise<CFBPrediction[]> {
  try {
    const { data: anchor } = await collegeFootballSupabase
      .from('cfb_dryrun_games')
      .select('season, week')
      .order('season', { ascending: false })
      .order('week', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!anchor) return [];

    const { data, error } = await collegeFootballSupabase
      .from('cfb_dryrun_games')
      .select('*')
      .eq('season', (anchor as any).season)
      .eq('week', (anchor as any).week);

    if (error) {
      console.error('Error fetching CFB predictions:', error);
      return [];
    }

    const predictions = (data || []).map((row: any) => {
      const predTotal = Number(row.fg_pred_total);
      const predMargin = Number(row.fg_pred_margin);
      const hasScore = Number.isFinite(predTotal) && Number.isFinite(predMargin);
      return {
        home_team: row.home_team,
        away_team: row.away_team,
        pred_ml_proba: row.fg_home_win_prob ?? null,
        pred_spread_proba: row.fg_home_cover_prob ?? null,
        pred_total_proba: null,
        api_spread: row.fg_spread_close ?? null,
        api_over_line: row.fg_total_close ?? null,
        home_spread_diff: row.fg_spread_edge ?? null,
        over_line_diff: row.fg_total_edge ?? null,
        pred_away_score: row.fg_pred_away_pts ?? (hasScore ? (predTotal - predMargin) / 2 : null),
        pred_home_score: row.fg_pred_home_pts ?? (hasScore ? (predTotal + predMargin) / 2 : null),
      };
    }) as CFBPrediction[];

    console.log(`📊 Fetched ${predictions.length} CFB predictions from cfb_dryrun_games`);
    return predictions;
  } catch (error) {
    console.error('Error in fetchCFBPredictions:', error);
    return [];
  }
}

async function fetchNBAPredictions(): Promise<NBAPrediction[]> {
  try {
    const { data: latestRun, error: runError } = await collegeFootballSupabase
      .from('nba_predictions')
      .select('run_id, as_of_ts_utc')
      .order('as_of_ts_utc', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runError || !latestRun) {
      console.log('No NBA predictions found');
      return [];
    }

    const { data: predictions, error: predsError } = await collegeFootballSupabase
      .from('nba_predictions')
      .select('game_id, home_team, away_team, home_win_prob, away_win_prob, model_fair_home_spread, model_fair_total, run_id')
      .eq('run_id', latestRun.run_id);

    if (predsError) {
      console.error('Error fetching NBA predictions:', predsError);
      return [];
    }

    const { data: inputValues, error: inputError } = await collegeFootballSupabase
      .from('nba_input_values_view')
      .select('game_id, home_spread, total_line');

    if (inputError) {
      console.error('Error fetching NBA betting lines:', inputError);
    }

    const merged = (predictions || []).map(pred => {
      const input = inputValues?.find(iv => iv.game_id === pred.game_id);
      
      const hasModelHomeSpread = pred.model_fair_home_spread !== null && pred.model_fair_home_spread !== undefined;
      const hasInputHomeSpread = input?.home_spread !== null && input?.home_spread !== undefined;
      const hasModelTotal = pred.model_fair_total !== null && pred.model_fair_total !== undefined;
      const hasInputTotal = input?.total_line !== null && input?.total_line !== undefined;

      let spreadCoverProb = null;
      if (hasModelHomeSpread && hasInputHomeSpread) {
        const spreadDiff = input.home_spread - pred.model_fair_home_spread;
        if (pred.model_fair_home_spread < input.home_spread) {
          spreadCoverProb = 0.5 + Math.min(Math.abs(spreadDiff) * 0.05, 0.35);
        } else {
          spreadCoverProb = 0.5 - Math.min(Math.abs(spreadDiff) * 0.05, 0.35);
        }
      } else if (pred.home_win_prob !== null && pred.home_win_prob !== undefined) {
        spreadCoverProb = pred.home_win_prob;
      }
      
      let ouProb = null;
      if (hasModelTotal && hasInputTotal) {
        const totalDiff = pred.model_fair_total - input.total_line;
        if (totalDiff > 0) {
          ouProb = 0.5 + Math.min(Math.abs(totalDiff) * 0.02, 0.35);
        } else {
          ouProb = 0.5 - Math.min(Math.abs(totalDiff) * 0.02, 0.35);
        }
      }

      return {
        game_id: pred.game_id,
        home_team: pred.home_team,
        away_team: pred.away_team,
        home_win_prob: pred.home_win_prob,
        away_win_prob: pred.away_win_prob,
        home_spread: input?.home_spread ?? null,
        over_line: input?.total_line ?? null,
        home_away_ml_prob: pred.home_win_prob,
        home_away_spread_cover_prob: spreadCoverProb,
        ou_result_prob: ouProb,
        model_fair_home_spread: pred.model_fair_home_spread,
        pred_total_points: pred.model_fair_total
      } as NBAPrediction;
    });

    console.log(`📊 Fetched ${merged.length} NBA predictions with lines`);
    return merged;
  } catch (error) {
    console.error('Error in fetchNBAPredictions:', error);
    return [];
  }
}

/**
 * Fetch NCAAB predictions
 */
async function fetchNCAABPredictions(): Promise<NCAABPrediction[]> {
  try {
    const { data: latestRun, error: runError } = await collegeFootballSupabase
      .from('ncaab_predictions')
      .select('run_id, as_of_ts_utc')
      .order('as_of_ts_utc', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runError || !latestRun) {
      console.log('No NCAAB predictions found');
      return [];
    }

    const { data: predictions, error: predsError } = await collegeFootballSupabase
      .from('ncaab_predictions')
      .select('game_id, home_team, away_team, home_win_prob, away_win_prob, vegas_home_spread, vegas_total, pred_total_points, model_fair_home_spread, run_id')
      .eq('run_id', latestRun.run_id);

    if (predsError) {
      console.error('Error fetching NCAAB predictions:', predsError);
      return [];
    }

    const mapped = (predictions || []).map(pred => {
      let ouProb = null;
      if (pred.pred_total_points !== null && pred.vegas_total !== null) {
        ouProb = pred.pred_total_points > pred.vegas_total ? 0.6 : 0.4;
      }

      return {
        game_id: pred.game_id,
        home_team: pred.home_team,
        away_team: pred.away_team,
        home_win_prob: pred.home_win_prob,
        away_win_prob: pred.away_win_prob,
        vegas_home_spread: pred.vegas_home_spread,
        vegas_total: pred.vegas_total,
        home_away_ml_prob: pred.home_win_prob,
        home_away_spread_cover_prob: pred.home_win_prob,
        ou_result_prob: ouProb,
        pred_total_points: pred.pred_total_points,
        model_fair_home_spread: pred.model_fair_home_spread
      } as NCAABPrediction;
    });

    console.log(`📊 Fetched ${mapped.length} NCAAB predictions`);
    return mapped;
  } catch (error) {
    console.error('Error in fetchNCAABPredictions:', error);
    return [];
  }
}

/**
 * Enrich live games with prediction data
 */
async function enrichGamesWithPredictions(games: LiveGame[]): Promise<LiveGame[]> {
  if (!games || games.length === 0) return games;

  const [nflPredictions, cfbPredictions, nbaPredictions, ncaabPredictions] = await Promise.all([
    fetchNFLPredictions(),
    fetchCFBPredictions(),
    fetchNBAPredictions(),
    fetchNCAABPredictions()
  ]);

  console.log(`🔄 Enriching ${games.length} live games with predictions`);
  console.log(`   Available: ${nflPredictions.length} NFL, ${cfbPredictions.length} CFB, ${nbaPredictions.length} NBA, ${ncaabPredictions.length} NCAAB predictions`);

  return games.map(game => {
    let matchedPrediction: AnyPrediction | null = null;

    if (game.league === 'NFL') {
      matchedPrediction = nflPredictions.find(pred => {
        return gamesMatch(
          { home_team: game.home_team, away_team: game.away_team },
          { home_team: pred.home_team, away_team: pred.away_team }
        );
      }) || null;
      
      if (matchedPrediction) {
        console.log(`   ✅ Matched NFL: ${game.away_abbr} @ ${game.home_abbr}`);
      }
    } else if (game.league === 'NCAAF' || game.league === 'CFB') {
      matchedPrediction = cfbPredictions.find(pred => {
        return gamesMatch(
          { home_team: game.home_team, away_team: game.away_team },
          { home_team: pred.home_team, away_team: pred.away_team }
        );
      }) || null;

      if (matchedPrediction) {
        console.log(`   ✅ Matched CFB: ${game.away_abbr} @ ${game.home_abbr}`);
      } else {
        console.log(`   ❌ UNMATCHED CFB: ${game.away_team} @ ${game.home_team}`);
        // Log potential matches to help diagnose
        const possibleMatches = cfbPredictions.filter(pred => {
          const homeMatch = pred.home_team.toLowerCase().includes(game.home_team.toLowerCase().split(' ')[0]) ||
                           game.home_team.toLowerCase().includes(pred.home_team.toLowerCase().split(' ')[0]);
          const awayMatch = pred.away_team.toLowerCase().includes(game.away_team.toLowerCase().split(' ')[0]) ||
                           game.away_team.toLowerCase().includes(pred.away_team.toLowerCase().split(' ')[0]);
          return homeMatch || awayMatch;
        });
        if (possibleMatches.length > 0) {
          console.log(`      Possible matches: ${possibleMatches.slice(0, 3).map(p => `${p.away_team} @ ${p.home_team}`).join(', ')}`);
        }
      }
    } else if (game.league === 'NBA') {
      // Extract numeric game_id from format "NBA-401704933"
      const gameIdStr = (game.game_id || game.id || '').replace(/^NBA-/, '');
      const gameIdNum = parseInt(gameIdStr, 10);
      
      if (!isNaN(gameIdNum)) {
        matchedPrediction = nbaPredictions.find(pred => pred.game_id === gameIdNum) || null;
        
        if (!matchedPrediction) {
          // Try team name matching
          matchedPrediction = nbaPredictions.find(pred => {
            return gamesMatch(
              { home_team: game.home_team, away_team: game.away_team },
              { home_team: pred.home_team, away_team: pred.away_team }
            );
          }) || null;
        }
      }
      
      if (matchedPrediction) {
        console.log(`   ✅ Matched NBA: ${game.away_abbr} @ ${game.home_abbr}`);
      }
    } else if (game.league === 'NCAAB') {
      // Extract numeric game_id from format "NCAAB-401704933"
      const gameIdStr = (game.game_id || game.id || '').replace(/^NCAAB-/, '');
      const gameIdNum = parseInt(gameIdStr, 10);
      
      if (!isNaN(gameIdNum)) {
        matchedPrediction = ncaabPredictions.find(pred => pred.game_id === gameIdNum) || null;
        
        if (!matchedPrediction) {
          // Try team name matching
          matchedPrediction = ncaabPredictions.find(pred => {
            return gamesMatch(
              { home_team: game.home_team, away_team: game.away_team },
              { home_team: pred.home_team, away_team: pred.away_team }
            );
          }) || null;
        }
      }
      
      if (matchedPrediction) {
        console.log(`   ✅ Matched NCAAB: ${game.away_abbr} @ ${game.home_abbr}`);
      }
    }

    if (matchedPrediction) {
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
  const games: LiveGame[] = (data || []).map((game: any) => ({
    id: game.id,
    game_id: game.game_id || game.id,
    league: game.league,
    home_team: game.home_team,
    away_team: game.away_team,
    home_abbr: game.home_abbr,
    away_abbr: game.away_abbr,
    home_score: game.home_score,
    away_score: game.away_score,
    quarter: game.period || '',
    period: game.period || '',
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
      game_id: games[0].game_id,
      score: `${games[0].away_score} - ${games[0].home_score}`
    });
  }
  
  return enrichGamesWithPredictions(games);
}
