// =============================================================================
// Agent Game Helpers — Shared Module
// Extracted from auto-generate-avatar-picks/index.ts to allow V2 workers
// to reuse game fetching, formatting, and helper functions without triggering
// V1's serve() side effect.
// =============================================================================

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { type GeneratedPick } from '../generate-avatar-picks/pickSchema.ts';

// =============================================================================
// Types
// =============================================================================

export interface GameFetchResult {
  games: unknown[];
  formattedGames: unknown[];
}

// =============================================================================
// Game Fetching — Top-Level Router
// =============================================================================

export async function fetchGamesForSport(
  cfbClient: SupabaseClient,
  mainClient: SupabaseClient,
  sport: string,
  targetDate: string
): Promise<GameFetchResult> {
  switch (sport) {
    case 'nfl':
      return fetchNFLGames(cfbClient, mainClient);
    case 'cfb':
      return fetchCFBGames(cfbClient, mainClient);
    case 'nba':
      return fetchNBAGames(cfbClient, mainClient, targetDate);
    case 'ncaab':
      return fetchNCAABGames(cfbClient, mainClient, targetDate);
    default:
      return { games: [], formattedGames: [] };
  }
}

// =============================================================================
// Sport-Specific Game Fetchers
// =============================================================================

async function fetchNFLGames(
  cfbClient: SupabaseClient,
  mainClient: SupabaseClient
): Promise<GameFetchResult> {
  const { data: latestRun } = await cfbClient
    .from('nfl_predictions_epa')
    .select('run_id')
    .order('run_id', { ascending: false })
    .limit(1)
    .single();

  if (!latestRun) {
    return { games: [], formattedGames: [] };
  }

  const { data: games } = await cfbClient
    .from('nfl_predictions_epa')
    .select('*')
    .eq('run_id', latestRun.run_id);

  if (!games) {
    return { games: [], formattedGames: [] };
  }

  const [polymarketByGameKey, lineMovementByTrainingKey, h2hByGameKey] = await Promise.all([
    fetchPolymarketByGameKey(mainClient, 'nfl', games),
    fetchLineMovementByTrainingKey(cfbClient, 'nfl_betting_lines', games),
    fetchNFLH2HByGameKey(cfbClient, games),
  ]);

  const formattedGames = games.map(game =>
    formatNFLGame(
      game,
      polymarketByGameKey.get(toGameKey('nfl', game.away_team, game.home_team)) || null,
      lineMovementByTrainingKey.get(String(game.training_key || '')) || [],
      h2hByGameKey.get(toGameKey('nfl', game.away_team, game.home_team)) || []
    )
  );
  return { games, formattedGames };
}

async function fetchCFBGames(
  cfbClient: SupabaseClient,
  mainClient: SupabaseClient
): Promise<GameFetchResult> {
  const { data: games } = await cfbClient
    .from('cfb_live_weekly_inputs')
    .select('*');

  if (!games) {
    return { games: [], formattedGames: [] };
  }

  const [polymarketByGameKey, lineMovementByTrainingKey] = await Promise.all([
    fetchPolymarketByGameKey(mainClient, 'cfb', games),
    fetchLineMovementByTrainingKey(cfbClient, 'cfb_betting_lines', games),
  ]);

  const formattedGames = games.map(game =>
    formatCFBGame(
      game,
      polymarketByGameKey.get(toGameKey('cfb', game.away_team, game.home_team)) || null,
      lineMovementByTrainingKey.get(String(game.training_key || '')) || []
    )
  );
  return { games, formattedGames };
}

async function fetchNBAGames(
  cfbClient: SupabaseClient,
  mainClient: SupabaseClient,
  targetDate: string
): Promise<GameFetchResult> {
  const { data: games } = await cfbClient
    .from('nba_input_values_view')
    .select('*')
    .eq('game_date', targetDate);

  if (!games) {
    return { games: [], formattedGames: [] };
  }

  const [polymarketByGameKey, injuriesByTeam, accuracyByGameId, situationalByGameId] = await Promise.all([
    fetchPolymarketByGameKey(mainClient, 'nba', games),
    fetchNBAInjuriesByTeam(cfbClient, games, targetDate),
    fetchPredictionAccuracyByGameId(cfbClient, 'nba_todays_games_predictions_with_accuracy_cache', games, targetDate, true),
    fetchSituationalTrendsByGameId(cfbClient, 'nba_game_situational_trends_today', games),
  ]);

  const formattedGames = games.map(game =>
    formatNBAGame(
      game,
      polymarketByGameKey.get(toGameKey('nba', game.away_team, game.home_team)) || null,
      injuriesByTeam.get(normalizeTeamKey(game.away_team)) || [],
      injuriesByTeam.get(normalizeTeamKey(game.home_team)) || [],
      accuracyByGameId.get(String(game.game_id || '')) || null,
      situationalByGameId.get(String(game.game_id || '')) || null
    )
  );
  return { games, formattedGames };
}

