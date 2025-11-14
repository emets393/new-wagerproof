import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

// NBA Input Values View Interface
export interface NBAInputValues {
  game_id: number;
  season: number;
  game_date: string;
  tipoff_time_et: string;
  home_team: string;
  away_team: string;
  home_abbr: string;
  away_abbr: string;
  home_team_id: number;
  away_team_id: number;
  home_moneyline: number | null;
  home_spread: number | null;
  total_line: number | null;
  // Advanced stats
  home_adj_offense: number | null;
  away_adj_offense: number | null;
  home_adj_defense: number | null;
  away_adj_defense: number | null;
  home_adj_pace: number | null;
  away_adj_pace: number | null;
  // Trends
  home_ats_pct: number | null;
  away_ats_pct: number | null;
  home_over_pct: number | null;
  away_over_pct: number | null;
  home_win_streak: number | null;
  away_win_streak: number | null;
}

// NBA Predictions Interface
export interface NBAPrediction {
  run_id: string;
  game_id: number;
  // Prediction fields - structure TBD since table is empty
  [key: string]: any;
}

// NCAAB Input Values View Interface
export interface NCAABInputValues {
  game_id: number;
  season: number;
  season_type: string;
  game_date_et: string;
  start_utc: string;
  start_et_local: string;
  tipoff_time_et: string;
  home_team: string;
  away_team: string;
  home_team_id: number;
  away_team_id: number;
  spread: number | null;
  over_under: number | null;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  // Advanced stats
  home_adj_offense: number | null;
  away_adj_offense: number | null;
  home_adj_defense: number | null;
  away_adj_defense: number | null;
  home_adj_pace: number | null;
  away_adj_pace: number | null;
  // Trends
  home_adj_offense_trend_l3: number | null;
  home_adj_defense_trend_l3: number | null;
  home_adj_pace_trend_l3: number | null;
  away_adj_offense_trend_l3: number | null;
  away_adj_defense_trend_l3: number | null;
  away_adj_pace_trend_l3: number | null;
  // Context
  conference_game: boolean | null;
  neutral_site: boolean | null;
  home_seed: number | null;
  away_seed: number | null;
  home_ranking: number | null;
  away_ranking: number | null;
}

// NCAAB Predictions Interface
export interface NCAABPrediction {
  run_id: string;
  game_id: number;
  season: number;
  season_type: string;
  home_team: string;
  away_team: string;
  home_team_id: number;
  away_team_id: number;
  // Vegas lines
  vegas_home_spread: number | null;
  vegas_total: number | null;
  vegas_home_moneyline: number | null;
  vegas_away_moneyline: number | null;
  // Predictions
  pred_home_margin: number | null;
  pred_total_points: number | null;
  home_win_prob: number | null;
  away_win_prob: number | null;
  home_score_pred: number | null;
  away_score_pred: number | null;
  // Model fair values
  model_fair_home_spread: number | null;
  model_fair_away_spread: number | null;
  model_fair_home_moneyline: number | null;
  model_fair_away_moneyline: number | null;
  // Metadata
  model_version: string | null;
  as_of_ts_utc: string | null;
}

// Unified NBA Game Interface (for UI consumption)
export interface NBAGame {
  id: string; // game_id as string
  game_id: number;
  away_team: string;
  home_team: string;
  home_ml: number | null;
  away_ml: number | null; // Calculated from home_ml
  home_spread: number | null;
  away_spread: number | null; // Negative of home_spread
  over_line: number | null;
  game_date: string;
  game_time: string;
  training_key: string; // Use game_id as training_key
  unique_id: string; // Use game_id as unique_id
  // Team stats
  home_adj_offense: number | null;
  away_adj_offense: number | null;
  home_adj_defense: number | null;
  away_adj_defense: number | null;
  home_adj_pace: number | null;
  away_adj_pace: number | null;
  // Trends
  home_ats_pct: number | null;
  away_ats_pct: number | null;
  home_over_pct: number | null;
  away_over_pct: number | null;
  // Model predictions (when available)
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  run_id: string | null;
}

// Unified NCAAB Game Interface (for UI consumption)
export interface NCAABGame {
  id: string; // game_id as string
  game_id: number;
  away_team: string;
  home_team: string;
  home_ml: number | null;
  away_ml: number | null;
  home_spread: number | null;
  away_spread: number | null;
  over_line: number | null;
  game_date: string;
  game_time: string;
  training_key: string; // Use game_id as training_key
  unique_id: string; // Use game_id as unique_id
  // Team stats
  home_adj_offense: number | null;
  away_adj_offense: number | null;
  home_adj_defense: number | null;
  away_adj_defense: number | null;
  home_adj_pace: number | null;
  away_adj_pace: number | null;
  home_ranking: number | null;
  away_ranking: number | null;
  // Context
  conference_game: boolean | null;
  neutral_site: boolean | null;
  // Model predictions (when available)
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  pred_home_margin: number | null;
  pred_total_points: number | null;
  run_id: string | null;
}

// Calculate away moneyline from home moneyline
function calculateAwayML(homeML: number | null): number | null {
  if (homeML === null) return null;
  return homeML > 0 ? -(homeML + 100) : 100 - homeML;
}

