import { supabase } from './supabase';
import { NFLPrediction } from '../types/nfl';
import { CFBPrediction } from '../types/cfb';

// Get college football supabase client (same as web implementation)
const collegeFootballSupabase = supabase;

/**
 * Fetch NFL predictions from nfl_predictions_epa table and betting lines
 */
export async function fetchNFLPredictions(): Promise<NFLPrediction[]> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get the latest run_id
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
      .select('training_key, home_team, away_team, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, game_date, game_time')
      .gte('game_date', today)
      .eq('run_id', latestRun.run_id);

    if (predsError) {
      console.error('Error fetching NFL predictions:', predsError);
      return [];
    }

    // Fetch betting lines
    const { data: bettingLines, error: linesError } = await collegeFootballSupabase
      .from('nfl_betting_lines')
      .select('training_key, home_team, away_team, home_spread, away_spread, over_line, home_ml, away_ml');

    if (linesError) {
      console.error('Error fetching NFL betting lines:', linesError);
    }

    // Merge predictions with betting lines
    const merged = (predictions || []).map(pred => {
      const line = bettingLines?.find(l => l.training_key === pred.training_key);
      return {
        id: pred.training_key,
        ...pred,
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

    console.log(`📊 Fetched ${merged.length} NFL predictions with lines`);
    return merged;
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
function formatNFLContext(predictions: NFLPrediction[]): string {
  if (!predictions || predictions.length === 0) return '';

  const contextParts = predictions.slice(0, 20).map((pred, idx) => {
    try {
      const awayTeam = pred.away_team || 'Unknown';
      const homeTeam = pred.home_team || 'Unknown';
      const gameDate = pred.game_date ? new Date(pred.game_date).toLocaleDateString() : 'TBD';
      const gameTime = pred.game_time || 'TBD';

      return `
### Game ${idx + 1}: ${awayTeam} @ ${homeTeam}

**Date/Time:** ${gameDate} ${gameTime}

**Betting Lines:**
- Spread: ${homeTeam} ${pred.home_spread || 'N/A'}
- Moneyline: Away ${pred.away_ml || 'N/A'} / Home ${pred.home_ml || 'N/A'}
- Over/Under: ${pred.over_line || 'N/A'}

**Model Predictions (EPA Model):**
- ML Probability: ${pred.home_away_ml_prob ? (pred.home_away_ml_prob * 100).toFixed(1) + '%' : 'N/A'}
- Spread Cover Probability: ${pred.home_away_spread_cover_prob ? (pred.home_away_spread_cover_prob * 100).toFixed(1) + '%' : 'N/A'}
- O/U Probability: ${pred.ou_result_prob ? (pred.ou_result_prob * 100).toFixed(1) + '%' : 'N/A'}

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

I have access to **${predictions.length} NFL games** with complete betting lines, model predictions, weather data, and public betting splits.

${contextParts}`;
}

/**
 * Format CFB predictions as markdown context for AI
 */
function formatCFBContext(predictions: CFBPrediction[]): string {
  if (!predictions || predictions.length === 0) return '';

  const contextParts = predictions.slice(0, 20).map((pred, idx) => {
    try {
      const awayTeam = pred.away_team || 'Unknown';
      const homeTeam = pred.home_team || 'Unknown';
      const gameTime = pred.game_time || pred.game_date || 'TBD';
      const gameDate = gameTime !== 'TBD' ? new Date(gameTime).toLocaleDateString() : 'TBD';

      return `
### Game ${idx + 1}: ${awayTeam} @ ${homeTeam}

**Date/Time:** ${gameDate}

**Betting Lines:**
- Spread: ${homeTeam} ${pred.home_spread || 'N/A'}
- Moneyline: Away ${pred.away_ml || 'N/A'} / Home ${pred.home_ml || 'N/A'}
- Over/Under: ${pred.over_line || 'N/A'}

**Model Predictions:**
- ML Probability: ${pred.home_away_ml_prob ? (pred.home_away_ml_prob * 100).toFixed(1) + '%' : 'N/A'}
- Spread Cover Probability: ${pred.home_away_spread_cover_prob ? (pred.home_away_spread_cover_prob * 100).toFixed(1) + '%' : 'N/A'}
- Total Probability: ${pred.ou_result_prob ? (pred.ou_result_prob * 100).toFixed(1) + '%' : 'N/A'}
- Predicted Score: ${awayTeam} ${pred.pred_away_score || 'N/A'} - ${homeTeam} ${pred.pred_home_score || 'N/A'}

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

I have access to **${predictions.length} College Football games** with complete betting lines, model predictions, weather data, and public betting splits.

${contextParts}`;
}

/**
 * Fetch all game data and format as context for AI
 */
export async function fetchAndFormatGameContext(): Promise<string> {
  console.log('🔄 Fetching game data for AI context...');

  const [nflPredictions, cfbPredictions] = await Promise.all([
    fetchNFLPredictions(),
    fetchCFBPredictions(),
  ]);

  const nflContext = formatNFLContext(nflPredictions);
  const cfbContext = formatCFBContext(cfbPredictions);

  const fullContext = [nflContext, cfbContext].filter(Boolean).join('\n\n');

  console.log(`✅ Game context generated: ${fullContext.length} characters`);
  console.log(`📊 Total games: ${nflPredictions.length} NFL + ${cfbPredictions.length} CFB`);

  return fullContext;
}