async function fetchNCAABGames(
  cfbClient: SupabaseClient,
  mainClient: SupabaseClient,
  targetDate: string
): Promise<GameFetchResult> {
  const { data: games } = await cfbClient
    .from('v_cbb_input_values')
    .select('*')
    .eq('game_date_et', targetDate);

  if (!games) {
    return { games: [], formattedGames: [] };
  }

  const [polymarketByGameKey, trendsByGameId, accuracyByGameId] = await Promise.all([
    fetchPolymarketByGameKey(mainClient, 'ncaab', games),
    fetchSituationalTrendsByGameId(cfbClient, 'ncaab_game_situational_trends_today', games),
    fetchPredictionAccuracyByGameId(cfbClient, 'ncaab_todays_games_predictions_with_accuracy_cache', games, targetDate, false),
  ]);

  const formattedGames = games.map(game =>
    formatNCAABGame(
      game,
      polymarketByGameKey.get(toGameKey('ncaab', game.away_team, game.home_team)) || null,
      trendsByGameId.get(String(game.game_id || '')) || null,
      accuracyByGameId.get(String(game.game_id || '')) || null
    )
  );
  return { games, formattedGames };
}

// =============================================================================
// Enrichment Data Fetchers
// =============================================================================

async function fetchPolymarketByGameKey(
  mainClient: SupabaseClient,
  sport: string,
  games: Record<string, unknown>[]
): Promise<Map<string, Record<string, unknown> | null>> {
  const gameKeys = [...new Set(games.map(g => toGameKey(sport, g.away_team, g.home_team)))];
  const result = new Map<string, Record<string, unknown> | null>();
  if (gameKeys.length === 0) return result;

  try {
    const { data, error } = await mainClient
      .from('polymarket_markets')
      .select('*')
      .eq('league', sport)
      .in('game_key', gameKeys);

    if (error || !data) {
      console.warn(`[agentGameHelpers] Polymarket fetch failed for ${sport}:`, error?.message || 'No data');
      return result;
    }

    const grouped = new Map<string, Record<string, unknown>[]>();
    for (const row of data as Record<string, unknown>[]) {
      const key = String(row.game_key || '');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(row);
    }

    for (const key of gameKeys) {
      result.set(key, formatPolymarketMarkets(grouped.get(key) || []));
    }
  } catch (error) {
    console.warn(`[agentGameHelpers] Polymarket fetch threw for ${sport}:`, (error as Error).message);
  }

  return result;
}

async function fetchLineMovementByTrainingKey(
  cfbClient: SupabaseClient,
  tableName: string,
  games: Record<string, unknown>[]
): Promise<Map<string, Record<string, unknown>[]>> {
  const trainingKeys = [...new Set(games.map(g => String(g.training_key || '')).filter(Boolean))];
  const result = new Map<string, Record<string, unknown>[]>();
  if (trainingKeys.length === 0) return result;

  try {
    const { data, error } = await cfbClient
      .from(tableName)
      .select('training_key, as_of_ts, home_spread, away_spread, over_line')
      .in('training_key', trainingKeys)
      .order('as_of_ts', { ascending: true });

    if (error || !data) {
      console.warn(`[agentGameHelpers] Line movement fetch failed (${tableName}):`, error?.message || 'No data');
      return result;
    }

    for (const row of data as Record<string, unknown>[]) {
      const key = String(row.training_key || '');
      if (!result.has(key)) result.set(key, []);
      result.get(key)?.push(row);
    }
  } catch (error) {
    console.warn(`[agentGameHelpers] Line movement fetch threw (${tableName}):`, (error as Error).message);
  }

  return result;
}

async function fetchNFLH2HByGameKey(
  cfbClient: SupabaseClient,
  games: Record<string, unknown>[]
): Promise<Map<string, Record<string, unknown>[]>> {
  const result = new Map<string, Record<string, unknown>[]>();

  const h2hPromises = games.map(async (game) => {
    const away = String(game.away_team || '');
    const home = String(game.home_team || '');
    const key = toGameKey('nfl', away, home);

    try {
      const { data, error } = await cfbClient
        .from('nfl_training_data')
        .select('game_date, home_team, away_team, home_score, away_score, home_spread, away_spread, over_line')
        .or(`and(home_team.eq."${home}",away_team.eq."${away}"),and(home_team.eq."${away}",away_team.eq."${home}")`)
        .order('game_date', { ascending: false })
        .limit(5);

      if (!error && data) {
        result.set(key, data as Record<string, unknown>[]);
      }
    } catch (error) {
      console.warn(`[agentGameHelpers] NFL H2H fetch failed for ${away} @ ${home}:`, (error as Error).message);
    }
  });

  await Promise.all(h2hPromises);
  return result;
}

