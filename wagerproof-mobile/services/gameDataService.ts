import { collegeFootballSupabase } from './supabase';
import { NFLPrediction } from '../types/nfl';
import { CFBPrediction } from '../types/cfb';
import { NBAGame } from '../types/nba';
import { NCAABGame } from '../types/ncaab';
import { getAllMarketsData } from './polymarketService';
import { PolymarketAllMarketsData } from '../types/polymarket';

// Interface for game with Polymarket data
interface GameWithPolymarket<T> {
  game: T;
  polymarket: PolymarketAllMarketsData | null;
}

// Batch fetch Polymarket data for multiple games (with rate limiting)
async function fetchPolymarketDataForGames<T extends { away_team: string; home_team: string }>(
  games: T[],
  league: 'nfl' | 'cfb' | 'nba' | 'ncaab'
): Promise<Map<string, PolymarketAllMarketsData | null>> {
  const polymarketMap = new Map<string, PolymarketAllMarketsData | null>();
  
  // Limit to first 10 games to avoid too many API calls
  const gamesToFetch = games.slice(0, 10);
  
  // Fetch in parallel but with some throttling
  const results = await Promise.allSettled(
    gamesToFetch.map(async (game, index) => {
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, index * 100));
      const key = `${game.away_team}_${game.home_team}`;
      try {
        const data = await getAllMarketsData(game.away_team, game.home_team, league);
        return { key, data };
      } catch (error) {
        console.error(`Error fetching Polymarket for ${key}:`, error);
        return { key, data: null };
      }
    })
  );
  
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      polymarketMap.set(result.value.key, result.value.data);
    }
  });
  
  return polymarketMap;
}

// Format Polymarket data as context string
function formatPolymarketContext(polymarket: PolymarketAllMarketsData | null): string {
  if (!polymarket) return 'N/A';
  
  const parts: string[] = [];
  
  if (polymarket.moneyline) {
    parts.push(`ML: ${polymarket.moneyline.currentAwayOdds}% - ${polymarket.moneyline.currentHomeOdds}%`);
  }
  if (polymarket.spread) {
    parts.push(`Spread: ${polymarket.spread.currentAwayOdds}% - ${polymarket.spread.currentHomeOdds}%`);
  }
  if (polymarket.total) {
    parts.push(`Total: Over ${polymarket.total.currentAwayOdds}% / Under ${polymarket.total.currentHomeOdds}%`);
  }
  
  return parts.length > 0 ? parts.join(' | ') : 'N/A';
}

/**
 * Fetch NFL predictions from nfl_predictions_epa table and betting lines
 */
