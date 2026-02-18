/**
 * Run an agent pick: fetch prompt from Supabase, build games payload, call OpenAI, log payload + response.
 *
 * Usage: node scripts/run-agent-pick.mjs [nba|ncaab]
 *
 * Requires:
 *   - OPENAI_API_KEY in .env or environment
 *   - Main Supabase (prompt): table agent_system_prompts with column system_prompt (or prompt/content/prompt_text)
 *   - Games come from CFB Supabase (nba_input_values_view / v_cbb_input_values)
 *
 * Override URLs/keys with SUPABASE_URL, SUPABASE_ANON_KEY, CFB_SUPABASE_URL, CFB_SUPABASE_ANON_KEY if needed.
 *
 * Payload now includes:
 * - edge_accuracy_by_bucket: full table for the sport (SPREAD_EDGE, OU_EDGE, MONEYLINE_PROB).
 * - Per game: game_data.edge_accuracy (spread/ou/ml bucket key and accuracy_pct for this game).
 * - Per game: game_data.situational_trends (away_team/home_team with situation labels and ATS/OU cover and over/under %).
 * If you run agent picks elsewhere (e.g. BuildShip), attach the same data so the agent can use the new prompt rules.
 */

import 'dotenv/config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAIN_SUPABASE_URL = process.env.SUPABASE_URL || 'https://gnjrklxotmbvnxbnnqgq.supabase.co';
const MAIN_SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ';
const CFB_SUPABASE_URL = process.env.CFB_SUPABASE_URL || 'https://jpxnjuwglavsjbgbasnl.supabase.co';
const CFB_SUPABASE_KEY = process.env.CFB_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo';

const sport = (process.argv[2] || 'ncaab').toLowerCase();
if (sport !== 'nba' && sport !== 'ncaab') {
  console.error('Usage: node scripts/run-agent-pick.mjs [nba|ncaab]');
  process.exit(1);
}

const today = new Date().toISOString().split('T')[0];

function roundToNearestHalf(v) {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v * 2) / 2;
}
function roundToNearest05(v) {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v * 20) / 20;
}