async function fetchNBAInjuriesByTeam(
  cfbClient: SupabaseClient,
  games: Record<string, unknown>[],
  targetDate: string
): Promise<Map<string, Record<string, unknown>[]>> {
  const teams = [...new Set(games.flatMap(g => [String(g.away_team || ''), String(g.home_team || '')]).filter(Boolean))];
  const result = new Map<string, Record<string, unknown>[]>();
  if (teams.length === 0) return result;

  try {
    const { data, error } = await cfbClient
      .from('nba_injury_report')
      .select('player_name, avg_pie_season, status, team_id, team_name, team_abbr, game_date_et, bucket')
      .in('team_name', teams)
      .eq('game_date_et', targetDate)
      .eq('bucket', 'current');

    if (error || !data) {
      console.warn('[agentGameHelpers] NBA injury fetch failed:', error?.message || 'No data');
      return result;
    }

    for (const row of data as Record<string, unknown>[]) {
      const teamKey = normalizeTeamKey(row.team_name);
      if (!result.has(teamKey)) result.set(teamKey, []);
      result.get(teamKey)?.push(row);
    }
  } catch (error) {
    console.warn('[agentGameHelpers] NBA injury fetch threw:', (error as Error).message);
  }

  return result;
}

async function fetchSituationalTrendsByGameId(
  cfbClient: SupabaseClient,
  tableName: string,
  games: Record<string, unknown>[]
): Promise<Map<string, Record<string, unknown>>> {
  const gameIds = [...new Set(games.map(g => String(g.game_id || '')).filter(Boolean))];
  const result = new Map<string, Record<string, unknown>>();
  if (gameIds.length === 0) return result;

  try {
    const { data, error } = await cfbClient
      .from(tableName)
      .select('*')
      .in('game_id', gameIds);

    if (error || !data) {
      return result;
    }

    for (const row of data as Record<string, unknown>[]) {
      const gameId = String(row.game_id || '');
      if (!gameId) continue;

      if (!result.has(gameId)) {
        result.set(gameId, { away_team: null, home_team: null });
      }
      const entry = result.get(gameId)!;
      const teamSide = String(row.team_side || '').toLowerCase();
      if (teamSide === 'away') {
        (entry as Record<string, unknown>).away_team = row;
      } else if (teamSide === 'home') {
        (entry as Record<string, unknown>).home_team = row;
      }
    }
  } catch {
    // Optional dataset; ignore if unavailable.
  }

  return result;
}

async function fetchPredictionAccuracyByGameId(
  cfbClient: SupabaseClient,
  tableName: string,
  games: Record<string, unknown>[],
  targetDate: string,
  applyGameDateFilter: boolean
): Promise<Map<string, Record<string, unknown>>> {
  const gameIds = [...new Set(games.map(g => String(g.game_id || '')).filter(Boolean))];
  const result = new Map<string, Record<string, unknown>>();
  if (gameIds.length === 0) return result;

  try {
    let query = cfbClient
      .from(tableName)
      .select('*')
      .in('game_id', gameIds);

    if (applyGameDateFilter) {
      query = query.eq('game_date', targetDate);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.warn(`[agentGameHelpers] ${tableName} fetch failed:`, error?.message || 'No data');
      return result;
    }

    for (const row of data as Record<string, unknown>[]) {
      const gameId = String(row.game_id || '');
      if (gameId) result.set(gameId, row);
    }
  } catch (error) {
    console.warn(`[agentGameHelpers] ${tableName} fetch threw:`, (error as Error).message);
  }

  return result;
}

// =============================================================================
// Game Formatting Functions
// =============================================================================

function formatNFLGame(
  game: Record<string, unknown>,
  polymarket: Record<string, unknown> | null,
  lineMovement: Record<string, unknown>[],
  h2hGames: Record<string, unknown>[]
): Record<string, unknown> {
  const gameId = game.training_key || `${game.away_team}_${game.home_team}`;
  const homeSpread = game.home_spread as number | null;
  const awaySpread = game.away_spread as number | null;

  return {
    game_id: gameId,
    matchup: `${game.away_team} @ ${game.home_team}`,
    away_team: game.away_team,
    home_team: game.home_team,
    game_date: game.game_date,
    game_time: game.game_time || '00:00:00',
    vegas_lines: {
      spread_summary: `${game.away_team} ${fmtSpread(awaySpread)} / ${game.home_team} ${fmtSpread(homeSpread)}`,
      ml_summary: `${game.away_team} ${fmtML(game.away_ml) ?? 'N/A'} / ${game.home_team} ${fmtML(game.home_ml) ?? 'N/A'}`,
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: fmtML(game.home_ml),
      away_ml: fmtML(game.away_ml),
      total: game.over_line,
    },
    weather: {
      temperature: game.temperature,
      wind_speed: game.wind_speed,
      precipitation: game.precipitation,
      icon: game.icon,
    },
    public_betting: {
      spread_split: game.spread_splits_label,
      ml_split: game.ml_splits_label,
      total_split: game.total_splits_label,
    },
    public_betting_detailed: {
      home_ml_handle: game.home_ml_handle,
      away_ml_handle: game.away_ml_handle,
      home_ml_bets: game.home_ml_bets,
      away_ml_bets: game.away_ml_bets,
      home_spread_handle: game.home_spread_handle,
      away_spread_handle: game.away_spread_handle,
      home_spread_bets: game.home_spread_bets,
      away_spread_bets: game.away_spread_bets,
      over_handle: game.over_handle,
      under_handle: game.under_handle,
      over_bets: game.over_bets,
      under_bets: game.under_bets,
    },
    line_movement: lineMovement,
    h2h_recent: h2hGames,
    polymarket,
    model_predictions: {
      spread_cover_prob: game.home_away_spread_cover_prob,
      ml_prob: game.home_away_ml_prob,
      ou_prob: game.ou_result_prob,
      predicted_team: Number(game.home_away_spread_cover_prob || 0) > 0.5 ? game.home_team : game.away_team,
    },
    game_data_complete: {
      source_table: 'nfl_predictions_epa',
      raw_game_data: game,
    },
  };
}

