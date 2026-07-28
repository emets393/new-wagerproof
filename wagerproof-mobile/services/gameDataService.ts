import { collegeFootballSupabase } from './supabase';
import { NFLPrediction } from '../types/nfl';
import { CFBPrediction } from '../types/cfb';
import { NBAGame } from '../types/nba';
import { NCAABGame } from '../types/ncaab';
import { MLBGame, normalizeTeamNameKey, fallbackAbbrevFromTeamName, combineSignalsOrdered } from '../types/mlb';
import type { MLBGameSignalsRow } from '../types/mlb';
import { getMLBFallbackTeamInfo } from '../constants/mlbTeams';
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
  league: 'nfl' | 'cfb' | 'nba' | 'ncaab' | 'mlb'
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
 * Fetch NFL predictions from nfl_dryrun_games (current week resolved dynamically).
 */
export async function fetchNFLPredictions(): Promise<NFLPrediction[]> {
  try {
    const grace = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    let { data: upcoming } = await collegeFootballSupabase
      .from('nfl_dryrun_games')
      .select('season, week')
      .gte('kickoff', grace)
      .order('kickoff', { ascending: true })
      .limit(1);
    if (!upcoming?.length) {
      const { data: latest } = await collegeFootballSupabase
        .from('nfl_dryrun_games')
        .select('season, week')
        .order('season', { ascending: false })
        .order('week', { ascending: false })
        .limit(1);
      upcoming = latest || [];
    }
    if (!upcoming?.length) return [];
    const { season, week } = upcoming[0];

    const { data, error } = await collegeFootballSupabase
      .from('nfl_dryrun_games')
      .select('*')
      .eq('season', season)
      .eq('week', week)
      .order('kickoff', { ascending: true });

    if (error) {
      console.error('Error fetching NFL predictions:', error);
      return [];
    }

    const merged = (data || []).map((r: any) => {
      const homeSpread = r.fg_spread_close ?? null;
      return {
        id: r.game_id,
        training_key: r.game_id,
        unique_id: r.game_id,
        home_team: r.home_team,
        away_team: r.away_team,
        home_away_ml_prob: r.fg_home_win_prob ?? null,
        home_away_spread_cover_prob: r.fg_home_cover_prob ?? null,
        ou_result_prob: null,
        game_date: r.gameday || (r.kickoff ? String(r.kickoff).slice(0, 10) : 'TBD'),
        game_time: r.kickoff || 'TBD',
        home_spread: homeSpread,
        away_spread: homeSpread !== null ? -Number(homeSpread) : null,
        over_line: r.fg_total_close ?? null,
        home_ml: r.fg_ml_home_close ?? null,
        away_ml: r.fg_ml_away_close ?? null,
        run_id: `nfl-dryrun-${season}-${week}`,
        temperature: r.wx_temp_f ?? null,
        precipitation: r.wx_precip_mm ?? null,
        wind_speed: r.wx_wind_mph ?? null,
        icon: r.wx_icon ?? null,
        spread_splits_label: null,
        total_splits_label: null,
        ml_splits_label: null,
      } as NFLPrediction;
    });

    console.log(`📊 Fetched ${merged.length} NFL predictions from nfl_dryrun_games (S${season} W${week})`);
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
    const grace = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    let { data: upcoming } = await collegeFootballSupabase
      .from('cfb_dryrun_games')
      .select('season, week')
      .gte('kickoff', grace)
      .order('kickoff', { ascending: true })
      .limit(1);
    if (!upcoming?.length) {
      const { data: latest } = await collegeFootballSupabase
        .from('cfb_dryrun_games')
        .select('season, week')
        .order('season', { ascending: false })
        .order('week', { ascending: false })
        .limit(1);
      upcoming = latest || [];
    }
    if (!upcoming?.length) return [];
    const { season, week } = upcoming[0];

    const { data, error } = await collegeFootballSupabase
      .from('cfb_dryrun_games')
      .select('*')
      .eq('season', season)
      .eq('week', week)
      .order('kickoff', { ascending: true });

    if (error) {
      console.error('Error fetching CFB predictions:', error);
      return [];
    }

    const predictions = (data || []).map((row: any) => {
      const predTotal = Number(row.fg_pred_total);
      const predMargin = Number(row.fg_pred_margin);
      const hasScore = Number.isFinite(predTotal) && Number.isFinite(predMargin);
      const homeSpread = row.fg_spread_close ?? null;
      return {
        id: row.game_id,
        home_team: row.home_team,
        away_team: row.away_team,
        pred_ml_proba: row.fg_home_win_prob ?? null,
        pred_spread_proba: row.fg_home_cover_prob ?? null,
        pred_total_proba: null,
        api_spread: homeSpread,
        api_over_line: row.fg_total_close ?? null,
        home_spread: homeSpread,
        away_spread: homeSpread !== null ? -Number(homeSpread) : null,
        home_spread_diff: row.fg_spread_edge ?? null,
        over_line_diff: row.fg_total_edge ?? null,
        pred_away_score: row.fg_pred_away_pts ?? (hasScore ? (predTotal - predMargin) / 2 : null),
        pred_home_score: row.fg_pred_home_pts ?? (hasScore ? (predTotal + predMargin) / 2 : null),
        start_time: row.kickoff,
        kickoff: row.kickoff,
      } as CFBPrediction;
    });

    console.log(`📊 Fetched ${predictions.length} CFB predictions from cfb_dryrun_games (S${season} W${week})`);
    return predictions;
  } catch (error) {
    console.error('Error in fetchCFBPredictions:', error);
    return [];
  }
}


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
        // Prefer the explicit away_moneyline column from nba_input_values_view;
        // fall back to the complement formula only if the DB value is missing.
        away_ml: input.away_moneyline
          ?? (input.home_moneyline !== null
            ? (input.home_moneyline > 0 ? -(input.home_moneyline + 100) : 100 - input.home_moneyline)
            : null),
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

    // Fetch team mappings for logos and abbreviations
    const { data: teamMappings } = await collegeFootballSupabase
      .from('ncaab_team_mapping')
      .select('api_team_id, espn_team_id, team_abbrev');

    const teamMappingMap = new Map<string, { logo: string | null; abbrev: string | null }>();
    if (teamMappings) {
      teamMappings.forEach((mapping: any) => {
        const key = String(mapping.api_team_id);
        let logoUrl: string | null = null;
        if (mapping.espn_team_id != null) {
          logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${mapping.espn_team_id}.png`;
        }
        teamMappingMap.set(key, { logo: logoUrl, abbrev: mapping.team_abbrev || null });
      });
    }

    // Merge input values with predictions and team mappings
    const games: NCAABGame[] = inputValues.map((input: any) => {
      const prediction = predictionMap.get(input.game_id);
      const gameIdStr = String(input.game_id);

      const homeMapping = input.home_team_id != null ? teamMappingMap.get(String(input.home_team_id)) : undefined;
      const awayMapping = input.away_team_id != null ? teamMappingMap.get(String(input.away_team_id)) : undefined;

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
        home_team_logo: homeMapping?.logo || null,
        away_team_logo: awayMapping?.logo || null,
        home_team_abbrev: homeMapping?.abbrev || null,
        away_team_abbrev: awayMapping?.abbrev || null,
      };
    });

    console.log(`📊 Fetched ${games.length} NCAAB predictions`);
    return games;
  } catch (error) {
    console.error('Error in fetchNCAABPredictions:', error);
    return [];
  }
}

/** Round to nearest 0.5 for spread/OU bucket key */
function roundToHalf(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v * 2) / 2;
}
/** Round to nearest 0.05 for ML bucket key */
function roundTo05(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v * 20) / 20;
}

/** Build edge-accuracy summary for one game for context string. bucketRows: { edge_type, bucket, accuracy_pct }[] */
function getEdgeAccuracySummary(
  game: { home_spread?: number | null; over_line?: number | null; model_fair_home_spread?: number | null; model_fair_total?: number | null; pred_total_points?: number | null; home_away_ml_prob?: number | null },
  bucketRows: { edge_type: string; bucket: number; accuracy_pct: number }[]
): string {
  if (!bucketRows?.length) return '';
  const map = new Map<string, number>();
  bucketRows.forEach((r: { edge_type: string; bucket: number; accuracy_pct: number }) => map.set(`${r.edge_type}|${r.bucket}`, r.accuracy_pct));
  const vegasSpread = game.home_spread ?? null;
  const modelSpread = game.model_fair_home_spread ?? null;
  const vegasTotal = game.over_line ?? null;
  const predTotal = game.model_fair_total ?? game.pred_total_points ?? null;
  const homeWin = game.home_away_ml_prob != null ? Number(game.home_away_ml_prob) : null;
  const awayWin = homeWin != null ? 1 - homeWin : null;
  const spreadDiff = vegasSpread != null && modelSpread != null ? vegasSpread - modelSpread : null;
  const ouDiff = vegasTotal != null && predTotal != null ? predTotal - vegasTotal : null;
  const spreadKey = roundToHalf(spreadDiff != null ? Math.abs(spreadDiff) : null);
  const ouKey = roundToHalf(ouDiff);
  const mlKey = homeWin != null && awayWin != null ? roundTo05(Math.max(homeWin, awayWin)) : null;
  const spreadAcc = spreadKey != null ? map.get(`SPREAD_EDGE|${spreadKey}`) : null;
  const ouAcc = ouKey != null ? map.get(`OU_EDGE|${ouKey}`) : null;
  const mlAcc = mlKey != null ? map.get(`MONEYLINE_PROB|${mlKey}`) : null;
  const parts: string[] = [];
  if (spreadAcc != null) parts.push(`Spread bucket accuracy: ${spreadAcc.toFixed(1)}%`);
  if (ouAcc != null) parts.push(`OU bucket accuracy: ${ouAcc.toFixed(1)}%`);
  if (mlAcc != null) parts.push(`ML bucket accuracy: ${mlAcc.toFixed(1)}%`);
  if (parts.length === 0) return '';
  return `**Model edge accuracy (use follow/fade by trust_model):** ${parts.join('; ')}`;
}

/** Format one team's situational trends for context */
function formatSituationalSlim(row: any): string {
  if (!row?.team_name) return 'N/A';
  const ats = row.ats_last_game_cover_pct != null ? `${row.ats_last_game_cover_pct.toFixed(0)}%` : '-';
  const ouOver = row.ou_last_game_over_pct != null ? `${row.ou_last_game_over_pct.toFixed(0)}%` : '-';
  const ouUnder = row.ou_last_game_under_pct != null ? `${row.ou_last_game_under_pct.toFixed(0)}%` : '-';
  return `Situation: ${row.last_game_situation || '-'}, ${row.fav_dog_situation || '-'}, rest: ${row.rest_bucket || '-'}. ATS cover in situation: ${ats}. Over: ${ouOver}, Under: ${ouUnder}.`;
}

/**
 * Format NBA predictions as markdown context for AI (includes edge accuracy and situational trends when provided)
 */
function formatNBAContext(
  predictions: NBAGame[],
  polymarketMap?: Map<string, PolymarketAllMarketsData | null>,
  edgeAccuracyRows?: { edge_type: string; bucket: number; accuracy_pct: number }[],
  situationalByGameId?: Map<number, { away_team: any; home_team: any }>
): string {
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

      let edgeAccuracySection = '';
      if (edgeAccuracyRows?.length && pred.game_id != null) {
        const summary = getEdgeAccuracySummary(pred, edgeAccuracyRows);
        if (summary) edgeAccuracySection = `\n${summary}`;
      }
      let situationalSection = '';
      const sit = pred.game_id != null ? situationalByGameId?.get(pred.game_id) : null;
      if (sit?.away_team || sit?.home_team) {
        situationalSection = `
**Situational trends (real data; always consider for ATS/O/U):**
- Away ${awayTeam}: ${formatSituationalSlim(sit.away_team)}
- Home ${homeTeam}: ${formatSituationalSlim(sit.home_team)}`;
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
${edgeAccuracySection}

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
${situationalSection}

---`;
    } catch (err) {
      console.error('Error building context for NBA game:', pred, err);
      return '';
    }
  }).filter(Boolean).join('\n');

  return `# 🏀 NBA Games Data

I have access to **${predictions.length} NBA games** with complete betting lines, model predictions, VALUE ANALYSIS (model vs. market differences), team stats (adjusted offense/defense/pace), betting trends (ATS%, Over%), edge accuracy by bucket when available, situational trends (ATS/O/U in current situation), and Polymarket prediction market data.

**REQUIRED:** When you recommend or explain any pick, you MUST cite **Model edge accuracy** (follow when >52%, consider fading when <50%) and **Situational trends** (each team's ATS/O/U in their current situation) when they appear below for that game. Do not ignore these sections.

**KEY INSIGHT:** The "VALUE ANALYSIS" section shows where the model's prediction differs from the betting line. Positive spread differences favor the home team, negative favor away. Positive total differences suggest betting OVER, negative suggest UNDER. Use edge accuracy and situational trends (real data; always consider) in your reasoning.

**POLYMARKET DATA:** Real money prediction market probabilities from Polymarket showing what bettors are wagering on moneyline, spread, and totals.

${contextParts}`;
}