export async function fetchNFLPredictions(): Promise<NFLPrediction[]> {
  try {
    // Get yesterday's date to catch games that started recently
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get the latest run_id (without date filter)
    const { data: latestRun, error: runError } = await collegeFootballSupabase
      .from('nfl_predictions_epa')
      .select('run_id')
      .order('run_id', { ascending: false })
      .limit(1)
      .single();

    if (runError || !latestRun?.run_id) {
      console.log('No NFL predictions found');
      return [];
    }

    // Fetch predictions with the latest run_id from yesterday onwards
    const { data: predictions, error: predsError } = await collegeFootballSupabase
      .from('nfl_predictions_epa')
      .select('training_key, home_team, away_team, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, game_date')
      .gte('game_date', yesterdayStr)
      .eq('run_id', latestRun.run_id);

    if (predsError) {
      console.error('Error fetching NFL predictions:', predsError);
      return [];
    }

    // Fetch betting lines
    const { data: bettingLines, error: linesError } = await collegeFootballSupabase
      .from('nfl_betting_lines')
      .select('training_key, home_team, away_team, home_spread, away_spread, over_line, home_ml, away_ml, game_date, game_time');

    if (linesError) {
      console.error('Error fetching NFL betting lines:', linesError);
    }

    // Merge predictions with betting lines
    const merged = (predictions || []).map(pred => {
      const line = bettingLines?.find(l => l.training_key === pred.training_key);
      return {
        id: pred.training_key,
        ...pred,
        game_date: pred.game_date || line?.game_date || 'TBD',
        game_time: pred.game_time || line?.game_time || 'TBD',
        home_spread: line?.home_spread || null,
        away_spread: line?.away_spread || null,
        over_line: line?.over_line || null,
        home_ml: line?.home_ml || null,
        away_ml: line?.away_ml || null,
        unique_id: pred.training_key,
        run_id: latestRun.run_id,
        temperature: null,
        precipitation: null,
        wind_speed: null,
        icon: null,
        spread_splits_label: null,
        total_splits_label: null,
        ml_splits_label: null,
      } as NFLPrediction;
    });

    // Filter out games more than 6 hours past their start time
    const currentTime = new Date();
    const filtered = merged.filter(pred => {
      if (!pred.game_date || !pred.game_time || pred.game_time === 'TBD') {
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
    return filtered;
  } catch (error) {
    console.error('Error in fetchNFLPredictions:', error);
    return [];
  }
}

/**
 * Fetch CFB predictions
 */
export async function fetchCFBPredictions(): Promise<CFBPrediction[]> {
  try {
    const { data: preds, error: predsError } = await collegeFootballSupabase
      .from('cfb_live_weekly_inputs')
      .select('*');

    if (predsError) {
      console.error('Error fetching CFB predictions:', predsError);
      return [];
    }

    const { data: apiPreds, error: apiPredsError } = await collegeFootballSupabase
      .from('cfb_api_predictions')
      .select('*');

    if (apiPredsError) {
      console.error('Error fetching CFB API predictions:', apiPredsError);
    }

    const predictionsWithData: CFBPrediction[] = (preds || []).map((prediction: any) => {
      const apiPred = apiPreds?.find(ap => ap.id === prediction.id);

      return {
        id: prediction.id,
        away_team: prediction.away_team,
        home_team: prediction.home_team,
        home_ml: prediction.home_moneyline || prediction.home_ml,
        away_ml: prediction.away_moneyline || prediction.away_ml,
        home_spread: prediction.api_spread || prediction.home_spread,
        away_spread: prediction.api_spread ? -prediction.api_spread : (prediction.away_spread || null),
        over_line: prediction.api_over_line || prediction.total_line,
        game_date: prediction.start_time || prediction.start_date || prediction.game_date,
        game_time: prediction.start_time || prediction.start_date || prediction.game_time,
        training_key: prediction.training_key,
        unique_id: prediction.unique_id || `${prediction.away_team}_${prediction.home_team}_${prediction.start_time}`,
        run_id: prediction.run_id || null,
        home_away_ml_prob: prediction.pred_ml_proba || prediction.home_away_ml_prob,
        home_away_spread_cover_prob: prediction.pred_spread_proba || prediction.home_away_spread_cover_prob,
        ou_result_prob: prediction.pred_total_proba || prediction.ou_result_prob,
        temperature: prediction.weather_temp_f || prediction.temperature || null,
        precipitation: prediction.precipitation || null,
        wind_speed: prediction.weather_windspeed_mph || prediction.wind_speed || null,
        icon: prediction.icon || null,
        spread_splits_label: prediction.spread_splits_label || null,
        total_splits_label: prediction.total_splits_label || null,
        ml_splits_label: prediction.ml_splits_label || null,
        conference: prediction.conference || null,
        pred_away_score: prediction.pred_away_score || prediction.pred_away_points || null,
        pred_home_score: prediction.pred_home_score || prediction.pred_home_points || null,
        pred_spread: prediction.pred_spread || null,
        home_spread_diff: prediction.home_spread_diff || null,
        pred_total: prediction.pred_total || null,
        total_diff: prediction.total_diff || null,
        pred_over_line: prediction.pred_over_line || null,
        over_line_diff: prediction.over_line_diff || null,
      };
    });

    console.log(`📊 Fetched ${predictionsWithData.length} CFB predictions`);
    return predictionsWithData;
  } catch (error) {
    console.error('Error in fetchCFBPredictions:', error);
    return [];
  }
}

/**
 * Format NFL predictions as markdown context for AI
 */
function formatNFLContext(predictions: NFLPrediction[], polymarketMap?: Map<string, PolymarketAllMarketsData | null>): string {
  if (!predictions || predictions.length === 0) return '';

  const contextParts = predictions.slice(0, 20).map((pred, idx) => {
    try {
      const awayTeam = pred.away_team || 'Unknown';
      const homeTeam = pred.home_team || 'Unknown';
      const gameDate = pred.game_date ? new Date(pred.game_date).toLocaleDateString() : 'TBD';
      const gameTime = pred.game_time || 'TBD';

      // Get Polymarket data for this game
      const gameKey = `${awayTeam}_${homeTeam}`;
      const polymarket = polymarketMap?.get(gameKey) || null;

      // Calculate predictions
      const mlWinner = pred.home_away_ml_prob 
        ? pred.home_away_ml_prob > 0.5 
          ? `${homeTeam} (${(pred.home_away_ml_prob * 100).toFixed(1)}% confidence)`
          : `${awayTeam} (${((1 - pred.home_away_ml_prob) * 100).toFixed(1)}% confidence)`
        : 'N/A';

      const spreadPick = pred.home_away_spread_cover_prob
        ? pred.home_away_spread_cover_prob > 0.5
          ? `${homeTeam} to cover ${pred.home_spread} (${(pred.home_away_spread_cover_prob * 100).toFixed(1)}% confidence)`
          : `${awayTeam} to cover ${pred.away_spread} (${((1 - pred.home_away_spread_cover_prob) * 100).toFixed(1)}% confidence)`
        : 'N/A';

      const ouPick = pred.ou_result_prob
        ? pred.ou_result_prob > 0.5
          ? `OVER ${pred.over_line} (${(pred.ou_result_prob * 100).toFixed(1)}% confidence)`
          : `UNDER ${pred.over_line} (${((1 - pred.ou_result_prob) * 100).toFixed(1)}% confidence)`
        : 'N/A';

      // Format Polymarket data
      let polymarketSection = '';
      if (polymarket) {
        polymarketSection = `
**Polymarket Prediction Markets:**`;
        if (polymarket.moneyline) {
          polymarketSection += `
- Moneyline: ${awayTeam} ${polymarket.moneyline.currentAwayOdds}% / ${homeTeam} ${polymarket.moneyline.currentHomeOdds}%`;
        }
        if (polymarket.spread) {
          polymarketSection += `
- Spread: Away cover ${polymarket.spread.currentAwayOdds}% / Home cover ${polymarket.spread.currentHomeOdds}%`;
        }
        if (polymarket.total) {
          polymarketSection += `
- Total: Over ${polymarket.total.currentAwayOdds}% / Under ${polymarket.total.currentHomeOdds}%`;
        }
      }

      return `
### Game ${idx + 1}: ${awayTeam} @ ${homeTeam}

**Date/Time:** ${gameDate} ${gameTime}

**Betting Lines:**
- Spread: ${homeTeam} ${pred.home_spread || 'N/A'}
- Moneyline: Away ${pred.away_ml || 'N/A'} / Home ${pred.home_ml || 'N/A'}
- Over/Under: ${pred.over_line || 'N/A'}

**Model Predictions (EPA Model):**
- **Moneyline Pick:** ${mlWinner}
- **Spread Pick:** ${spreadPick}
- **Over/Under Pick:** ${ouPick}
- Raw Probabilities: ML ${pred.home_away_ml_prob ? (pred.home_away_ml_prob * 100).toFixed(1) + '%' : 'N/A'} | Spread ${pred.home_away_spread_cover_prob ? (pred.home_away_spread_cover_prob * 100).toFixed(1) + '%' : 'N/A'} | O/U ${pred.ou_result_prob ? (pred.ou_result_prob * 100).toFixed(1) + '%' : 'N/A'}
${polymarketSection}

**Weather:** ${pred.temperature ? pred.temperature + '°F' : 'N/A'}, Wind: ${pred.wind_speed ? pred.wind_speed + ' mph' : 'N/A'}

**Public Betting Splits:**
- Spread: ${pred.spread_splits_label || 'N/A'}
- Total: ${pred.total_splits_label || 'N/A'}
- Moneyline: ${pred.ml_splits_label || 'N/A'}

---`;
    } catch (err) {
      console.error('Error building context for NFL game:', pred, err);
      return '';
    }
  }).filter(Boolean).join('\n');

  return `# 🏈 NFL Games Data

I have access to **${predictions.length} NFL games** with complete betting lines, model predictions (EPA Model), weather data, public betting splits, and Polymarket prediction market data.

**POLYMARKET DATA:** Real money prediction market probabilities from Polymarket showing what bettors are wagering on moneyline, spread, and totals.

${contextParts}`;
}

/**
 * Format CFB predictions as markdown context for AI
 */
function formatCFBContext(predictions: CFBPrediction[], polymarketMap?: Map<string, PolymarketAllMarketsData | null>): string {
  if (!predictions || predictions.length === 0) return '';

  const contextParts = predictions.slice(0, 20).map((pred, idx) => {
    try {
      const awayTeam = pred.away_team || 'Unknown';
      const homeTeam = pred.home_team || 'Unknown';
      const gameTime = pred.game_time || pred.game_date || 'TBD';
      const gameDate = gameTime !== 'TBD' ? new Date(gameTime).toLocaleDateString() : 'TBD';

      // Get Polymarket data for this game
      const gameKey = `${awayTeam}_${homeTeam}`;
      const polymarket = polymarketMap?.get(gameKey) || null;

      // Calculate predictions
      const mlWinner = pred.home_away_ml_prob 
        ? pred.home_away_ml_prob > 0.5 
          ? `${homeTeam} (${(pred.home_away_ml_prob * 100).toFixed(1)}% confidence)`
          : `${awayTeam} (${((1 - pred.home_away_ml_prob) * 100).toFixed(1)}% confidence)`
        : 'N/A';

      const spreadPick = pred.home_away_spread_cover_prob
        ? pred.home_away_spread_cover_prob > 0.5
          ? `${homeTeam} to cover ${pred.home_spread} (${(pred.home_away_spread_cover_prob * 100).toFixed(1)}% confidence)`
          : `${awayTeam} to cover ${pred.away_spread} (${((1 - pred.home_away_spread_cover_prob) * 100).toFixed(1)}% confidence)`
        : 'N/A';

      const ouPick = pred.ou_result_prob
        ? pred.ou_result_prob > 0.5
          ? `OVER ${pred.over_line} (${(pred.ou_result_prob * 100).toFixed(1)}% confidence)`
          : `UNDER ${pred.over_line} (${((1 - pred.ou_result_prob) * 100).toFixed(1)}% confidence)`
        : 'N/A';

      // Value analysis - critical for betting decisions
      const spreadValue = pred.home_spread_diff !== null && pred.home_spread_diff !== undefined
        ? `${pred.home_spread_diff > 0 ? '+' : ''}${pred.home_spread_diff.toFixed(1)} points (${pred.home_spread_diff > 0 ? 'FAVORABLE to Home' : 'FAVORABLE to Away'})`
        : 'N/A';

      const totalValue = pred.total_diff !== null && pred.total_diff !== undefined
        ? `${pred.total_diff > 0 ? '+' : ''}${pred.total_diff.toFixed(1)} points (${pred.total_diff > 0 ? 'OVER has VALUE' : 'UNDER has VALUE'})`
        : 'N/A';

      // Format Polymarket data
      let polymarketSection = '';
      if (polymarket) {
        polymarketSection = `
**Polymarket Prediction Markets:**`;
        if (polymarket.moneyline) {
          polymarketSection += `
- Moneyline: ${awayTeam} ${polymarket.moneyline.currentAwayOdds}% / ${homeTeam} ${polymarket.moneyline.currentHomeOdds}%`;
        }
        if (polymarket.spread) {
          polymarketSection += `
- Spread: Away cover ${polymarket.spread.currentAwayOdds}% / Home cover ${polymarket.spread.currentHomeOdds}%`;
        }
        if (polymarket.total) {
          polymarketSection += `
- Total: Over ${polymarket.total.currentAwayOdds}% / Under ${polymarket.total.currentHomeOdds}%`;
        }
      }

      return `
### Game ${idx + 1}: ${awayTeam} @ ${homeTeam}
${pred.conference ? `**Conference:** ${pred.conference}` : ''}

**Date/Time:** ${gameDate}

**Betting Lines:**
- Spread: ${homeTeam} ${pred.home_spread || 'N/A'}
- Moneyline: Away ${pred.away_ml || 'N/A'} / Home ${pred.home_ml || 'N/A'}
- Over/Under: ${pred.over_line || 'N/A'}

**Model Predictions:**
- **Predicted Score:** ${awayTeam} ${pred.pred_away_score !== null ? Math.round(pred.pred_away_score) : 'N/A'} - ${homeTeam} ${pred.pred_home_score !== null ? Math.round(pred.pred_home_score) : 'N/A'}
- **Predicted Spread:** ${pred.pred_spread !== null && pred.pred_spread !== undefined ? `${pred.pred_spread > 0 ? homeTeam : awayTeam} ${Math.abs(pred.pred_spread).toFixed(1)}` : 'N/A'}
- **Predicted Total:** ${pred.pred_total !== null && pred.pred_total !== undefined ? pred.pred_total.toFixed(1) : 'N/A'}

**Model Picks:**
- **Moneyline:** ${mlWinner}
- **Spread:** ${spreadPick}
- **Over/Under:** ${ouPick}
${polymarketSection}

**VALUE ANALYSIS (Model vs. Market):**
- **Spread Difference:** ${spreadValue}
- **Total Difference:** ${totalValue}
${pred.over_line_diff !== null && pred.over_line_diff !== undefined ? `- **O/U Line Diff:** ${pred.over_line_diff > 0 ? '+' : ''}${pred.over_line_diff.toFixed(1)}` : ''}

**Confidence Levels:**
- ML: ${pred.home_away_ml_prob ? (pred.home_away_ml_prob * 100).toFixed(1) + '%' : 'N/A'}
- Spread: ${pred.home_away_spread_cover_prob ? (pred.home_away_spread_cover_prob * 100).toFixed(1) + '%' : 'N/A'}
- Total: ${pred.ou_result_prob ? (pred.ou_result_prob * 100).toFixed(1) + '%' : 'N/A'}

**Weather:** ${pred.temperature ? pred.temperature + '°F' : 'N/A'}, Wind: ${pred.wind_speed ? pred.wind_speed + ' mph' : 'N/A'}

**Public Betting Splits:**
- Spread: ${pred.spread_splits_label || 'N/A'}
- Total: ${pred.total_splits_label || 'N/A'}
- Moneyline: ${pred.ml_splits_label || 'N/A'}

---`;
    } catch (err) {
      console.error('Error building context for CFB game:', pred, err);
      return '';
    }
  }).filter(Boolean).join('\n');

  return `# 🏈 College Football Games Data

I have access to **${predictions.length} College Football games** with complete betting lines, model predictions, VALUE ANALYSIS (model vs. market differences), weather data, public betting splits, and Polymarket prediction market data.

**KEY INSIGHT:** The "VALUE ANALYSIS" section shows where the model's prediction differs from the betting line. Positive spread differences favor the home team, negative favor away. Positive total differences suggest betting OVER, negative suggest UNDER.

**POLYMARKET DATA:** Real money prediction market probabilities from Polymarket showing what bettors are wagering on moneyline, spread, and totals.

${contextParts}`;
}

/**
 * Fetch NBA predictions
 */
export async function fetchNBAPredictions(): Promise<NBAGame[]> {
  try {
    // Fetch ALL games from nba_input_values_view
    const { data: inputValues, error: inputError } = await collegeFootballSupabase
      .from('nba_input_values_view')
      .select('*');

    if (inputError) {
      console.error('Error fetching NBA input values:', inputError);
      return [];
    }

    if (!inputValues || inputValues.length === 0) {
      console.log('No NBA games found');
      return [];
    }

    // Fetch latest predictions
    const { data: allPredictions, error: predError } = await collegeFootballSupabase
      .from('nba_predictions')
      .select('game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread, run_id, as_of_ts_utc');

    if (predError) {
      console.error('Error fetching NBA predictions:', predError);
    }

    // Find latest predictions for each game
    let predictionMap = new Map();
    if (allPredictions && allPredictions.length > 0) {
      const gameIds = inputValues.map((g: any) => g.game_id);
      allPredictions.forEach((pred: any) => {
        if (gameIds.includes(pred.game_id)) {
          const existing = predictionMap.get(pred.game_id);
          if (!existing || (pred.as_of_ts_utc && (!existing.as_of_ts_utc || pred.as_of_ts_utc > existing.as_of_ts_utc))) {
            predictionMap.set(pred.game_id, pred);
          }
        }
      });
    }

    // Merge input values with predictions
    const games: NBAGame[] = inputValues.map((input: any) => {
      const prediction = predictionMap.get(input.game_id);
      const gameIdStr = String(input.game_id);
      
      // Calculate spread cover probability
      let spreadCoverProb = null;
      if (prediction && prediction.model_fair_home_spread !== null && input.home_spread !== null) {
        const spreadDiff = Math.abs(prediction.model_fair_home_spread - input.home_spread);
        if (prediction.model_fair_home_spread < input.home_spread) {
          spreadCoverProb = 0.5 + Math.min(spreadDiff * 0.05, 0.35);
        } else {
          spreadCoverProb = 0.5 - Math.min(spreadDiff * 0.05, 0.35);
        }
      } else if (prediction?.home_win_prob) {
        spreadCoverProb = prediction.home_win_prob;
      }
      
      // Calculate over/under probability
      let ouProb = null;
      if (prediction && prediction.model_fair_total !== null && input.total_line !== null) {
        const totalDiff = prediction.model_fair_total - input.total_line;
        if (totalDiff > 0) {
          ouProb = 0.5 + Math.min(Math.abs(totalDiff) * 0.02, 0.35);
        } else {
          ouProb = 0.5 - Math.min(Math.abs(totalDiff) * 0.02, 0.35);
        }
      }

      return {
        id: gameIdStr,
        game_id: input.game_id,
        away_team: input.away_team,
        home_team: input.home_team,
        away_abbr: (input.away_abbr && input.away_abbr.trim()) || input.away_team || 'AWAY',
        home_abbr: (input.home_abbr && input.home_abbr.trim()) || input.home_team || 'HOME',
        home_ml: input.home_moneyline,
        away_ml: input.home_moneyline !== null ? (input.home_moneyline > 0 ? -(input.home_moneyline + 100) : 100 - input.home_moneyline) : null,
        home_spread: input.home_spread,
        away_spread: input.home_spread ? -input.home_spread : null,
        over_line: input.total_line,
        game_date: input.game_date,
        game_time: input.tipoff_time_et,
        training_key: gameIdStr,
        unique_id: gameIdStr,
        home_adj_offense: input.home_adj_off_rtg_pregame,
        away_adj_offense: input.away_adj_off_rtg_pregame,
        home_adj_defense: input.home_adj_def_rtg_pregame,
        away_adj_defense: input.away_adj_def_rtg_pregame,
        home_adj_pace: input.home_adj_pace_pregame,
        away_adj_pace: input.away_adj_pace_pregame,
        home_ats_pct: input.home_ats_pct,
        away_ats_pct: input.away_ats_pct,
        home_over_pct: input.home_over_pct,
        away_over_pct: input.away_over_pct,
        home_away_ml_prob: prediction?.home_win_prob || null,
        home_away_spread_cover_prob: spreadCoverProb,
        ou_result_prob: ouProb,
        run_id: prediction?.run_id || null,
        home_score_pred: prediction?.home_score_pred || null,
        away_score_pred: prediction?.away_score_pred || null,
        model_fair_home_spread: prediction?.model_fair_home_spread || null,
        model_fair_total: prediction?.model_fair_total || null,
      };
    });

    console.log(`📊 Fetched ${games.length} NBA predictions`);
    return games;
  } catch (error) {
    console.error('Error in fetchNBAPredictions:', error);
    return [];
  }
}

/**
 * Fetch NCAAB predictions
 */
export async function fetchNCAABPredictions(): Promise<NCAABGame[]> {
  try {
    // Fetch ALL games from v_cbb_input_values
    const { data: inputValues, error: inputError } = await collegeFootballSupabase
      .from('v_cbb_input_values')
      .select('*');

    if (inputError) {
      console.error('Error fetching NCAAB input values:', inputError);
      return [];
    }

    if (!inputValues || inputValues.length === 0) {
      console.log('No NCAAB games found');
      return [];
    }

    // Fetch all predictions
    const { data: allPredictions, error: predError } = await collegeFootballSupabase
      .from('ncaab_predictions')
      .select('*');

    if (predError) {
      console.error('Error fetching NCAAB predictions:', predError);
    }

    // Find latest predictions for each game
    let predictionMap = new Map();
    if (allPredictions && allPredictions.length > 0) {
      const gameIds = inputValues.map((g: any) => g.game_id);
      allPredictions.forEach((pred: any) => {
        if (gameIds.includes(pred.game_id)) {
          const existing = predictionMap.get(pred.game_id);
          if (!existing || (pred.as_of_ts_utc && (!existing.as_of_ts_utc || pred.as_of_ts_utc > existing.as_of_ts_utc))) {
            predictionMap.set(pred.game_id, pred);
          }
        }
      });
    }

    // Merge input values with predictions
    const games: NCAABGame[] = inputValues.map((input: any) => {
      const prediction = predictionMap.get(input.game_id);
      const gameIdStr = String(input.game_id);

      return {
        id: gameIdStr,
        game_id: input.game_id,
        away_team: input.away_team,
        home_team: input.home_team,
        home_ml: prediction?.vegas_home_moneyline || input.homeMoneyline,
        away_ml: prediction?.vegas_away_moneyline || input.awayMoneyline,
        home_spread: prediction?.vegas_home_spread || input.spread,
        away_spread: prediction?.vegas_home_spread ? -prediction.vegas_home_spread : (input.spread ? -input.spread : null),
        over_line: prediction?.vegas_total || input.over_under,
        game_date: input.game_date_et,
        game_time: input.start_utc || input.tipoff_time_et,
        training_key: gameIdStr,
        unique_id: gameIdStr,
        home_adj_offense: input.home_adj_offense,
        away_adj_offense: input.away_adj_offense,
        home_adj_defense: input.home_adj_defense,
        away_adj_defense: input.away_adj_defense,
        home_adj_pace: input.home_adj_pace,
        away_adj_pace: input.away_adj_pace,
        home_ranking: input.home_ranking,
        away_ranking: input.away_ranking,
        conference_game: input.conference_game,
        neutral_site: input.neutral_site,
        home_away_ml_prob: prediction?.home_win_prob || null,
        home_away_spread_cover_prob: prediction?.home_win_prob || null,
        ou_result_prob: prediction && prediction.pred_total_points && prediction.vegas_total
          ? (prediction.pred_total_points > prediction.vegas_total ? 0.6 : 0.4)
          : null,
        pred_home_margin: prediction?.pred_home_margin || null,
        pred_total_points: prediction?.pred_total_points || null,
        run_id: prediction?.run_id || null,
        home_score_pred: prediction?.home_score_pred || null,
        away_score_pred: prediction?.away_score_pred || null,
        model_fair_home_spread: prediction?.model_fair_home_spread || null,
      };
    });

    console.log(`📊 Fetched ${games.length} NCAAB predictions`);
    return games;
  } catch (error) {
    console.error('Error in fetchNCAABPredictions:', error);
    return [];
  }
}

/**
 * Format NBA predictions as markdown context for AI
 */
function formatNBAContext(predictions: NBAGame[], polymarketMap?: Map<string, PolymarketAllMarketsData | null>): string {
  if (!predictions || predictions.length === 0) return '';

  const contextParts = predictions.slice(0, 20).map((pred, idx) => {
    try {
      const awayTeam = pred.away_team || 'Unknown';
      const homeTeam = pred.home_team || 'Unknown';
      const gameDate = pred.game_date ? new Date(pred.game_date).toLocaleDateString() : 'TBD';
      const gameTime = pred.game_time || 'TBD';

      // Get Polymarket data for this game
      const gameKey = `${awayTeam}_${homeTeam}`;
      const polymarket = polymarketMap?.get(gameKey) || null;

      // Calculate predictions
      const mlWinner = pred.home_away_ml_prob 
        ? pred.home_away_ml_prob > 0.5 
          ? `${homeTeam} (${(pred.home_away_ml_prob * 100).toFixed(1)}% confidence)`
          : `${awayTeam} (${((1 - pred.home_away_ml_prob) * 100).toFixed(1)}% confidence)`
        : 'N/A';

      const spreadPick = pred.home_away_spread_cover_prob
        ? pred.home_away_spread_cover_prob > 0.5
          ? `${homeTeam} to cover ${pred.home_spread} (${(pred.home_away_spread_cover_prob * 100).toFixed(1)}% confidence)`
          : `${awayTeam} to cover ${pred.away_spread} (${((1 - pred.home_away_spread_cover_prob) * 100).toFixed(1)}% confidence)`
        : 'N/A';

      const ouPick = pred.ou_result_prob
        ? pred.ou_result_prob > 0.5
          ? `OVER ${pred.over_line} (${(pred.ou_result_prob * 100).toFixed(1)}% confidence)`
          : `UNDER ${pred.over_line} (${((1 - pred.ou_result_prob) * 100).toFixed(1)}% confidence)`
        : 'N/A';

      // Value analysis
      const spreadValue = pred.model_fair_home_spread !== null && pred.home_spread !== null
        ? `${(pred.model_fair_home_spread - pred.home_spread).toFixed(1)} points (${pred.model_fair_home_spread < pred.home_spread ? 'FAVORABLE to Home' : 'FAVORABLE to Away'})`
        : 'N/A';

      const totalValue = pred.model_fair_total !== null && pred.over_line !== null
        ? `${(pred.model_fair_total - pred.over_line).toFixed(1)} points (${pred.model_fair_total > pred.over_line ? 'OVER has VALUE' : 'UNDER has VALUE'})`
        : 'N/A';

      // Format Polymarket data
      let polymarketSection = '';
      if (polymarket) {
        polymarketSection = `
**Polymarket Prediction Markets:**`;
        if (polymarket.moneyline) {
          polymarketSection += `
- Moneyline: ${awayTeam} ${polymarket.moneyline.currentAwayOdds}% / ${homeTeam} ${polymarket.moneyline.currentHomeOdds}%`;
        }
        if (polymarket.spread) {
          polymarketSection += `
- Spread: Away cover ${polymarket.spread.currentAwayOdds}% / Home cover ${polymarket.spread.currentHomeOdds}%`;
        }
        if (polymarket.total) {
          polymarketSection += `
- Total: Over ${polymarket.total.currentAwayOdds}% / Under ${polymarket.total.currentHomeOdds}%`;
        }
      }

      return `
### Game ${idx + 1}: ${awayTeam} @ ${homeTeam}

**Date/Time:** ${gameDate} ${gameTime}

**Betting Lines:**
- Spread: ${homeTeam} ${pred.home_spread || 'N/A'}
- Moneyline: Away ${pred.away_ml || 'N/A'} / Home ${pred.home_ml || 'N/A'}
- Over/Under: ${pred.over_line || 'N/A'}

**Model Predictions:**
- **Predicted Score:** ${awayTeam} ${pred.away_score_pred !== null ? Math.round(pred.away_score_pred) : 'N/A'} - ${homeTeam} ${pred.home_score_pred !== null ? Math.round(pred.home_score_pred) : 'N/A'}
- **Model Fair Spread:** ${pred.model_fair_home_spread !== null ? pred.model_fair_home_spread.toFixed(1) : 'N/A'}
- **Model Fair Total:** ${pred.model_fair_total !== null ? pred.model_fair_total.toFixed(1) : 'N/A'}

**Model Picks:**
- **Moneyline:** ${mlWinner}
- **Spread:** ${spreadPick}
- **Over/Under:** ${ouPick}
${polymarketSection}

**VALUE ANALYSIS (Model vs. Market):**
- **Spread Difference:** ${spreadValue}
- **Total Difference:** ${totalValue}

**Confidence Levels:**
- ML: ${pred.home_away_ml_prob ? (pred.home_away_ml_prob * 100).toFixed(1) + '%' : 'N/A'}
- Spread: ${pred.home_away_spread_cover_prob ? (pred.home_away_spread_cover_prob * 100).toFixed(1) + '%' : 'N/A'}
- Total: ${pred.ou_result_prob ? (pred.ou_result_prob * 100).toFixed(1) + '%' : 'N/A'}

**Team Stats:**
- ${homeTeam}: Offense ${pred.home_adj_offense?.toFixed(1) || 'N/A'}, Defense ${pred.home_adj_defense?.toFixed(1) || 'N/A'}, Pace ${pred.home_adj_pace?.toFixed(1) || 'N/A'}
- ${awayTeam}: Offense ${pred.away_adj_offense?.toFixed(1) || 'N/A'}, Defense ${pred.away_adj_defense?.toFixed(1) || 'N/A'}, Pace ${pred.away_adj_pace?.toFixed(1) || 'N/A'}

**Trends:**
- ${homeTeam} ATS: ${pred.home_ats_pct ? (pred.home_ats_pct * 100).toFixed(1) + '%' : 'N/A'}, Over: ${pred.home_over_pct ? (pred.home_over_pct * 100).toFixed(1) + '%' : 'N/A'}
- ${awayTeam} ATS: ${pred.away_ats_pct ? (pred.away_ats_pct * 100).toFixed(1) + '%' : 'N/A'}, Over: ${pred.away_over_pct ? (pred.away_over_pct * 100).toFixed(1) + '%' : 'N/A'}

---`;
    } catch (err) {
      console.error('Error building context for NBA game:', pred, err);
      return '';
    }
  }).filter(Boolean).join('\n');

  return `# 🏀 NBA Games Data

I have access to **${predictions.length} NBA games** with complete betting lines, model predictions, VALUE ANALYSIS (model vs. market differences), team stats (adjusted offense/defense/pace), betting trends (ATS%, Over%), and Polymarket prediction market data.

**KEY INSIGHT:** The "VALUE ANALYSIS" section shows where the model's prediction differs from the betting line. Positive spread differences favor the home team, negative favor away. Positive total differences suggest betting OVER, negative suggest UNDER.

**POLYMARKET DATA:** Real money prediction market probabilities from Polymarket showing what bettors are wagering on moneyline, spread, and totals.

${contextParts}`;
}

/**
 * Format NCAAB predictions as markdown context for AI
 */
function formatNCAABContext(predictions: NCAABGame[], polymarketMap?: Map<string, PolymarketAllMarketsData | null>): string {
  if (!predictions || predictions.length === 0) return '';

  const contextParts = predictions.slice(0, 20).map((pred, idx) => {
    try {
      const awayTeam = pred.away_team || 'Unknown';
      const homeTeam = pred.home_team || 'Unknown';
      const gameDate = pred.game_date ? new Date(pred.game_date).toLocaleDateString() : 'TBD';
      const gameTime = pred.game_time || 'TBD';

      // Get Polymarket data for this game
      const gameKey = `${awayTeam}_${homeTeam}`;
      const polymarket = polymarketMap?.get(gameKey) || null;

      // Calculate predictions
      const mlWinner = pred.home_away_ml_prob 
        ? pred.home_away_ml_prob > 0.5 
          ? `${homeTeam} (${(pred.home_away_ml_prob * 100).toFixed(1)}% confidence)`
          : `${awayTeam} (${((1 - pred.home_away_ml_prob) * 100).toFixed(1)}% confidence)`
        : 'N/A';

      const spreadPick = pred.home_away_spread_cover_prob
        ? pred.home_away_spread_cover_prob > 0.5
          ? `${homeTeam} to cover ${pred.home_spread} (${(pred.home_away_spread_cover_prob * 100).toFixed(1)}% confidence)`
          : `${awayTeam} to cover ${pred.away_spread} (${((1 - pred.home_away_spread_cover_prob) * 100).toFixed(1)}% confidence)`
        : 'N/A';

      const ouPick = pred.ou_result_prob
        ? pred.ou_result_prob > 0.5
          ? `OVER ${pred.over_line} (${(pred.ou_result_prob * 100).toFixed(1)}% confidence)`
          : `UNDER ${pred.over_line} (${((1 - pred.ou_result_prob) * 100).toFixed(1)}% confidence)`
        : 'N/A';

      // Value analysis
      const spreadValue = pred.model_fair_home_spread !== null && pred.home_spread !== null
        ? `${(pred.model_fair_home_spread - pred.home_spread).toFixed(1)} points (${pred.model_fair_home_spread < pred.home_spread ? 'FAVORABLE to Home' : 'FAVORABLE to Away'})`
        : 'N/A';

      const totalValue = pred.pred_total_points !== null && pred.over_line !== null
        ? `${(pred.pred_total_points - pred.over_line).toFixed(1)} points (${pred.pred_total_points > pred.over_line ? 'OVER has VALUE' : 'UNDER has VALUE'})`
        : 'N/A';

      // Format Polymarket data
      let polymarketSection = '';
      if (polymarket) {
        polymarketSection = `
**Polymarket Prediction Markets:**`;
        if (polymarket.moneyline) {
          polymarketSection += `
- Moneyline: ${awayTeam} ${polymarket.moneyline.currentAwayOdds}% / ${homeTeam} ${polymarket.moneyline.currentHomeOdds}%`;
        }
        if (polymarket.spread) {
          polymarketSection += `
- Spread: Away cover ${polymarket.spread.currentAwayOdds}% / Home cover ${polymarket.spread.currentHomeOdds}%`;
        }
        if (polymarket.total) {
          polymarketSection += `
- Total: Over ${polymarket.total.currentAwayOdds}% / Under ${polymarket.total.currentHomeOdds}%`;
        }
      }

      return `
### Game ${idx + 1}: ${awayTeam} @ ${homeTeam}
${pred.conference_game ? '**Conference Game:** Yes' : ''}
${pred.neutral_site ? '**Neutral Site:** Yes' : ''}
${pred.home_ranking ? `**${homeTeam} Ranking:** #${pred.home_ranking}` : ''}
${pred.away_ranking ? `**${awayTeam} Ranking:** #${pred.away_ranking}` : ''}

**Date/Time:** ${gameDate} ${gameTime}

**Betting Lines:**
- Spread: ${homeTeam} ${pred.home_spread || 'N/A'}
- Moneyline: Away ${pred.away_ml || 'N/A'} / Home ${pred.home_ml || 'N/A'}
- Over/Under: ${pred.over_line || 'N/A'}

**Model Predictions:**
- **Predicted Score:** ${awayTeam} ${pred.away_score_pred !== null ? Math.round(pred.away_score_pred) : 'N/A'} - ${homeTeam} ${pred.home_score_pred !== null ? Math.round(pred.home_score_pred) : 'N/A'}
- **Predicted Margin:** ${pred.pred_home_margin !== null ? pred.pred_home_margin.toFixed(1) : 'N/A'} (${pred.pred_home_margin !== null && pred.pred_home_margin > 0 ? homeTeam : awayTeam} by ${Math.abs(pred.pred_home_margin || 0).toFixed(1)})
- **Predicted Total:** ${pred.pred_total_points !== null ? pred.pred_total_points.toFixed(1) : 'N/A'}
- **Model Fair Spread:** ${pred.model_fair_home_spread !== null ? pred.model_fair_home_spread.toFixed(1) : 'N/A'}

**Model Picks:**
- **Moneyline:** ${mlWinner}
- **Spread:** ${spreadPick}
- **Over/Under:** ${ouPick}
${polymarketSection}

**VALUE ANALYSIS (Model vs. Market):**
- **Spread Difference:** ${spreadValue}
- **Total Difference:** ${totalValue}

**Confidence Levels:**
- ML: ${pred.home_away_ml_prob ? (pred.home_away_ml_prob * 100).toFixed(1) + '%' : 'N/A'}
- Spread: ${pred.home_away_spread_cover_prob ? (pred.home_away_spread_cover_prob * 100).toFixed(1) + '%' : 'N/A'}
- Total: ${pred.ou_result_prob ? (pred.ou_result_prob * 100).toFixed(1) + '%' : 'N/A'}

**Team Stats:**
- ${homeTeam}: Offense ${pred.home_adj_offense?.toFixed(1) || 'N/A'}, Defense ${pred.home_adj_defense?.toFixed(1) || 'N/A'}, Pace ${pred.home_adj_pace?.toFixed(1) || 'N/A'}
- ${awayTeam}: Offense ${pred.away_adj_offense?.toFixed(1) || 'N/A'}, Defense ${pred.away_adj_defense?.toFixed(1) || 'N/A'}, Pace ${pred.away_adj_pace?.toFixed(1) || 'N/A'}

---`;
    } catch (err) {
      console.error('Error building context for NCAAB game:', pred, err);
      return '';
    }
  }).filter(Boolean).join('\n');

  return `# 🏀 College Basketball Games Data

I have access to **${predictions.length} College Basketball games** with complete betting lines, model predictions, VALUE ANALYSIS (model vs. market differences), team stats (adjusted offense/defense/pace), rankings, game context (conference games, neutral site), and Polymarket prediction market data.

**KEY INSIGHT:** The "VALUE ANALYSIS" section shows where the model's prediction differs from the betting line. Positive spread differences favor the home team, negative favor away. Positive total differences suggest betting OVER, negative suggest UNDER.

**POLYMARKET DATA:** Real money prediction market probabilities from Polymarket showing what bettors are wagering on moneyline, spread, and totals.

${contextParts}`;
}

/**
 * Fetch all game data and format as context for AI
 */
export async function fetchAndFormatGameContext(): Promise<string> {
  console.log('🔄 Fetching game data for AI context...');

  // First, fetch all predictions
  const [nflPredictions, cfbPredictions, nbaPredictions, ncaabPredictions] = await Promise.all([
    fetchNFLPredictions(),
    fetchCFBPredictions(),
    fetchNBAPredictions(),
    fetchNCAABPredictions(),
  ]);

  console.log(`📊 Fetched predictions:`);
  console.log(`   - NFL: ${nflPredictions.length} games`);
  console.log(`   - CFB: ${cfbPredictions.length} games`);
  console.log(`   - NBA: ${nbaPredictions.length} games`);
  console.log(`   - NCAAB: ${ncaabPredictions.length} games`);

  // Fetch Polymarket data for all leagues in parallel
  console.log('📈 Fetching Polymarket data...');
  const [nflPolymarket, cfbPolymarket, nbaPolymarket, ncaabPolymarket] = await Promise.all([
    fetchPolymarketDataForGames(nflPredictions, 'nfl'),
    fetchPolymarketDataForGames(cfbPredictions, 'cfb'),
    fetchPolymarketDataForGames(nbaPredictions, 'nba'),
    fetchPolymarketDataForGames(ncaabPredictions, 'ncaab'),
  ]);

  console.log(`📈 Fetched Polymarket data:`);
  console.log(`   - NFL: ${nflPolymarket.size} games`);
  console.log(`   - CFB: ${cfbPolymarket.size} games`);
  console.log(`   - NBA: ${nbaPolymarket.size} games`);
  console.log(`   - NCAAB: ${ncaabPolymarket.size} games`);

  const nflContext = formatNFLContext(nflPredictions, nflPolymarket);
  const cfbContext = formatCFBContext(cfbPredictions, cfbPolymarket);
  const nbaContext = formatNBAContext(nbaPredictions, nbaPolymarket);
  const ncaabContext = formatNCAABContext(ncaabPredictions, ncaabPolymarket);

  console.log(`📝 Formatted contexts:`);
  console.log(`   - NFL context: ${nflContext.length} chars`);
  console.log(`   - CFB context: ${cfbContext.length} chars`);
  console.log(`   - NBA context: ${nbaContext.length} chars`);
  console.log(`   - NCAAB context: ${ncaabContext.length} chars`);

  const fullContext = [nflContext, cfbContext, nbaContext, ncaabContext].filter(Boolean).join('\n\n');

  console.log(`✅ Game context generated: ${fullContext.length} characters`);
  console.log(`📊 Total games: ${nflPredictions.length} NFL + ${cfbPredictions.length} CFB + ${nbaPredictions.length} NBA + ${ncaabPredictions.length} NCAAB`);

  if (fullContext.length === 0) {
    console.warn('⚠️ WARNING: Generated context is EMPTY!');
    console.warn('   This means no game data was found or formatting failed.');
  } else {
    console.log('📄 Context preview (first 200 chars):', fullContext.substring(0, 200));
  }

  return fullContext;
}