function formatCFBGame(
  game: Record<string, unknown>,
  polymarket: Record<string, unknown> | null,
  lineMovement: Record<string, unknown>[]
): Record<string, unknown> {
  const gameId = game.training_key || game.unique_id || `${game.away_team}_${game.home_team}`;
  const spreadProb = game.pred_spread_proba || game.home_away_spread_cover_prob;
  const homeSpread = (game.api_spread || game.home_spread) as number | null;
  const awaySpread = game.api_spread ? -(game.api_spread as number) : game.away_spread as number | null;

  return {
    game_id: gameId,
    matchup: `${game.away_team} @ ${game.home_team}`,
    away_team: game.away_team,
    home_team: game.home_team,
    game_date: game.game_date || game.start_date,
    game_time: game.game_time || game.start_time || '00:00:00',
    vegas_lines: {
      spread_summary: `${game.away_team} ${fmtSpread(awaySpread)} / ${game.home_team} ${fmtSpread(homeSpread)}`,
      ml_summary: `${game.away_team} ${fmtML(game.away_moneyline || game.away_ml) ?? 'N/A'} / ${game.home_team} ${fmtML(game.home_moneyline || game.home_ml) ?? 'N/A'}`,
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: fmtML(game.home_moneyline || game.home_ml),
      away_ml: fmtML(game.away_moneyline || game.away_ml),
      total: game.api_over_line || game.total_line,
    },
    weather: {
      temperature: game.weather_temp_f || game.temperature,
      wind_speed: game.weather_windspeed_mph || game.wind_speed,
      precipitation: game.precipitation,
      icon: game.weather_icon_text || game.icon_code,
    },
    public_betting: {
      spread_split: game.spread_splits_label,
      ml_split: game.ml_splits_label,
      total_split: game.total_splits_label,
    },
    line_movement: lineMovement,
    opening_lines: {
      opening_spread: game.opening_spread,
      opening_total: game.opening_total,
    },
    polymarket,
    model_predictions: {
      spread_cover_prob: spreadProb,
      ml_prob: game.pred_ml_proba || game.home_away_ml_prob,
      ou_prob: game.pred_total_proba || game.ou_result_prob,
      predicted_team: Number(spreadProb || 0) > 0.5 ? game.home_team : game.away_team,
    },
    game_data_complete: {
      source_table: 'cfb_live_weekly_inputs',
      raw_game_data: game,
    },
  };
}

function formatNBAGame(
  game: Record<string, unknown>,
  polymarket: Record<string, unknown> | null,
  awayInjuries: Record<string, unknown>[],
  homeInjuries: Record<string, unknown>[],
  predictionAccuracy: Record<string, unknown> | null,
  situationalTrends: Record<string, unknown> | null = null
): Record<string, unknown> {
  const gameId = String(game.game_id);
  const homeML = game.home_moneyline as number | null;
  let awayML = null;
  if (homeML) {
    awayML = homeML > 0 ? -(homeML + 100) : 100 - homeML;
  }
  const homeSpread = game.home_spread as number | null;
  const awaySpread = homeSpread !== null && homeSpread !== undefined ? -homeSpread : null;

  return {
    game_id: gameId,
    matchup: `${game.away_team} @ ${game.home_team}`,
    away_team: game.away_team,
    home_team: game.home_team,
    game_date: game.game_date,
    game_time: game.tipoff_time_et,
    vegas_lines: {
      spread_summary: `${game.away_team} ${fmtSpread(awaySpread)} / ${game.home_team} ${fmtSpread(homeSpread)}`,
      ml_summary: `${game.away_team} ${fmtML(awayML) ?? 'N/A'} / ${game.home_team} ${fmtML(homeML) ?? 'N/A'}`,
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: fmtML(homeML),
      away_ml: fmtML(awayML),
      total: game.total_line,
    },
    team_stats: {
      home_pace: game.home_adj_pace ?? game.home_adj_pace_pregame,
      away_pace: game.away_adj_pace ?? game.away_adj_pace_pregame,
      home_offense: game.home_adj_offense ?? game.home_adj_off_rtg_pregame,
      away_offense: game.away_adj_offense ?? game.away_adj_off_rtg_pregame,
      home_defense: game.home_adj_defense ?? game.home_adj_def_rtg_pregame,
      away_defense: game.away_adj_defense ?? game.away_adj_def_rtg_pregame,
    },
    trends: {
      home_ats_pct: game.home_ats_pct,
      away_ats_pct: game.away_ats_pct,
      home_over_pct: game.home_over_pct,
      away_over_pct: game.away_over_pct,
    },
    injuries: {
      away_team: awayInjuries,
      home_team: homeInjuries,
    },
    situational_trends: filterSituationalTrends(situationalTrends),
    prediction_accuracy: predictionAccuracy,
    polymarket,
    game_data_complete: {
      source_table: 'nba_input_values_view',
      raw_game_data: filterNBARawGame(game),
    },
  };
}