/**
 * Format NCAAB predictions as markdown context for AI (includes edge accuracy and situational trends when provided)
 */
function formatNCAABContext(
  predictions: NCAABGame[],
  polymarketMap?: Map<string, PolymarketAllMarketsData | null>,
  edgeAccuracyRows?: { edge_type: string; bucket: number; accuracy_pct: number }[],
  situationalByGameId?: Map<number, { away_team: any; home_team: any }>
): string {
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
${((): string => {
  if (!edgeAccuracyRows?.length || pred.game_id == null) return '';
  const summary = getEdgeAccuracySummary(pred, edgeAccuracyRows);
  return summary ? `\n${summary}` : '';
})()}
${((): string => {
  const sit = pred.game_id != null ? situationalByGameId?.get(pred.game_id) : null;
  if (!sit?.away_team && !sit?.home_team) return '';
  return `
**Situational trends (real data; always consider for ATS/O/U):**
- Away ${awayTeam}: ${formatSituationalSlim(sit.away_team)}
- Home ${homeTeam}: ${formatSituationalSlim(sit.home_team)}`;
})()}

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

I have access to **${predictions.length} College Basketball games** with complete betting lines, model predictions, VALUE ANALYSIS (model vs. market differences), team stats (adjusted offense/defense/pace), rankings, game context (conference games, neutral site), edge accuracy by bucket when available, situational trends (ATS/O/U in current situation), and Polymarket prediction market data.

**REQUIRED:** When you recommend or explain any pick, you MUST cite **Model edge accuracy** (follow when >52%, consider fading when <50%) and **Situational trends** (each team's ATS/O/U in their current situation) when they appear below for that game. Do not ignore these sections.

**KEY INSIGHT:** The "VALUE ANALYSIS" section shows where the model's prediction differs from the betting line. Positive spread differences favor the home team, negative favor away. Positive total differences suggest betting OVER, negative suggest UNDER. Use edge accuracy and situational trends (real data; always consider) in your reasoning.

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

  // Fetch Polymarket data and NBA/NCAAB edge accuracy + situational trends in parallel
  console.log('📈 Fetching Polymarket data and NBA/NCAAB edge accuracy + situational trends...');
  const [
    nflPolymarket,
    cfbPolymarket,
    nbaPolymarket,
    ncaabPolymarket,
    nbaEdgeAccuracy,
    nbaSituationalRows,
    ncaabEdgeAccuracy,
    ncaabSituationalRows,
  ] = await Promise.all([
    fetchPolymarketDataForGames(nflPredictions, 'nfl'),
    fetchPolymarketDataForGames(cfbPredictions, 'cfb'),
    fetchPolymarketDataForGames(nbaPredictions, 'nba'),
    fetchPolymarketDataForGames(ncaabPredictions, 'ncaab'),
    collegeFootballSupabase.from('nba_edge_accuracy_by_bucket').select('edge_type,bucket,accuracy_pct').then(({ data }) => data || []),
    collegeFootballSupabase.from('nba_game_situational_trends_today').select('*').then(({ data }) => data || []),
    collegeFootballSupabase.from('ncaab_edge_accuracy_by_bucket').select('edge_type,bucket,accuracy_pct').then(({ data }) => data || []),
    collegeFootballSupabase.from('ncaab_game_situational_trends_today').select('*').then(({ data }) => data || []),
  ]);

  console.log(`📈 Fetched Polymarket data:`);
  console.log(`   - NFL: ${nflPolymarket.size} games`);
  console.log(`   - CFB: ${cfbPolymarket.size} games`);
  console.log(`   - NBA: ${nbaPolymarket.size} games`);
  console.log(`   - NCAAB: ${ncaabPolymarket.size} games`);
  console.log(`   - NBA edge accuracy: ${Array.isArray(nbaEdgeAccuracy) ? nbaEdgeAccuracy.length : 0} rows, situational: ${Array.isArray(nbaSituationalRows) ? nbaSituationalRows.length : 0} rows`);
  console.log(`   - NCAAB edge accuracy: ${Array.isArray(ncaabEdgeAccuracy) ? ncaabEdgeAccuracy.length : 0} rows, situational: ${Array.isArray(ncaabSituationalRows) ? ncaabSituationalRows.length : 0} rows`);

  const nbaSituationalByGameId = new Map<number, { away_team: any; home_team: any }>();
  (nbaSituationalRows || []).forEach((row: any) => {
    const gid = row.game_id;
    if (!nbaSituationalByGameId.has(gid)) nbaSituationalByGameId.set(gid, { away_team: null, home_team: null });
    const entry = nbaSituationalByGameId.get(gid)!;
    if (row.team_side === 'away') entry.away_team = row;
    else if (row.team_side === 'home') entry.home_team = row;
  });
  const ncaabSituationalByGameId = new Map<number, { away_team: any; home_team: any }>();
  (ncaabSituationalRows || []).forEach((row: any) => {
    const gid = row.game_id;
    if (!ncaabSituationalByGameId.has(gid)) ncaabSituationalByGameId.set(gid, { away_team: null, home_team: null });
    const entry = ncaabSituationalByGameId.get(gid)!;
    if (row.team_side === 'away') entry.away_team = row;
    else if (row.team_side === 'home') entry.home_team = row;
  });

  const nflContext = formatNFLContext(nflPredictions, nflPolymarket);
  const cfbContext = formatCFBContext(cfbPredictions, cfbPolymarket);
  const nbaContext = formatNBAContext(
    nbaPredictions,
    nbaPolymarket,
    Array.isArray(nbaEdgeAccuracy) ? nbaEdgeAccuracy : undefined,
    nbaSituationalByGameId.size > 0 ? nbaSituationalByGameId : undefined
  );
  const ncaabContext = formatNCAABContext(
    ncaabPredictions,
    ncaabPolymarket,
    Array.isArray(ncaabEdgeAccuracy) ? ncaabEdgeAccuracy : undefined,
    ncaabSituationalByGameId.size > 0 ? ncaabSituationalByGameId : undefined
  );

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

/**
 * Fetch MLB games for the current 3-day window.
 * Used by useGameLookup to find a game by game_pk and open the bottom sheet.
 */
export async function fetchMLBPredictions(): Promise<MLBGame[]> {
  const today = new Date();
  const dayAfterTomorrow = new Date();
  dayAfterTomorrow.setDate(today.getDate() + 2);
  const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const { data: games, error } = await collegeFootballSupabase
    .from('mlb_games_today')
    .select('*')
    .gte('official_date', toYMD(today))
    .lte('official_date', toYMD(dayAfterTomorrow))
    .order('official_date', { ascending: true })
    .order('game_time_et', { ascending: true });

  if (error || !games) return [];

  // Fetch signals
  const signalsMap = new Map<string, { game_signals: unknown; home_signals: unknown; away_signals: unknown }>();
  try {
    const { data: signalRows } = await collegeFootballSupabase
      .from('mlb_game_signals')
      .select('game_pk, home_signals, away_signals, game_signals');
    if (signalRows) {
      for (const row of signalRows) {
        const key = String(Math.trunc(Number(row.game_pk)));
        signalsMap.set(key, row as any);
      }
    }
  } catch (err) {
    console.warn('MLB signals fetch failed:', err);
  }

  return games.map((row: Record<string, unknown>): MLBGame => {
    const sigKey = String(Math.trunc(Number(row.game_pk)));
    const sigRow = signalsMap.get(sigKey);
    const signals = combineSignalsOrdered(sigRow as MLBGameSignalsRow | undefined);
    const awayName = String(row.away_team_name || '');
    const homeName = String(row.home_team_name || '');
    const awayFallback = getMLBFallbackTeamInfo(awayName);
    const homeFallback = getMLBFallbackTeamInfo(homeName);

    return {
      id: String(row.game_pk),
      game_pk: Number(row.game_pk),
      official_date: String(row.official_date || ''),
      game_time_et: row.game_time_et as string | null,
      away_team_name: awayName,
      home_team_name: homeName,
      away_team: row.away_team as string | null,
      home_team: row.home_team as string | null,
      away_team_full_name: row.away_team_full_name as string | null,
      home_team_full_name: row.home_team_full_name as string | null,
      away_team_id: row.away_team_id as number | null,
      home_team_id: row.home_team_id as number | null,
      away_abbr: awayFallback?.team || fallbackAbbrevFromTeamName(awayName),
      home_abbr: homeFallback?.team || fallbackAbbrevFromTeamName(homeName),
      away_logo_url: awayFallback?.logo_url || null,
      home_logo_url: homeFallback?.logo_url || null,
      status: row.status as string | null,
      is_postponed: row.is_postponed as boolean | null,
      is_completed: row.is_completed as boolean | null,
      is_active: row.is_active as boolean | null,
      away_ml: row.away_ml as number | null,
      home_ml: row.home_ml as number | null,
      away_spread: row.away_spread as number | null,
      home_spread: row.home_spread as number | null,
      total_line: row.total_line as number | null,
      ml_home_win_prob: row.ml_home_win_prob as number | null,
      ml_away_win_prob: row.ml_away_win_prob as number | null,
      home_implied_prob: row.home_implied_prob as number | null,
      away_implied_prob: row.away_implied_prob as number | null,
      home_ml_edge_pct: row.home_ml_edge_pct as number | null,
      away_ml_edge_pct: row.away_ml_edge_pct as number | null,
      home_ml_strong_signal: row.home_ml_strong_signal as boolean | null,
      away_ml_strong_signal: row.away_ml_strong_signal as boolean | null,
      ou_edge: row.ou_edge as number | null,
      ou_direction: row.ou_direction as 'OVER' | 'UNDER' | null,
      ou_fair_total: row.ou_fair_total as number | null,
      ou_strong_signal: row.ou_strong_signal as boolean | null,
      ou_moderate_signal: row.ou_moderate_signal as boolean | null,
      f5_home_ml: (row.f5_home_ml as number) ?? null,
      f5_away_ml: (row.f5_away_ml as number) ?? null,
      f5_fair_total: (row.f5_fair_total as number) ?? null,
      f5_pred_margin: (row.f5_pred_margin as number) ?? null,
      f5_total_line: (row.f5_total_line as number) ?? null,
      f5_home_spread: (row.f5_home_spread as number) ?? null,
      f5_away_spread: (row.f5_away_spread as number) ?? null,
      f5_ou_edge: (row.f5_ou_edge as number) ?? null,
      f5_home_win_prob: (row.f5_home_win_prob as number) ?? null,
      f5_away_win_prob: (row.f5_away_win_prob as number) ?? null,
      f5_home_implied_prob: (row.f5_home_implied_prob as number) ?? null,
      f5_away_implied_prob: (row.f5_away_implied_prob as number) ?? null,
      f5_home_ml_edge_pct: (row.f5_home_ml_edge_pct as number) ?? null,
      f5_away_ml_edge_pct: (row.f5_away_ml_edge_pct as number) ?? null,
      f5_home_ml_strong_signal: (row.f5_home_ml_strong_signal as boolean) ?? null,
      f5_away_ml_strong_signal: (row.f5_away_ml_strong_signal as boolean) ?? null,
      home_sp_name: row.home_sp_name as string | null,
      away_sp_name: row.away_sp_name as string | null,
      home_sp_confirmed: row.home_sp_confirmed as boolean | null,
      away_sp_confirmed: row.away_sp_confirmed as boolean | null,
      is_final_prediction: row.is_final_prediction as boolean | null,
      projection_label: row.projection_label as string | null,
      weather_confirmed: row.weather_confirmed as boolean | null,
      weather_imputed: row.weather_imputed as boolean | null,
      temperature_f: ((row as Record<string, unknown>).temperature_f as number | null) ?? null,
      wind_speed_mph: ((row as Record<string, unknown>).wind_speed_mph as number | null) ?? null,
      wind_direction: ((row as Record<string, unknown>).wind_direction as string | null) ?? null,
      sky: ((row as Record<string, unknown>).sky as string | null) ?? null,
      venue_name: (row as Record<string, unknown>).venue_name as string | null ?? null,
      signals,
    };
  });
}

