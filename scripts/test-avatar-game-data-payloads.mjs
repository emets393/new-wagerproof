#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const MAIN_URL = process.env.MAIN_SUPABASE_URL || 'https://gnjrklxotmbvnxbnnqgq.supabase.co';
const MAIN_ANON = process.env.MAIN_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ';
const CFB_URL = process.env.CFB_SUPABASE_URL || 'https://jpxnjuwglavsjbgbasnl.supabase.co';
const CFB_ANON = process.env.CFB_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo';

const DEFAULT_AVATAR_ID = 'c53c8a39-dfb1-47b9-86ce-5bb17f632a93';
const DEFAULT_OUT_DIR = 'tmp/live-payload-audit';

function parseArgs(argv) {
  const args = {
    avatarId: DEFAULT_AVATAR_ID,
    date: new Date().toISOString().slice(0, 10),
    outDir: DEFAULT_OUT_DIR,
    strictPolymarket: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--avatar-id') args.avatarId = argv[++i];
    else if (arg === '--date') args.date = argv[++i];
    else if (arg === '--out-dir') args.outDir = argv[++i];
    else if (arg === '--strict-polymarket') args.strictPolymarket = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/test-avatar-game-data-payloads.mjs [options]\n\nOptions:\n  --avatar-id <id>          Avatar profile id (default: ${DEFAULT_AVATAR_ID})\n  --date <YYYY-MM-DD>       Target game date in ET (default: today UTC date)\n  --out-dir <path>          Output directory (default: ${DEFAULT_OUT_DIR})\n  --strict-polymarket       Exit non-zero if any game has null polymarket\n  --help                    Show help`);
      process.exit(0);
    }
  }

  return args;
}

function headers(token) {
  return { apikey: token, Authorization: `Bearer ${token}` };
}

function fmtSpread(val) {
  if (val === null || val === undefined) return 'N/A';
  const n = Number(val);
  if (Number.isNaN(n)) return 'N/A';
  return n > 0 ? `+${n}` : String(n);
}

function toGameKey(sport, awayTeam, homeTeam) {
  return `${sport}_${String(awayTeam || '').trim()}_${String(homeTeam || '').trim()}`;
}

function normalizeTeamKey(team) {
  return String(team || '').trim().toLowerCase();
}

function formatPolymarketMarkets(markets) {
  if (!markets || markets.length === 0) return null;
  const polymarket = {};

  for (const market of markets) {
    const marketType = String(market.market_type || '');
    if (!marketType) continue;

    if (marketType === 'total') {
      polymarket.total = {
        over_odds: market.current_away_odds,
        under_odds: market.current_home_odds,
        updated_at: market.last_updated || null,
      };
    } else {
      polymarket[marketType] = {
        away_odds: market.current_away_odds,
        home_odds: market.current_home_odds,
        updated_at: market.last_updated || null,
      };
    }
  }

  return Object.keys(polymarket).length > 0 ? polymarket : null;
}

async function getJson(url, h) {
  const response = await fetch(url, { headers: h });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} for ${url}: ${body.slice(0, 300)}`);
  }
  return response.json();
}

async function safeGetJson(url, h) {
  try {
    return await getJson(url, h);
  } catch {
    return [];
  }
}

function enc(value) {
  return encodeURIComponent(String(value));
}