function formatNCAABGame(
  game: Record<string, unknown>,
  polymarket: Record<string, unknown> | null,
  situationalTrends: Record<string, unknown> | null,
  predictionAccuracy: Record<string, unknown> | null
): Record<string, unknown> {
  const gameId = String(game.game_id);
  const homeSpread = game.spread as number | null;
  const awaySpread = homeSpread !== null && homeSpread !== undefined ? -homeSpread : null;

  return {
    game_id: gameId,
    matchup: `${game.away_team} @ ${game.home_team}`,
    away_team: game.away_team,
    home_team: game.home_team,
    game_date: game.game_date_et,
    game_time: game.start_utc || game.tipoff_time_et,
    conference_game: game.conference_game,
    neutral_site: game.neutral_site,
    vegas_lines: {
      spread_summary: `${game.away_team} ${fmtSpread(awaySpread)} / ${game.home_team} ${fmtSpread(homeSpread)}`,
      ml_summary: `${game.away_team} ${fmtML(game.awayMoneyline) ?? 'N/A'} / ${game.home_team} ${fmtML(game.homeMoneyline) ?? 'N/A'}`,
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: fmtML(game.homeMoneyline),
      away_ml: fmtML(game.awayMoneyline),
      total: game.over_under,
    },
    team_stats: {
      home_pace: game.home_adj_pace,
      away_pace: game.away_adj_pace,
      home_offense: game.home_adj_offense,
      away_offense: game.away_adj_offense,
      home_defense: game.home_adj_defense,
      away_defense: game.away_adj_defense,
      home_ranking: game.home_ranking,
      away_ranking: game.away_ranking,
    },
    situational_trends: filterSituationalTrends(situationalTrends),
    prediction_accuracy: predictionAccuracy,
    polymarket,
    game_data_complete: {
      source_table: 'v_cbb_input_values',
      raw_game_data: filterNCAABRawGame(game),
    },
  };
}

// =============================================================================
// Formatting Utilities
// =============================================================================

function fmtSpread(val: unknown): string {
  if (val === null || val === undefined) return 'N/A';
  const n = Number(val);
  if (isNaN(n)) return 'N/A';
  return n > 0 ? `+${n}` : String(n);
}

function fmtML(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  if (isNaN(n)) return null;
  return n > 0 ? `+${n}` : String(n);
}

function formatPolymarketMarkets(markets: Record<string, unknown>[]): Record<string, unknown> | null {
  if (!markets.length) return null;
  const polymarket: Record<string, unknown> = {};

  for (const market of markets) {
    const marketType = String(market.market_type || '');
    const awayOdds = market.current_away_odds;
    const homeOdds = market.current_home_odds;
    if (!marketType) continue;

    if (marketType === 'total') {
      polymarket.total = {
        over_odds: awayOdds,
        under_odds: homeOdds,
        updated_at: market.last_updated || null,
      };
      continue;
    }

    polymarket[marketType] = {
      away_odds: awayOdds,
      home_odds: homeOdds,
      updated_at: market.last_updated || null,
    };
  }

  return Object.keys(polymarket).length > 0 ? polymarket : null;
}

function toGameKey(sport: string, awayTeam: unknown, homeTeam: unknown): string {
  return `${sport}_${String(awayTeam || '').trim()}_${String(homeTeam || '').trim()}`;
}

function normalizeTeamKey(team: unknown): string {
  return String(team || '').trim().toLowerCase();
}

// =============================================================================
// Data Filters
// =============================================================================

const NBA_RAW_EXCLUDE = new Set([
  'away_last_ml', 'away_last_ou', 'home_last_ml', 'home_last_ou',
  'away_last_ats', 'home_last_ats',
  'away_ats_streak', 'away_win_streak', 'home_ats_streak', 'home_win_streak',
  'home_last_margin',
]);

function filterNBARawGame(game: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(game).filter(([key]) => !NBA_RAW_EXCLUDE.has(key) && !key.includes('_pregame'))
  );
}

const NCAAB_RAW_EXCLUDE = new Set([
  'away_adj_pace', 'home_adj_pace',
  'away_adj_margin', 'home_adj_margin',
  'away_adj_defense', 'away_adj_offense', 'home_adj_defense', 'home_adj_offense',
  'away_ws_prev_all_z', 'away_ws_prev_ret_z', 'home_ws_prev_all_z', 'home_ws_prev_ret_z',
  'away_roster_count_z', 'home_roster_count_z',
  'away_continuity_index', 'away_experience_index', 'home_continuity_index', 'home_experience_index',
  'away_adj_pace_trend_l3', 'home_adj_pace_trend_l3',
  'away_adj_defense_trend_l3', 'away_adj_offense_trend_l3',
  'home_adj_defense_trend_l3', 'home_adj_offense_trend_l3',
]);