async function supabaseGet(url, key, path, query = '') {
  const res = await fetch(`${url}/rest/v1/${path}${query ? '?' + query : ''}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Build edge-accuracy lookup for one game from prediction, optional game (for vegas lines), and bucket rows. */
function getEdgeAccuracyForGame(pred, game, bucketRows) {
  if (!Array.isArray(bucketRows) || bucketRows.length === 0) return null;
  const map = new Map();
  for (const r of bucketRows) {
    map.set(`${r.edge_type}|${r.bucket}`, { games: r.games, accuracy_pct: r.accuracy_pct });
  }
  // Vegas: NCAAB pred has vegas_home_spread/vegas_total; NBA has them on game (home_spread, total_line)
  const vegasSpread = pred?.vegas_home_spread ?? game?.home_spread ?? null;
  const modelSpread = pred?.model_fair_home_spread ?? null;
  const vegasTotal = pred?.vegas_total ?? game?.total_line ?? game?.over_under ?? null;
  const predTotal = pred?.pred_total_points ?? pred?.model_fair_total ?? null;
  const homeWin = pred?.home_win_prob != null ? Number(pred.home_win_prob) : null;
  const awayWin = pred?.away_win_prob != null ? Number(pred.away_win_prob) : null;

  const spreadDiff = vegasSpread != null && modelSpread != null ? vegasSpread - modelSpread : null;
  const ouDiff = vegasTotal != null && predTotal != null ? predTotal - vegasTotal : null;
  const spreadKey = roundToNearestHalf(spreadDiff != null ? Math.abs(spreadDiff) : null);
  const ouKey = roundToNearestHalf(ouDiff);
  const mlKey = homeWin != null && awayWin != null ? roundToNearest05(Math.max(homeWin, awayWin)) : null;

  const spreadAcc = spreadKey != null ? map.get(`SPREAD_EDGE|${spreadKey}`) : null;
  const ouAcc = ouKey != null ? map.get(`OU_EDGE|${ouKey}`) : null;
  const mlAcc = mlKey != null ? map.get(`MONEYLINE_PROB|${mlKey}`) : null;
  return {
    spread_bucket_key: spreadKey,
    spread_accuracy_pct: spreadAcc?.accuracy_pct ?? null,
    spread_bucket_games: spreadAcc?.games ?? null,
    ou_bucket_key: ouKey,
    ou_accuracy_pct: ouAcc?.accuracy_pct ?? null,
    ou_bucket_games: ouAcc?.games ?? null,
    ml_bucket_key: mlKey,
    ml_accuracy_pct: mlAcc?.accuracy_pct ?? null,
    ml_bucket_games: mlAcc?.games ?? null,
  };
}

/** Slim situational row for payload (ATS/OU by situation). */
function slimSituationalRow(row) {
  if (!row || !row.team_name) return null;
  return {
    team_name: row.team_name,
    team_side: row.team_side,
    last_game_situation: row.last_game_situation,
    fav_dog_situation: row.fav_dog_situation,
    side_spread_situation: row.side_spread_situation,
    home_away_situation: row.home_away_situation,
    rest_bucket: row.rest_bucket,
    rest_comp: row.rest_comp,
    ats: {
      last_game_cover_pct: row.ats_last_game_cover_pct,
      fav_dog_cover_pct: row.ats_fav_dog_cover_pct,
      side_fav_dog_cover_pct: row.ats_side_fav_dog_cover_pct,
      home_away_cover_pct: row.ats_home_away_cover_pct,
      rest_bucket_cover_pct: row.ats_rest_bucket_cover_pct,
      rest_comp_cover_pct: row.ats_rest_comp_cover_pct,
    },
    ou: {
      last_game_over_pct: row.ou_last_game_over_pct,
      last_game_under_pct: row.ou_last_game_under_pct,
      fav_dog_over_pct: row.ou_fav_dog_over_pct,
      fav_dog_under_pct: row.ou_fav_dog_under_pct,
      side_fav_dog_over_pct: row.ou_side_fav_dog_over_pct,
      side_fav_dog_under_pct: row.ou_side_fav_dog_under_pct,
      home_away_over_pct: row.ou_home_away_over_pct,
      home_away_under_pct: row.ou_home_away_under_pct,
      rest_bucket_over_pct: row.ou_rest_bucket_over_pct,
      rest_bucket_under_pct: row.ou_rest_bucket_under_pct,
      rest_comp_over_pct: row.ou_rest_comp_over_pct,
      rest_comp_under_pct: row.ou_rest_comp_under_pct,
    },
  };
}

function buildNBAGameData(game, pred = null, edgeAccuracy = null, situational = null) {
  const homeML = game.home_moneyline;
  let awayML = null;
  if (homeML) awayML = homeML > 0 ? -(homeML + 100) : 100 - homeML;
  const gameData = {
    game: {
      away_team: game.away_team,
      home_team: game.home_team,
      game_date: game.game_date,
      game_time: game.tipoff_time_et,
    },
    vegas_lines: {
      home_spread: game.home_spread,
      away_spread: game.home_spread ? -game.home_spread : null,
      home_ml: homeML,
      away_ml: awayML,
      over_line: game.total_line,
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
    model_predictions: pred ? {
      spread_cover_prob: pred.home_away_spread_cover_prob,
      ml_prob: pred.home_away_ml_prob,
      ou_prob: pred.ou_result_prob,
      predicted_team: (pred.home_away_spread_cover_prob || 0) > 0.5 ? 'home' : 'away',
    } : null,
  };
  if (edgeAccuracy) gameData.edge_accuracy = edgeAccuracy;
  if (situational) gameData.situational_trends = situational;
  return {
    game_id: String(game.game_id),
    matchup: `${game.away_team} @ ${game.home_team}`,
    game_data: gameData,
  };
}

function buildNCAABGameData(game, pred = null, edgeAccuracy = null, situational = null) {
  const gameData = {
    game: {
      away_team: game.away_team,
      home_team: game.home_team,
      game_date: game.game_date_et,
      game_time: game.start_utc || game.tipoff_time_et,
      conference_game: game.conference_game,
      neutral_site: game.neutral_site,
    },
    vegas_lines: {
      home_spread: game.spread,
      away_spread: game.spread ? -game.spread : null,
      home_ml: game.homeMoneyline,
      away_ml: game.awayMoneyline,
      over_line: game.over_under,
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
    model_predictions: pred ? {
      spread_cover_prob: pred.home_away_spread_cover_prob,
      ml_prob: pred.home_away_ml_prob,
      ou_prob: pred.ou_result_prob,
      predicted_team: (pred.home_away_spread_cover_prob || 0) > 0.5 ? 'home' : 'away',
    } : null,
  };
  if (edgeAccuracy) gameData.edge_accuracy = edgeAccuracy;
  if (situational) gameData.situational_trends = situational;
  return {
    game_id: String(game.game_id),
    matchup: `${game.away_team} @ ${game.home_team}`,
    game_data: gameData,
  };
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY in env or .env');
    process.exit(1);
  }

  console.log('--- 1. Fetching agent system prompt from Supabase ---');
  let promptRows;
  try {
    promptRows = await supabaseGet(MAIN_SUPABASE_URL, MAIN_SUPABASE_KEY, 'agent_system_prompts', 'select=*&limit=1');
  } catch (e) {
    console.error('Failed to fetch agent_system_prompts. If your table name/column differs, edit this script.', e.message);
    process.exit(1);
  }
  if (!Array.isArray(promptRows) || promptRows.length === 0) {
    console.error('No rows in agent_system_prompts. Add a row with your full prompt (e.g. in column system_prompt or prompt).');
    process.exit(1);
  }
  const row = promptRows[0];
  const systemPromptRaw = row.system_prompt ?? row.prompt ?? row.content ?? row.prompt_text;
  if (!systemPromptRaw || typeof systemPromptRaw !== 'string') {
    console.error('Prompt not found. Row keys:', Object.keys(row));
    process.exit(1);
  }
  const systemPrompt = systemPromptRaw
    .replace(/\{\{AGENT_NAME\}\}/g, 'Test Agent')
    .replace(/\{\{AGENT_EMOJI\}\}/g, '🤖')
    .replace(/\{\{AGENT_SPORTS\}\}/g, sport === 'nba' ? 'NBA' : 'NCAAB')
    .replace(/\{\{PERSONALITY_INSTRUCTIONS\}\}/g, 'Balanced risk tolerance, no strong underdog/over lean, trust model moderately (3), use team ratings. Prefer spread and total when value is clear.')
    .replace(/\{\{CUSTOM_INSIGHTS\}\}/g, '')
    .replace(/\{\{CONSTRAINTS\}\}/g, 'No additional constraints.');
  console.log('Prompt length:', systemPrompt.length);

  console.log('\n--- 2. Fetching games, predictions, edge accuracy, and situational trends from CFB Supabase ---');
  let games = [];
  let predictions = [];
  let edgeAccuracyRows = [];
  let situationalTrendsRows = [];

  if (sport === 'nba') {
    const [gamesRes, runRes, edgeRes, sitRes] = await Promise.all([
      supabaseGet(CFB_SUPABASE_URL, CFB_SUPABASE_KEY, 'nba_input_values_view', `game_date=eq.${today}&select=*`),
      fetch(`${CFB_SUPABASE_URL}/rest/v1/nba_predictions?select=run_id&order=run_id.desc&limit=1`, {
        headers: { apikey: CFB_SUPABASE_KEY, Authorization: `Bearer ${CFB_SUPABASE_KEY}` },
      }).then(r => r.json()).then(d => d?.[0]).catch(() => null),
      supabaseGet(CFB_SUPABASE_URL, CFB_SUPABASE_KEY, 'nba_edge_accuracy_by_bucket', 'select=edge_type,bucket,games,correct,accuracy_pct').catch(() => []),
      supabaseGet(CFB_SUPABASE_URL, CFB_SUPABASE_KEY, 'nba_game_situational_trends_today', 'select=*').catch(() => []),
    ]);
    games = Array.isArray(gamesRes) ? gamesRes : [];
    if (runRes?.run_id) {
      const preds = await supabaseGet(CFB_SUPABASE_URL, CFB_SUPABASE_KEY, 'nba_predictions', `run_id=eq.${runRes.run_id}&select=*`);
      predictions = Array.isArray(preds) ? preds : [];
    }
    edgeAccuracyRows = Array.isArray(edgeRes) ? edgeRes : [];
    situationalTrendsRows = Array.isArray(sitRes) ? sitRes : [];
  } else {
    const [gamesRes, runRes, edgeRes, sitRes] = await Promise.all([
      supabaseGet(CFB_SUPABASE_URL, CFB_SUPABASE_KEY, 'v_cbb_input_values', `game_date_et=eq.${today}&select=*`),
      fetch(`${CFB_SUPABASE_URL}/rest/v1/ncaab_predictions?select=run_id&order=run_id.desc&limit=1`, {
        headers: { apikey: CFB_SUPABASE_KEY, Authorization: `Bearer ${CFB_SUPABASE_KEY}` },
      }).then(r => r.json()).then(d => d?.[0]).catch(() => null),
      supabaseGet(CFB_SUPABASE_URL, CFB_SUPABASE_KEY, 'ncaab_edge_accuracy_by_bucket', 'select=edge_type,bucket,games,correct,accuracy_pct').catch(() => []),
      supabaseGet(CFB_SUPABASE_URL, CFB_SUPABASE_KEY, 'ncaab_game_situational_trends_today', 'select=*').catch(() => []),
    ]);
    games = Array.isArray(gamesRes) ? gamesRes : [];
    if (runRes?.run_id) {
      const preds = await supabaseGet(CFB_SUPABASE_URL, CFB_SUPABASE_KEY, 'ncaab_predictions', `run_id=eq.${runRes.run_id}&select=*`);
      predictions = Array.isArray(preds) ? preds : [];
    }
    edgeAccuracyRows = Array.isArray(edgeRes) ? edgeRes : [];
    situationalTrendsRows = Array.isArray(sitRes) ? sitRes : [];
  }

  const predByGameId = new Map((predictions || []).map(p => [String(p.game_id), p]));

  // Group situational trends by game_id: { game_id: { away_team: row, home_team: row } }
  const situationalByGameId = new Map();
  for (const row of situationalTrendsRows || []) {
    const gid = row.game_id;
    if (!situationalByGameId.has(gid)) {
      situationalByGameId.set(gid, { away_team: null, home_team: null });
    }
    const entry = situationalByGameId.get(gid);
    if (row.team_side === 'away') entry.away_team = row;
    else if (row.team_side === 'home') entry.home_team = row;
  }

  console.log(`Games: ${games?.length ?? 0}, Predictions: ${predictions?.length ?? 0}, Edge accuracy rows: ${edgeAccuracyRows?.length ?? 0}, Situational trends games: ${situationalByGameId.size}`);

  const buildGame = sport === 'nba' ? buildNBAGameData : buildNCAABGameData;
  const payloadGames = (games || []).slice(0, 15).map((g) => {
    const pred = predByGameId.get(String(g.game_id));
    const edgeAcc = getEdgeAccuracyForGame(pred, g, edgeAccuracyRows);
    const sit = situationalByGameId.get(g.game_id);
    const situationalPayload = sit
      ? {
          away_team: slimSituationalRow(sit.away_team),
          home_team: slimSituationalRow(sit.home_team),
        }
      : null;
    return buildGame(g, pred, edgeAcc, situationalPayload);
  });

  const userPayload = {
    sport: sport.toUpperCase(),
    date: today,
    edge_accuracy_by_bucket: edgeAccuracyRows.length
      ? edgeAccuracyRows.map((r) => ({ edge_type: r.edge_type, bucket: r.bucket, games: r.games, correct: r.correct, accuracy_pct: r.accuracy_pct }))
      : null,
    games: payloadGames,
    instructions: 'Analyze the games and return your picks and slate_note in the required JSON format. Use edge_accuracy and situational_trends in game_data when present. Matchup is always "Away Team @ Home Team": only the HOME team (second team) has home court advantage; never attribute home court to the away team in reasoning or key_factors.',
  };

  console.log('\n--- 3. Payload (games) ---');
  console.log(JSON.stringify(userPayload, null, 2));

  console.log('\n--- 4. Calling OpenAI ---');
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPayload, null, 2) },
      ],
      temperature: 0.3,
    }),
  });
  if (!openaiRes.ok) {
    console.error('OpenAI error:', openaiRes.status, await openaiRes.text());
    process.exit(1);
  }
  const openaiData = await openaiRes.json();
  const content = openaiData.choices?.[0]?.message?.content;
  if (!content) {
    console.error('No content in OpenAI response:', JSON.stringify(openaiData, null, 2));
    process.exit(1);
  }

  console.log('\n--- 5. Raw pick response (content) ---');
  console.log(content);

  let parsed = null;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch (_) {}
  if (parsed) {
    console.log('\n--- 6. Parsed picks + slate_note ---');
    console.log(JSON.stringify(parsed, null, 2));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