// Fetch NBA games
export async function fetchNBAGames(): Promise<NBAGame[]> {
  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    console.log('🏀 Fetching NBA games for date:', today);
    
    // Fetch from nba_input_values_view
    const { data: inputValues, error: inputError } = await collegeFootballSupabase
      .from('nba_input_values_view')
      .select('*')
      .gte('game_date', today)
      .order('game_date', { ascending: true })
      .order('tipoff_time_et', { ascending: true });

    if (inputError) {
      console.error('❌ Error fetching NBA input values:', inputError);
      throw inputError;
    }
    
    console.log(`🏀 Found ${inputValues?.length || 0} NBA games`);
    if (!inputValues || inputValues.length === 0) return [];

    // Fetch latest run_id for predictions
    const { data: latestRun } = await collegeFootballSupabase
      .from('nba_predictions')
      .select('run_id, as_of_ts_utc')
      .order('as_of_ts_utc', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch predictions with latest run_id
    let predictionMap = new Map();
    if (latestRun) {
      const gameIds = inputValues.map(g => g.game_id);
      const { data: predictions } = await collegeFootballSupabase
        .from('nba_predictions')
        .select('game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread, run_id')
        .eq('run_id', latestRun.run_id)
        .in('game_id', gameIds);

      predictions?.forEach(pred => {
        predictionMap.set(pred.game_id, pred);
      });
    }

    // Merge input values with predictions
    const games: NBAGame[] = inputValues.map(input => {
      const prediction = predictionMap.get(input.game_id);
      const gameIdStr = String(input.game_id);
      
      // Calculate spread cover probability based on model's fair spread vs Vegas spread
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
      
      // Calculate over/under probability based on predicted total vs Vegas line
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
        home_ml: input.home_moneyline,
        away_ml: calculateAwayML(input.home_moneyline),
        home_spread: input.home_spread,
        away_spread: input.home_spread ? -input.home_spread : null,
        over_line: input.total_line,
        game_date: input.game_date,
        game_time: input.tipoff_time_et,
        training_key: gameIdStr,
        unique_id: gameIdStr,
        home_adj_offense: input.home_adj_offense,
        away_adj_offense: input.away_adj_offense,
        home_adj_defense: input.home_adj_defense,
        away_adj_defense: input.away_adj_defense,
        home_adj_pace: input.home_adj_pace,
        away_adj_pace: input.away_adj_pace,
        home_ats_pct: input.home_ats_pct,
        away_ats_pct: input.away_ats_pct,
        home_over_pct: input.home_over_pct,
        away_over_pct: input.away_over_pct,
        // Predictions - mapped from database fields
        home_away_ml_prob: prediction?.home_win_prob || null,
        home_away_spread_cover_prob: spreadCoverProb,
        ou_result_prob: ouProb,
        run_id: prediction?.run_id || null,
      };
    });

    return games;
  } catch (error) {
    console.error('Error fetching NBA games:', error);
    throw error;
  }
}

// Fetch NCAAB games
export async function fetchNCAABGames(): Promise<NCAABGame[]> {
  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    console.log('🏀 Fetching NCAAB games for date:', today);
    
    // Fetch from v_cbb_input_values
    const { data: inputValues, error: inputError } = await collegeFootballSupabase
      .from('v_cbb_input_values')
      .select('*')
      .gte('game_date_et', today)
      .order('game_date_et', { ascending: true })
      .order('tipoff_time_et', { ascending: true });

    if (inputError) {
      console.error('❌ Error fetching NCAAB input values:', inputError);
      throw inputError;
    }
    
    console.log(`🏀 Found ${inputValues?.length || 0} NCAAB games`);
    if (!inputValues || inputValues.length === 0) return [];

    // Get latest run_id for predictions
    const { data: latestRun } = await collegeFootballSupabase
      .from('ncaab_predictions')
      .select('run_id, as_of_ts_utc')
      .order('as_of_ts_utc', { ascending: false })
      .limit(1)
      .maybeSingle();

    let predictionMap = new Map();
    
    if (latestRun) {
      // Fetch predictions for all games with latest run_id
      const gameIds = inputValues.map(g => g.game_id);
      const { data: predictions } = await collegeFootballSupabase
        .from('ncaab_predictions')
        .select('*')
        .eq('run_id', latestRun.run_id)
        .in('game_id', gameIds);

      predictions?.forEach(pred => {
        predictionMap.set(pred.game_id, pred);
      });
    }

    // Merge input values with predictions
    const games: NCAABGame[] = inputValues.map(input => {
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
        // Predictions from ncaab_predictions
        home_away_ml_prob: prediction?.home_win_prob || null,
        home_away_spread_cover_prob: prediction?.home_win_prob || null, // Use home_win_prob as proxy
        ou_result_prob: prediction && prediction.pred_total_points && prediction.vegas_total
          ? (prediction.pred_total_points > prediction.vegas_total ? 0.6 : 0.4)
          : null,
        pred_home_margin: prediction?.pred_home_margin || null,
        pred_total_points: prediction?.pred_total_points || null,
        run_id: prediction?.run_id || null,
      };
    });

    return games;
  } catch (error) {
    console.error('Error fetching NCAAB games:', error);
    throw error;
  }
}

// Fetch NBA predictions separately (if needed)
export async function fetchNBAPredictions(runId?: string): Promise<NBAPrediction[]> {
  try {
    let query = collegeFootballSupabase
      .from('nba_predictions')
      .select('*');
    
    if (runId) {
      query = query.eq('run_id', runId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching NBA predictions:', error);
    return [];
  }
}

// Fetch NCAAB predictions separately (if needed)
export async function fetchNCAABPredictions(runId?: string): Promise<NCAABPrediction[]> {
  try {
    let query = collegeFootballSupabase
      .from('ncaab_predictions')
      .select('*');
    
    if (runId) {
      query = query.eq('run_id', runId);
    } else {
      // Get latest run_id
      const { data: latestRun } = await collegeFootballSupabase
        .from('ncaab_predictions')
        .select('run_id')
        .order('as_of_ts_utc', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestRun) {
        query = query.eq('run_id', latestRun.run_id);
      }
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching NCAAB predictions:', error);
    return [];
  }
}