function filterNCAABRawGame(game: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(game).filter(([key]) => !NCAAB_RAW_EXCLUDE.has(key))
  );
}

function filterSituationalTrends(trends: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!trends) return null;
  const filtered: Record<string, unknown> = {};
  for (const [side, data] of Object.entries(trends)) {
    if (data && typeof data === 'object') {
      filtered[side] = Object.fromEntries(
        Object.entries(data as Record<string, unknown>).filter(([key]) => !key.endsWith('_record'))
      );
    } else {
      filtered[side] = data;
    }
  }
  return filtered;
}

// =============================================================================
// OpenAI Response Extraction
// =============================================================================

export function extractAssistantContent(openaiData: Record<string, unknown>): string | null {
  // Check for output_text shortcut first (OpenAI Responses API)
  const outputText = openaiData.output_text;
  if (typeof outputText === 'string' && outputText.trim().length > 0) {
    return outputText.trim();
  }

  // Check for Chat Completions API format
  const choices = openaiData.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>;
    const message = (first.message || {}) as Record<string, unknown>;
    const content = message.content;

    if (typeof content === 'string' && content.trim().length > 0) {
      return content;
    }

    if (Array.isArray(content)) {
      const joined = content
        .map((part) => {
          if (!part || typeof part !== 'object') return '';
          const p = part as Record<string, unknown>;
          if (p.json && typeof p.json === 'object') return JSON.stringify(p.json);
          if (typeof p.text === 'string') return p.text;
          if (typeof p.content === 'string') return p.content;
          return '';
        })
        .join('\n')
        .trim();
      if (joined.length > 0) return joined;
    }
  }

  // Check for Responses API output array
  const output = openaiData.output;
  if (Array.isArray(output)) {
    const joined = output
      .map((item) => {
        if (!item || typeof item !== 'object') return '';
        const outputItem = item as Record<string, unknown>;
        const outputContent = outputItem.content;
        if (!Array.isArray(outputContent)) return '';
        return outputContent
          .map((part) => {
            if (!part || typeof part !== 'object') return '';
            const p = part as Record<string, unknown>;
            if (p.json && typeof p.json === 'object') return JSON.stringify(p.json);
            if (typeof p.text === 'string') return p.text;
            if (typeof p.content === 'string') return p.content;
            return '';
          })
          .filter(Boolean)
          .join('\n');
      })
      .filter(Boolean)
      .join('\n')
      .trim();
    if (joined.length > 0) return joined;
  }

  return null;
}

// =============================================================================
// Game Matching Helpers
// =============================================================================

export function gameMatchesPickId(game: unknown, pickGameId: string): boolean {
  const g = game as Record<string, unknown>;
  const normalizedPickId = String(pickGameId || '').trim();
  const gameId =
    g.game_id ||
    g.training_key ||
    g.unique_id ||
    `${String(g.away_team || '').trim()}_${String(g.home_team || '').trim()}`;

  return String(gameId || '').trim() === normalizedPickId;
}

export function gameMatchesRawGame(formattedGame: unknown, rawGame: Record<string, unknown>): boolean {
  const fg = formattedGame as Record<string, unknown>;
  const rawAway = String(rawGame.away_team || '').trim().toLowerCase();
  const rawHome = String(rawGame.home_team || '').trim().toLowerCase();
  const fgAway = String(fg.away_team || '').trim().toLowerCase();
  const fgHome = String(fg.home_team || '').trim().toLowerCase();

  if (rawAway && rawHome && fgAway === rawAway && fgHome === rawHome) {
    return true;
  }

  const rawTrainingKey = String(rawGame.training_key || '');
  const rawUniqueId = String(rawGame.unique_id || '');
  const fgTrainingKey = String(fg.training_key || '');
  const fgUniqueId = String(fg.unique_id || '');

  return (
    (rawTrainingKey && fgTrainingKey && rawTrainingKey === fgTrainingKey) ||
    (rawUniqueId && fgUniqueId && rawUniqueId === fgUniqueId)
  );
}

// =============================================================================
// Game Snapshot Helpers
// =============================================================================