function formatNFLGame(game, polymarket, lineMovement, h2hGames) {
  const gameId = game.training_key || `${game.away_team}_${game.home_team}`;
  const homeSpread = game.home_spread;
  const awaySpread = game.away_spread;

  return {
    game_id: gameId,
    matchup: `${game.away_team} @ ${game.home_team}`,
    away_team: game.away_team,
    home_team: game.home_team,
    game_date: game.game_date,
    game_time: game.game_time || '00:00:00',
    vegas_lines: {
      spread_summary: `${game.away_team} ${fmtSpread(awaySpread)} / ${game.home_team} ${fmtSpread(homeSpread)}`,
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: game.home_ml,
      away_ml: game.away_ml,
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

function formatCFBGame(game, polymarket, lineMovement) {
  const gameId = game.training_key || game.unique_id || `${game.away_team}_${game.home_team}`;
  const spreadProb = game.pred_spread_proba || game.home_away_spread_cover_prob;
  const homeSpread = game.api_spread || game.home_spread;
  const awaySpread = game.api_spread ? -game.api_spread : game.away_spread;

  return {
    game_id: gameId,
    matchup: `${game.away_team} @ ${game.home_team}`,
    away_team: game.away_team,
    home_team: game.home_team,
    game_date: game.game_date || game.start_date,
    game_time: game.game_time || game.start_time || '00:00:00',
    vegas_lines: {
      spread_summary: `${game.away_team} ${fmtSpread(awaySpread)} / ${game.home_team} ${fmtSpread(homeSpread)}`,
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: game.home_moneyline || game.home_ml,
      away_ml: game.away_moneyline || game.away_ml,
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

function formatNBAGame(game, polymarket, awayInjuries, homeInjuries, predictionAccuracy) {
  const gameId = String(game.game_id);
  const homeML = game.home_moneyline;
  let awayML = null;
  if (homeML) awayML = homeML > 0 ? -(homeML + 100) : 100 - homeML;
  const homeSpread = game.home_spread;
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
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: homeML,
      away_ml: awayML,
      total: game.total_line,
    },
    team_stats: {
      home_pace: game.home_adj_pace,
      away_pace: game.away_adj_pace,
      home_offense: game.home_adj_offense,
      away_offense: game.away_adj_offense,
      home_defense: game.home_adj_defense,
      away_defense: game.away_adj_defense,
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
    prediction_accuracy: predictionAccuracy,
    polymarket,
    game_data_complete: {
      source_table: 'nba_input_values_view',
      raw_game_data: game,
    },
  };
}

function formatNCAABGame(game, polymarket, situationalTrends, predictionAccuracy) {
  const gameId = String(game.game_id);
  const homeSpread = game.spread;
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
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: game.homeMoneyline,
      away_ml: game.awayMoneyline,
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
    situational_trends: situationalTrends,
    prediction_accuracy: predictionAccuracy,
    polymarket,
    game_data_complete: {
      source_table: 'v_cbb_input_values',
      raw_game_data: game,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(args.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const mainHeaders = headers(MAIN_ANON);
  const cfbHeaders = headers(CFB_ANON);

  const [profile] = await getJson(`${MAIN_URL}/rest/v1/avatar_profiles?select=id,user_id,name,avatar_emoji,preferred_sports,personality_params,custom_insights,is_public,daily_generation_count,last_generation_date,last_generated_at,updated_at&id=eq.${enc(args.avatarId)}&limit=1`, mainHeaders);
  const [activePrompt] = await getJson(`${MAIN_URL}/rest/v1/agent_system_prompts?select=id,version,is_active,updated_at,prompt_text&is_active=eq.true&limit=1`, mainHeaders);

  if (!profile) {
    throw new Error(`Avatar profile not found for id=${args.avatarId}`);
  }

  const latestRun = await getJson(`${CFB_URL}/rest/v1/nfl_predictions_epa?select=run_id&order=run_id.desc&limit=1`, cfbHeaders);
  const runId = latestRun?.[0]?.run_id;

  const nflRaw = runId
    ? await getJson(`${CFB_URL}/rest/v1/nfl_predictions_epa?select=*&run_id=eq.${enc(runId)}`, cfbHeaders)
    : [];
  const cfbRaw = await getJson(`${CFB_URL}/rest/v1/cfb_live_weekly_inputs?select=*`, cfbHeaders);
  const nbaRaw = await getJson(`${CFB_URL}/rest/v1/nba_input_values_view?select=*&game_date=eq.${enc(args.date)}`, cfbHeaders);
  const ncaabRaw = await getJson(`${CFB_URL}/rest/v1/v_cbb_input_values?select=*&game_date_et=eq.${enc(args.date)}`, cfbHeaders);

  const allGameKeys = [
    ...nflRaw.map(g => toGameKey('nfl', g.away_team, g.home_team)),
    ...cfbRaw.map(g => toGameKey('cfb', g.away_team, g.home_team)),
    ...nbaRaw.map(g => toGameKey('nba', g.away_team, g.home_team)),
    ...ncaabRaw.map(g => toGameKey('ncaab', g.away_team, g.home_team)),
  ];

  const polymarketRows = allGameKeys.length
    ? await safeGetJson(`${MAIN_URL}/rest/v1/polymarket_markets?select=*&game_key=in.(${allGameKeys.map(enc).join(',')})`, mainHeaders)
    : [];

  const polymarketByGameKey = new Map();
  for (const row of polymarketRows) {
    const key = String(row.game_key || '');
    if (!polymarketByGameKey.has(key)) polymarketByGameKey.set(key, []);
    polymarketByGameKey.get(key).push(row);
  }

  const nflTrainingKeys = [...new Set(nflRaw.map(g => g.training_key).filter(Boolean))];
  const nflLineRows = nflTrainingKeys.length
    ? await safeGetJson(`${CFB_URL}/rest/v1/nfl_betting_lines?select=training_key,as_of_ts,home_spread,away_spread,over_line&training_key=in.(${nflTrainingKeys.map(enc).join(',')})&order=as_of_ts.asc`, cfbHeaders)
    : [];
  const nflLineByKey = new Map();
  for (const row of nflLineRows) {
    const key = String(row.training_key || '');
    if (!nflLineByKey.has(key)) nflLineByKey.set(key, []);
    nflLineByKey.get(key).push(row);
  }

  const cfbTrainingKeys = [...new Set(cfbRaw.map(g => g.training_key).filter(Boolean))];
  const cfbLineRows = cfbTrainingKeys.length
    ? await safeGetJson(`${CFB_URL}/rest/v1/cfb_betting_lines?select=training_key,as_of_ts,home_spread,away_spread,over_line&training_key=in.(${cfbTrainingKeys.map(enc).join(',')})&order=as_of_ts.asc`, cfbHeaders)
    : [];
  const cfbLineByKey = new Map();
  for (const row of cfbLineRows) {
    const key = String(row.training_key || '');
    if (!cfbLineByKey.has(key)) cfbLineByKey.set(key, []);
    cfbLineByKey.get(key).push(row);
  }

  const h2hByGameKey = new Map();
  await Promise.all(nflRaw.map(async (game) => {
    const key = toGameKey('nfl', game.away_team, game.home_team);
    const home = encodeURIComponent(game.home_team);
    const away = encodeURIComponent(game.away_team);
    const h2hRows = await safeGetJson(
      `${CFB_URL}/rest/v1/nfl_training_data?select=game_date,home_team,away_team,home_score,away_score,home_spread,away_spread,over_line&or=(and(home_team.eq.%22${home}%22,away_team.eq.%22${away}%22),and(home_team.eq.%22${away}%22,away_team.eq.%22${home}%22))&order=game_date.desc&limit=5`,
      cfbHeaders,
    );
    h2hByGameKey.set(key, h2hRows);
  }));

  const nbaTeams = [...new Set(nbaRaw.flatMap(g => [g.away_team, g.home_team]).filter(Boolean))];
  const nbaInjuries = nbaTeams.length
    ? await safeGetJson(`${CFB_URL}/rest/v1/nba_injury_report?select=player_name,avg_pie_season,status,team_id,team_name,team_abbr,game_date_et,bucket&game_date_et=eq.${enc(args.date)}&bucket=eq.current&team_name=in.(${nbaTeams.map(enc).join(',')})`, cfbHeaders)
    : [];
  const nbaInjuriesByTeam = new Map();
  for (const row of nbaInjuries) {
    const key = normalizeTeamKey(row.team_name);
    if (!nbaInjuriesByTeam.has(key)) nbaInjuriesByTeam.set(key, []);
    nbaInjuriesByTeam.get(key).push(row);
  }

  const ncaabGameIds = [...new Set(ncaabRaw.map(g => g.game_id).filter(Boolean))];
  const ncaabTrendsRows = ncaabGameIds.length
    ? await safeGetJson(`${CFB_URL}/rest/v1/ncaab_game_situational_trends_today?select=*&game_id=in.(${ncaabGameIds.map(enc).join(',')})`, cfbHeaders)
    : [];
  const ncaabTrendsById = new Map();
  for (const row of ncaabTrendsRows) {
    ncaabTrendsById.set(String(row.game_id), row);
  }

  const nbaAccuracyRows = nbaRaw.length
    ? await safeGetJson(
      `${CFB_URL}/rest/v1/nba_todays_games_predictions_with_accuracy_cache?select=*&game_date=eq.${enc(args.date)}&game_id=in.(${nbaRaw.map(g => enc(g.game_id)).join(',')})`,
      cfbHeaders,
    )
    : [];
  const nbaAccuracyById = new Map();
  for (const row of nbaAccuracyRows) {
    nbaAccuracyById.set(String(row.game_id), row);
  }

  const ncaabAccuracyRows = ncaabRaw.length
    ? await safeGetJson(
      `${CFB_URL}/rest/v1/ncaab_todays_games_predictions_with_accuracy_cache?select=*&game_id=in.(${ncaabRaw.map(g => enc(g.game_id)).join(',')})`,
      cfbHeaders,
    )
    : [];
  const ncaabAccuracyById = new Map();
  for (const row of ncaabAccuracyRows) {
    ncaabAccuracyById.set(String(row.game_id), row);
  }

  const combinedGames = [
    ...nflRaw.map(g => ({
      ...formatNFLGame(
        g,
        formatPolymarketMarkets(polymarketByGameKey.get(toGameKey('nfl', g.away_team, g.home_team)) || []),
        nflLineByKey.get(String(g.training_key || '')) || [],
        h2hByGameKey.get(toGameKey('nfl', g.away_team, g.home_team)) || [],
      ),
      sport: 'NFL',
    })),
    ...cfbRaw.map(g => ({
      ...formatCFBGame(
        g,
        formatPolymarketMarkets(polymarketByGameKey.get(toGameKey('cfb', g.away_team, g.home_team)) || []),
        cfbLineByKey.get(String(g.training_key || '')) || [],
      ),
      sport: 'CFB',
    })),
    ...nbaRaw.map(g => ({
      ...formatNBAGame(
        g,
        formatPolymarketMarkets(polymarketByGameKey.get(toGameKey('nba', g.away_team, g.home_team)) || []),
        nbaInjuriesByTeam.get(normalizeTeamKey(g.away_team)) || [],
        nbaInjuriesByTeam.get(normalizeTeamKey(g.home_team)) || [],
        nbaAccuracyById.get(String(g.game_id)) || null,
      ),
      sport: 'NBA',
    })),
    ...ncaabRaw.map(g => ({
      ...formatNCAABGame(
        g,
        formatPolymarketMarkets(polymarketByGameKey.get(toGameKey('ncaab', g.away_team, g.home_team)) || []),
        ncaabTrendsById.get(String(g.game_id)) || null,
        ncaabAccuracyById.get(String(g.game_id)) || null,
      ),
      sport: 'NCAAB',
    })),
  ];

  const payload1 = profile;
  const payload2 = {
    sport: 'MULTI',
    date: args.date,
    games: combinedGames,
    instructions: 'Analyze these games and select picks that align with your personality profile. Be selective and only pick games where you see genuine value based on your preferences.',
  };
  const payload3 = activePrompt || null;

  const latestPicks = await safeGetJson(`${MAIN_URL}/rest/v1/avatar_picks?select=*&avatar_id=eq.${enc(args.avatarId)}&order=created_at.desc&limit=20`, mainHeaders);
  const responsePayloadPersisted = {
    success: true,
    source: 'persisted avatar_picks rows',
    avatar_id: args.avatarId,
    picks: latestPicks,
    note: 'slate_note, tokens_used, and games_analyzed are edge-function response fields and are not persisted in avatar_picks',
  };

  fs.writeFileSync(path.join(outDir, 'payload1_agent_personality_live.json'), JSON.stringify(payload1, null, 2));
  fs.writeFileSync(path.join(outDir, 'payload2_game_data_live.json'), JSON.stringify(payload2, null, 2));
  fs.writeFileSync(path.join(outDir, 'payload3_system_prompt_live.json'), JSON.stringify(payload3, null, 2));
  fs.writeFileSync(path.join(outDir, 'response_payload_live_persisted_batch.json'), JSON.stringify(responsePayloadPersisted, null, 2));

  const missingPolymarket = payload2.games
    .filter(g => g.polymarket == null)
    .map(g => ({ sport: g.sport, matchup: g.matchup }));

  const summary = {
    generated_at: new Date().toISOString(),
    avatar_id: args.avatarId,
    target_date: args.date,
    payload2_games_count: payload2.games.length,
    breakdown: {
      nfl: nflRaw.length,
      cfb: cfbRaw.length,
      nba: nbaRaw.length,
      ncaab: ncaabRaw.length,
    },
    coverage: {
      polymarket_games: payload2.games.filter(g => g.polymarket != null).length,
      nfl_line_movement_games: payload2.games.filter(g => g.sport === 'NFL' && (g.line_movement || []).length > 0).length,
      nfl_h2h_games: payload2.games.filter(g => g.sport === 'NFL' && (g.h2h_recent || []).length > 0).length,
      cfb_line_movement_games: payload2.games.filter(g => g.sport === 'CFB' && (g.line_movement || []).length > 0).length,
      nba_injury_games: payload2.games.filter(g => g.sport === 'NBA' && ((((g.injuries || {}).away_team) || []).length > 0 || (((g.injuries || {}).home_team) || []).length > 0)).length,
      nba_prediction_accuracy_games: payload2.games.filter(g => g.sport === 'NBA' && g.prediction_accuracy != null).length,
      ncaab_situational_trends_games: payload2.games.filter(g => g.sport === 'NCAAB' && g.situational_trends != null).length,
      ncaab_prediction_accuracy_games: payload2.games.filter(g => g.sport === 'NCAAB' && g.prediction_accuracy != null).length,
    },
    missing_polymarket_games: missingPolymarket,
    files: [
      path.join(outDir, 'payload1_agent_personality_live.json'),
      path.join(outDir, 'payload2_game_data_live.json'),
      path.join(outDir, 'payload3_system_prompt_live.json'),
      path.join(outDir, 'response_payload_live_persisted_batch.json'),
    ],
  };

  fs.writeFileSync(path.join(outDir, 'summary_after_update.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));

  if (args.strictPolymarket && missingPolymarket.length > 0) {
    console.error(`\nstrict-polymarket enabled: ${missingPolymarket.length} games missing polymarket data.`);
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