export function ensureFormattedGameSnapshot(
  snapshot: Record<string, unknown>,
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab',
  fallbackGameId: string
): Record<string, unknown> {
  if (isFormattedGameSnapshot(snapshot)) return snapshot;

  const homeSpread = asNumber(snapshot.home_spread) ?? asNumber(snapshot.api_spread) ?? asNumber(snapshot.spread);
  const awaySpread = asNumber(snapshot.away_spread) ?? (homeSpread !== null ? -homeSpread : null);
  const awayTeam = String(snapshot.away_team || 'Away');
  const homeTeam = String(snapshot.home_team || 'Home');
  const spreadSummary =
    homeSpread !== null
      ? `${awayTeam} ${fmtSpread(awaySpread)} / ${homeTeam} ${fmtSpread(homeSpread)}`
      : `${awayTeam} vs ${homeTeam}`;

  const spreadProb =
    asNumber(snapshot.home_away_spread_cover_prob) ??
    asNumber(snapshot.pred_spread_proba) ??
    null;

  return {
    game_id: String(snapshot.game_id || snapshot.training_key || snapshot.unique_id || fallbackGameId),
    matchup: `${awayTeam} @ ${homeTeam}`,
    away_team: awayTeam,
    home_team: homeTeam,
    game_date: String(snapshot.game_date || snapshot.game_date_et || snapshot.start_date || ''),
    game_time: String(snapshot.game_time || snapshot.tipoff_time_et || snapshot.start_utc || '00:00:00'),
    vegas_lines: {
      spread_summary: spreadSummary,
      ml_summary: `${awayTeam} ${fmtML(snapshot.away_ml ?? snapshot.away_moneyline ?? snapshot.awayMoneyline) ?? 'N/A'} / ${homeTeam} ${fmtML(snapshot.home_ml ?? snapshot.home_moneyline ?? snapshot.homeMoneyline) ?? 'N/A'}`,
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: fmtML(snapshot.home_ml ?? snapshot.home_moneyline ?? snapshot.homeMoneyline),
      away_ml: fmtML(snapshot.away_ml ?? snapshot.away_moneyline ?? snapshot.awayMoneyline),
      total: snapshot.over_line ?? snapshot.total_line ?? snapshot.over_under ?? null,
    },
    model_predictions: {
      spread_cover_prob: spreadProb,
      ml_prob: snapshot.home_away_ml_prob ?? snapshot.pred_ml_proba ?? null,
      ou_prob: snapshot.ou_result_prob ?? snapshot.pred_total_proba ?? null,
    },
    game_data_complete: {
      source_table: `raw_fallback_${sport}`,
      raw_game_data: snapshot,
    },
  };
}

function isFormattedGameSnapshot(snapshot: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(snapshot, 'vegas_lines') ||
    Object.prototype.hasOwnProperty.call(snapshot, 'model_predictions') ||
    Object.prototype.hasOwnProperty.call(snapshot, 'game_data_complete')
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

// =============================================================================
// Decision Trace Normalization
// =============================================================================

export function normalizeDecisionTrace(
  pick: GeneratedPick,
  gameSnapshot: Record<string, unknown>,
  personality: Record<string, unknown>
): Record<string, unknown> {
  const raw = (pick as unknown as { decision_trace?: unknown }).decision_trace;

  let leanedMetrics = normalizeLeanedMetrics(raw);
  if (leanedMetrics.length === 0) {
    leanedMetrics = deriveLeanedMetricsFromGameSnapshot(pick, gameSnapshot);
  }
  if (leanedMetrics.length === 0) {
    leanedMetrics = (pick.key_factors || []).slice(0, 5).map((factor, idx) => ({
      metric_key: `key_factor_${idx + 1}`,
      metric_value: factor,
      why_it_mattered: factor,
      personality_trait: 'General model preference',
    }));
  }

  const rationaleSummary = normalizeTraceString(
    raw,
    ['rationale_summary', 'rationaleSummary', 'summary', 'reasoning_summary'],
    pick.reasoning
  );
  const personalityAlignment = normalizeTraceString(
    raw,
    ['personality_alignment', 'personalityAlignment', 'alignment'],
    buildPersonalityAlignmentFromSettings(personality, pick.bet_type)
  );
  const otherMetrics = normalizeTraceStringArray(raw, [
    'other_metrics_considered',
    'otherMetricsConsidered',
    'secondary_metrics',
  ]);

  return {
    leaned_metrics: leanedMetrics,
    rationale_summary: rationaleSummary,
    personality_alignment: personalityAlignment,
    other_metrics_considered: otherMetrics,
  };
}

function normalizeLeanedMetrics(rawTrace: unknown): Array<Record<string, unknown>> {
  if (!rawTrace || typeof rawTrace !== 'object') return [];
  const trace = rawTrace as Record<string, unknown>;
  const candidates =
    (trace.leaned_metrics as unknown[]) ||
    (trace.leanedMetrics as unknown[]) ||
    (trace.metrics_used as unknown[]) ||
    [];

  if (!Array.isArray(candidates)) return [];

  return candidates
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const m = entry as Record<string, unknown>;
      const metricKey = String(m.metric_key ?? m.metricKey ?? m.key ?? m.name ?? '').trim();
      const metricValue = String(m.metric_value ?? m.metricValue ?? m.value ?? '').trim();
      const whyItMattered = String(m.why_it_mattered ?? m.whyItMattered ?? m.why ?? m.reason ?? '').trim();
      const personalityTrait = String(m.personality_trait ?? m.personalityTrait ?? m.trait ?? '').trim();
      const weightRaw = m.weight;
      const weight = typeof weightRaw === 'number' ? weightRaw : undefined;

      if (!metricKey || !metricValue || !whyItMattered) return null;
      return {
        metric_key: metricKey,
        metric_value: metricValue,
        why_it_mattered: whyItMattered,
        personality_trait: personalityTrait || 'Model preference',
        ...(weight !== undefined ? { weight } : {}),
      };
    })
    .filter((v): v is Record<string, unknown> => !!v);
}

function normalizeTraceString(
  rawTrace: unknown,
  keys: string[],
  fallback: string
): string {
  if (rawTrace && typeof rawTrace === 'object') {
    const trace = rawTrace as Record<string, unknown>;
    for (const key of keys) {
      const value = trace[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
  }
  return fallback;
}

function normalizeTraceStringArray(rawTrace: unknown, keys: string[]): string[] {
  if (!rawTrace || typeof rawTrace !== 'object') return [];
  const trace = rawTrace as Record<string, unknown>;
  for (const key of keys) {
    const value = trace[key];
    if (Array.isArray(value)) {
      return value
        .map(v => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean)
        .slice(0, 12);
    }
  }
  return [];
}

function buildPersonalityAlignmentFromSettings(
  personality: Record<string, unknown>,
  betType: string
): string {
  const preferredBetType = String(personality.preferred_bet_type || 'any');
  const riskTolerance = Number(personality.risk_tolerance || 3);
  const confidenceThreshold = Number(personality.confidence_threshold || 3);
  const trustModel = Number(personality.trust_model || 3);
  const trustPolymarket = Number(personality.trust_polymarket || 3);
  const skipWeakSlates = Boolean(personality.skip_weak_slates);
  return `Aligned with profile: selected a ${betType} angle with preferred_bet_type=${preferredBetType}, risk_tolerance=${riskTolerance}/5, confidence_threshold=${confidenceThreshold}/5, trust_model=${trustModel}/5, trust_polymarket=${trustPolymarket}/5, skip_weak_slates=${skipWeakSlates}.`;
}

function deriveLeanedMetricsFromGameSnapshot(
  pick: GeneratedPick,
  gameSnapshot: Record<string, unknown>
): Array<Record<string, unknown>> {
  const metrics: Array<Record<string, unknown>> = [];
  const vegas = asRecord(gameSnapshot.vegas_lines);
  const teamStats = asRecord(gameSnapshot.team_stats);
  const model = asRecord(gameSnapshot.model_predictions);
  const raw = asRecord(asRecord(gameSnapshot.game_data_complete).raw_game_data);
  const awayTeam = String(gameSnapshot.away_team || raw.away_team || 'Away');
  const homeTeam = String(gameSnapshot.home_team || raw.home_team || 'Home');

  const homeSpread = asNumber(vegas.home_spread) ?? asNumber(raw.home_spread) ?? asNumber(raw.api_spread) ?? asNumber(raw.spread);
  if (homeSpread !== null) {
    metrics.push({
      metric_key: 'vegas_lines.home_spread',
      metric_value: String(homeSpread),
      why_it_mattered: `The spread baseline was ${homeTeam} ${fmtSpread(homeSpread)} / ${awayTeam} ${fmtSpread(-homeSpread)}.`,
      personality_trait: 'Preferred market pricing context',
    });
  }

  const homeOff = asNumber(teamStats.home_offense) ?? asNumber(raw.home_adj_offense);
  const awayOff = asNumber(teamStats.away_offense) ?? asNumber(raw.away_adj_offense);
  if (homeOff !== null && awayOff !== null) {
    metrics.push({
      metric_key: 'team_stats.offense_delta',
      metric_value: `${homeTeam} ${homeOff.toFixed(2)} vs ${awayTeam} ${awayOff.toFixed(2)}`,
      why_it_mattered: 'Relative offensive efficiency shaped expected scoring margin.',
      personality_trait: 'Model-driven team quality weighting',
    });
  }

  const homeDef = asNumber(teamStats.home_defense) ?? asNumber(raw.home_adj_defense);
  const awayDef = asNumber(teamStats.away_defense) ?? asNumber(raw.away_adj_defense);
  if (homeDef !== null && awayDef !== null) {
    metrics.push({
      metric_key: 'team_stats.defense_delta',
      metric_value: `${homeTeam} ${homeDef.toFixed(2)} vs ${awayTeam} ${awayDef.toFixed(2)}`,
      why_it_mattered: 'Defensive efficiency impacted expected cover probability and variance.',
      personality_trait: 'Risk-managed side selection',
    });
  }

  const spreadProb =
    asNumber(model.spread_cover_prob) ??
    asNumber(raw.home_away_spread_cover_prob) ??
    asNumber(raw.pred_spread_proba);
  if (spreadProb !== null) {
    metrics.push({
      metric_key: 'model_predictions.spread_cover_prob',
      metric_value: spreadProb.toFixed(3),
      why_it_mattered: 'Model cover probability was used as a primary confidence anchor.',
      personality_trait: 'trust_model',
      weight: 0.8,
    });
  }

  return metrics.slice(0, 8);
}
