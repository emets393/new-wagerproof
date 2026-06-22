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
    case 'mlb':
      return fetchMLBGames(cfbClient, mainClient, targetDate);
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

  // Slate game_ids are whatever formatNFLGame assigns (training_key today; the
  // 2026 contract migrates this to the nflverse id, e.g. 2025_12_BUF_HOU). Props
  // join on that same id — see DRYRUN_WK12_SPEC.md "Join key … game_id". When the
  // feed's game_id and nfl_dryrun_props.game_id share a scheme, props light up.
  const gameIds = [...new Set(games.map(g => String(g.training_key || `${g.away_team}_${g.home_team}`)).filter(Boolean))];

  const [polymarketByGameKey, lineMovementByTrainingKey, h2hByGameKey, propsByGameId] = await Promise.all([
    fetchPolymarketByGameKey(mainClient, 'nfl', games),
    fetchLineMovementByTrainingKey(cfbClient, 'nfl_betting_lines', games),
    fetchNFLH2HByGameKey(cfbClient, games),
    fetchNFLPropsByGameId(cfbClient, gameIds),
  ]);

  const formattedGames = games.map(game => {
    const gameId = String(game.training_key || `${game.away_team}_${game.home_team}`);
    return formatNFLGame(
      game,
      polymarketByGameKey.get(toGameKey('nfl', game.away_team, game.home_team)) || null,
      lineMovementByTrainingKey.get(String(game.training_key || '')) || [],
      h2hByGameKey.get(toGameKey('nfl', game.away_team, game.home_team)) || [],
      propsByGameId.get(gameId) || []
    );
  });
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
// MLB Perfect Storm reference data — bucket boundaries + abbreviations
// MUST stay in sync with cfb_automation/scripts/mlb/mlb_daily_regression_report.py.
// If those Python constants change, mirror the change here too — the LLM
// reads the same `accuracy_signals.edge_bucket` strings the regression
// report writes, so any drift produces nonsense lookups.
// =============================================================================

const MLB_ML_EDGE_BUCKETS: ReadonlyArray<readonly [number, string]> = [
  [7, '7%+'], [4, '4-6.9%'], [2, '2-3.9%'], [0, '<2%'],
];
const MLB_OU_EDGE_BUCKETS: ReadonlyArray<readonly [number, string]> = [
  [1.5, '1.5+'], [1.0, '1.0-1.49'], [0.5, '0.5-0.99'], [0, '<0.5'],
];
const MLB_F5_ML_EDGE_BUCKETS: ReadonlyArray<readonly [number, string]> = [
  [20, '20%+'], [10, '10-19.9%'], [5, '5-9.9%'], [0, '<5%'],
];
const MLB_F5_OU_EDGE_BUCKETS: ReadonlyArray<readonly [number, string]> = [
  [1.0, '1.0+'], [0.5, '0.5-0.99'], [0, '<0.5'],
];

// Mirrors _NAME_TO_ABBR in mlb_daily_regression_report.py.
const MLB_TEAM_ABBR: Record<string, string> = {
  'arizona diamondbacks': 'AZ', 'atlanta braves': 'ATL', 'baltimore orioles': 'BAL',
  'boston red sox': 'BOS', 'chicago cubs': 'CHC', 'chicago white sox': 'CWS',
  'cincinnati reds': 'CIN', 'cleveland guardians': 'CLE', 'colorado rockies': 'COL',
  'detroit tigers': 'DET', 'houston astros': 'HOU', 'kansas city royals': 'KC',
  'los angeles angels': 'LAA', 'los angeles dodgers': 'LAD', 'miami marlins': 'MIA',
  'milwaukee brewers': 'MIL', 'minnesota twins': 'MIN', 'new york mets': 'NYM',
  'new york yankees': 'NYY', 'oakland athletics': 'ATH', 'las vegas athletics': 'ATH',
  'athletics': 'ATH', 'philadelphia phillies': 'PHI', 'pittsburgh pirates': 'PIT',
  'san diego padres': 'SD', 'san francisco giants': 'SF', 'seattle mariners': 'SEA',
  'st louis cardinals': 'STL', 'st. louis cardinals': 'STL', 'tampa bay rays': 'TB',
  'texas rangers': 'TEX', 'toronto blue jays': 'TOR', 'washington nationals': 'WSH',
};

function mlbTeamAbbr(name: unknown): string | null {
  if (typeof name !== 'string' || !name) return null;
  const key = name.toLowerCase().replace(/\./g, '').trim();
  return MLB_TEAM_ABBR[key] ?? null;
}

// Same shape as edge_bucket() in mlb_daily_regression_report.py:
// labels carry an explicit '+' or '-' prefix so positive (model sees value)
// and negative (market is ahead) edges land in different buckets.
function edgeBucketLabel(
  val: number | null | undefined,
  buckets: ReadonlyArray<readonly [number, string]>,
): string | null {
  if (val == null || !Number.isFinite(val)) return null;
  const absVal = Math.abs(val);
  const sign = val < 0 ? '-' : '+';
  for (const [threshold, label] of buckets) {
    if (absVal >= threshold) return `${sign}${label}`;
  }
  return `${sign}${buckets[buckets.length - 1][1]}`;
}

// Day-of-week label as used by the regression report's breakdown table.
// Matches Python's date.weekday()-driven ['Mon','Tue',...] indexing.
function mlbDowLabel(targetDate: string): string {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Use UTC parsing so the worker's TZ doesn't shift the date.
  const d = new Date(`${targetDate}T12:00:00Z`);
  return labels[d.getUTCDay()];
}

interface MLBBucketRow {
  bet_type: string;
  bucket: string | null;
  side: string | null;
  fav_dog: string | null;
  direction: string | null;
  games: number;
  win_pct: number | null;
  roi_pct: number | null;
  units_won: number | null;
}

interface MLBBreakdownRow {
  bet_type: string;
  breakdown_type: string;       // 'dow' | 'team'
  breakdown_value: string;
  games: number;
  win_pct: number | null;
  roi_pct: number | null;
}

interface MLBSuggestedPick {
  game_pk: number | string;
  bet_type: string;             // full_ml / full_rl / full_ou / f5_ml / f5_rl / f5_ou
  pick: string;
  perfect_storm_tier?: string;  // hammer / ps / lean / watch
  bucket_roi_pct?: number | null;
  bucket_win_pct?: number | null;
  edge_bucket?: string | null;
  edge_at_suggestion?: number | null;
  reasoning?: string;
}

async function fetchMLBGames(
  cfbClient: SupabaseClient,
  mainClient: SupabaseClient,
  targetDate: string
): Promise<GameFetchResult> {
  // MLB uses official_date (YYYY-MM-DD) not game_date
  const { data: strictGames, error: gamesError } = await cfbClient
    .from('mlb_games_today')
    .select('*')
    .eq('official_date', targetDate)
    .or('is_active.eq.true,is_active.is.null')
    .or('is_completed.eq.false,is_completed.is.null')
    .order('game_time_et', { ascending: true });

  let games = strictGames || [];
  if (games.length === 0 && !gamesError) {
    // Fallback: relaxed query without status filters
    const { data: relaxedGames } = await cfbClient
      .from('mlb_games_today')
      .select('*')
      .eq('official_date', targetDate)
      .order('game_time_et', { ascending: true });
    games = (relaxedGames || []).filter((g: Record<string, unknown>) =>
      g.is_postponed !== true && g.is_completed !== true
    );
  }

  if (games.length === 0) {
    return { games: [], formattedGames: [] };
  }

  // Fetch signals for today's games
  let signalsByGamePk = new Map<string, Record<string, unknown>>();
  try {
    const { data: signalRows } = await cfbClient
      .from('mlb_game_signals')
      .select('game_pk, home_signals, away_signals, game_signals');
    if (signalRows) {
      for (const row of signalRows as Record<string, unknown>[]) {
        const pk = String(Math.trunc(Number(row.game_pk)));
        signalsByGamePk.set(pk, row);
      }
    }
  } catch (err) {
    console.warn('[agentGameHelpers] MLB signals fetch failed:', (err as Error).message);
  }

  // Fetch latest odds snapshot per game so we can surface runline juice
  // (-1.5 / -0.5 odds) in the agent payload. mlb_games_today carries the
  // spread points but not the spread odds — those live in mlb_odds_snapshots.
  // Without this the agent can't reason about ML→RL swap economics.
  const latestOddsByGamePk = new Map<string, Record<string, unknown>>();
  try {
    const gamePks = games.map(g => Math.trunc(Number(g.game_pk))).filter(n => Number.isFinite(n));
    if (gamePks.length > 0) {
      const { data: oddsRows } = await cfbClient
        .from('mlb_odds_snapshots')
        .select('game_pk,fetched_at,home_spread_odds,away_spread_odds,total_over_odds,total_under_odds,f5_home_spread_odds,f5_away_spread_odds,f5_total_over_odds,f5_total_under_odds')
        .in('game_pk', gamePks)
        .order('fetched_at', { ascending: false });
      // Take the first (latest) row per game_pk.
      for (const row of (oddsRows || []) as Record<string, unknown>[]) {
        const pk = String(Math.trunc(Number(row.game_pk)));
        if (!latestOddsByGamePk.has(pk)) latestOddsByGamePk.set(pk, row);
      }
    }
  } catch (err) {
    console.warn('[agentGameHelpers] MLB odds-snapshots fetch failed:', (err as Error).message);
  }

  // Fetch the three Perfect Storm reference tables ONCE per slate. These
  // are slate-wide lookups, not per-game — re-fetching per game would be
  // ~15× wasteful. Total payload here is ~50-100 small rows.
  const bucketRows: MLBBucketRow[] = [];
  const breakdownRows: MLBBreakdownRow[] = [];
  let suggestedPicks: MLBSuggestedPick[] = [];

  try {
    const [bucketResp, breakdownResp, regReportResp] = await Promise.all([
      cfbClient.from('mlb_model_bucket_accuracy').select('*'),
      cfbClient.from('mlb_model_breakdown_accuracy').select('*'),
      cfbClient
        .from('mlb_regression_report')
        .select('suggested_picks')
        .eq('report_date', targetDate)
        .maybeSingle(),
    ]);

    if (bucketResp.data) {
      for (const r of bucketResp.data as Record<string, unknown>[]) {
        bucketRows.push({
          bet_type: String(r.bet_type || ''),
          bucket: r.bucket as string | null,
          side: (r.side as string | null) || null,
          fav_dog: (r.fav_dog as string | null) || null,
          direction: (r.direction as string | null) || null,
          games: Number(r.games || 0),
          win_pct: r.win_pct == null ? null : Number(r.win_pct),
          roi_pct: r.roi_pct == null ? null : Number(r.roi_pct),
          units_won: r.units_won == null ? null : Number(r.units_won),
        });
      }
    }
    if (breakdownResp.data) {
      for (const r of breakdownResp.data as Record<string, unknown>[]) {
        breakdownRows.push({
          bet_type: String(r.bet_type || ''),
          breakdown_type: String(r.breakdown_type || ''),
          breakdown_value: String(r.breakdown_value || ''),
          games: Number(r.games || 0),
          win_pct: r.win_pct == null ? null : Number(r.win_pct),
          roi_pct: r.roi_pct == null ? null : Number(r.roi_pct),
        });
      }
    }
    const rawSuggested = (regReportResp.data as Record<string, unknown> | null)?.suggested_picks;
    if (Array.isArray(rawSuggested)) {
      suggestedPicks = rawSuggested as MLBSuggestedPick[];
    }
  } catch (err) {
    console.warn('[agentGameHelpers] MLB Perfect Storm reference fetch failed:', (err as Error).message);
  }

  // Index the breakdown table for O(1) lookup. Bucket lookup stays as a
  // linear scan — the table is ~40 rows total so indexing isn't worth it.
  const dowRoiIdx = new Map<string, number | null>();
  const teamRoiIdx = new Map<string, number | null>();
  for (const r of breakdownRows) {
    if (r.breakdown_type === 'dow') {
      dowRoiIdx.set(`${r.bet_type}|${r.breakdown_value}`, r.roi_pct);
    } else if (r.breakdown_type === 'team') {
      teamRoiIdx.set(`${r.bet_type}|${r.breakdown_value}`, r.roi_pct);
    }
  }

  // Index suggested_picks by game_pk (a game can have multiple picks —
  // e.g. F5 RL + full O/U on the same game).
  const psPicksByGamePk = new Map<string, MLBSuggestedPick[]>();
  for (const p of suggestedPicks) {
    const pk = String(Math.trunc(Number(p.game_pk)));
    if (!psPicksByGamePk.has(pk)) psPicksByGamePk.set(pk, []);
    psPicksByGamePk.get(pk)!.push(p);
  }

  const dowLabel = mlbDowLabel(targetDate);

  // Fetch polymarket data
  const polymarketByGameKey = await fetchPolymarketByGameKey(mainClient, 'mlb', games.map(g => ({
    away_team: g.away_team_name,
    home_team: g.home_team_name,
  })));

  const formattedGames = games.map((game: Record<string, unknown>) => {
    const pk = String(Math.trunc(Number(game.game_pk)));
    return formatMLBGame(
      game,
      polymarketByGameKey.get(toGameKey('mlb', game.away_team_name, game.home_team_name)) || null,
      signalsByGamePk.get(pk) || null,
      latestOddsByGamePk.get(pk) || null,
      bucketRows,
      dowRoiIdx,
      teamRoiIdx,
      psPicksByGamePk.get(pk) || [],
      dowLabel,
    );
  });
  return { games, formattedGames };
}

// Look up a bucket-accuracy row matching every supplied filter. Mirrors
// bucket_lookup() in mlb_daily_regression_report.py — only filters with a
// non-null value participate in the match.
function findMlbBucket(
  rows: MLBBucketRow[],
  filters: { bet_type: string; bucket: string | null; side?: string | null; fav_dog?: string | null; direction?: string | null },
): MLBBucketRow | null {
  for (const r of rows) {
    if (r.bet_type !== filters.bet_type) continue;
    if (filters.bucket != null && r.bucket !== filters.bucket) continue;
    if (filters.side != null && r.side !== filters.side) continue;
    if (filters.fav_dog != null && r.fav_dog !== filters.fav_dog) continue;
    if (filters.direction != null && r.direction !== filters.direction) continue;
    return r;
  }
  return null;
}

function formatMLBGame(
  game: Record<string, unknown>,
  polymarket: Record<string, unknown> | null,
  signals: Record<string, unknown> | null,
  latestOdds: Record<string, unknown> | null,
  bucketRows: MLBBucketRow[],
  dowRoiIdx: Map<string, number | null>,
  teamRoiIdx: Map<string, number | null>,
  psPicks: MLBSuggestedPick[],
  dowLabel: string,
): Record<string, unknown> {
  const gameId = String(game.game_pk);
  const homeName = game.home_team_name as string | null;
  const awayName = game.away_team_name as string | null;
  const homeAbbr = mlbTeamAbbr(homeName);
  const awayAbbr = mlbTeamAbbr(awayName);

  const homeML = game.home_ml as number | null;
  const awayML = game.away_ml as number | null;
  const homeSpread = game.home_spread as number | null;
  const awaySpread = game.away_spread as number | null;
  const f5HomeML = game.f5_home_ml as number | null;
  const f5AwayML = game.f5_away_ml as number | null;
  const f5HomeSpread = game.f5_home_spread as number | null;
  const f5AwaySpread = game.f5_away_spread as number | null;

  // Spread odds (the runline juice) live in mlb_odds_snapshots, not
  // mlb_games_today. They're what the agent needs to evaluate ML→RL swaps.
  const homeSpreadOdds = (latestOdds?.home_spread_odds as number | null) ?? null;
  const awaySpreadOdds = (latestOdds?.away_spread_odds as number | null) ?? null;
  const totalOverOdds = (latestOdds?.total_over_odds as number | null) ?? null;
  const totalUnderOdds = (latestOdds?.total_under_odds as number | null) ?? null;
  const f5HomeSpreadOdds = (latestOdds?.f5_home_spread_odds as number | null) ?? null;
  const f5AwaySpreadOdds = (latestOdds?.f5_away_spread_odds as number | null) ?? null;
  const f5TotalOverOdds = (latestOdds?.f5_total_over_odds as number | null) ?? null;
  const f5TotalUnderOdds = (latestOdds?.f5_total_under_odds as number | null) ?? null;

  // Parse signals arrays (they may be stringified JSON)
  const parseSignals = (raw: unknown): string[] => {
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((s: unknown) => {
      if (typeof s === 'string') {
        try { const p = JSON.parse(s); return p.message || String(s); } catch { return String(s); }
      }
      if (s && typeof s === 'object') return (s as Record<string, unknown>).message as string || '';
      return '';
    }).filter(Boolean);
  };

  const gameSignals = signals ? parseSignals(signals.game_signals) : [];
  const homeSignals = signals ? parseSignals(signals.home_signals) : [];
  const awaySignals = signals ? parseSignals(signals.away_signals) : [];
  const allSignals = [...gameSignals, ...homeSignals, ...awaySignals];

  // ── Compute Perfect Storm accuracy_signals for all 6 MLB bet types. ──
  // Mirrors the regression report's classifier — for each bet type we
  // surface the same three inputs that drive its `acc_score`:
  //   1. day-of-week ROI for the bet type
  //   2. team(s) ROI for the bet type
  //   3. edge bucket ROI for THIS game's edge magnitude
  // The agent then uses these alongside its `trust_model` personality
  // dial to decide how much weight to give the model's conviction.
  // RL buckets mirror their underlying ML buckets (the regression report
  // doesn't grade RL separately — it swaps ML→RL after PS classification).
  const homeMLEdge = (game.home_ml_edge_pct as number | null) ?? null;
  const awayMLEdge = (game.away_ml_edge_pct as number | null) ?? null;
  const ouEdge = (game.ou_edge as number | null) ?? null;
  const ouDirRaw = (game.ou_direction as string | null) ?? null;  // 'OVER' / 'UNDER'
  const f5HomeMLEdge = (game.f5_home_ml_edge_pct as number | null) ?? null;
  const f5AwayMLEdge = (game.f5_away_ml_edge_pct as number | null) ?? null;
  const f5OuEdge = (game.f5_ou_edge as number | null) ?? null;

  // Pick the side (home/away) the model favors and convert to bucket label.
  const fullMLBest = pickModelSide(homeMLEdge, awayMLEdge, homeML, awayML);
  const f5MLBest = pickModelSide(f5HomeMLEdge, f5AwayMLEdge, f5HomeML, f5AwayML);

  const fullMLBucket = fullMLBest
    ? edgeBucketLabel(fullMLBest.edge, MLB_ML_EDGE_BUCKETS)
    : null;
  const f5MLBucket = f5MLBest
    ? edgeBucketLabel(f5MLBest.edge, MLB_F5_ML_EDGE_BUCKETS)
    : null;

  const fullOuBucket = edgeBucketLabel(ouEdge, MLB_OU_EDGE_BUCKETS);
  const f5OuBucket = edgeBucketLabel(f5OuEdge, MLB_F5_OU_EDGE_BUCKETS);

  const f5OuDir = f5OuEdge == null ? null : (f5OuEdge > 0 ? 'over' : 'under');

  const accuracySignals: Record<string, unknown> = {
    dow: dowLabel,
    full_ml: buildAccuracyBlock({
      bet_type: 'full_ml',
      dow_label: dowLabel,
      home_abbr: homeAbbr,
      away_abbr: awayAbbr,
      bucket: fullMLBucket,
      side: fullMLBest?.side ?? null,
      fav_dog: fullMLBest?.favDog ?? null,
      direction: null,
      bucketRows,
      dowRoiIdx,
      teamRoiIdx,
      modelSide: fullMLBest?.side ?? null,
    }),
    full_rl: buildAccuracyBlock({
      bet_type: 'full_ml',  // RL inherits ML's bucket signal — see comment above
      dow_label: dowLabel,
      home_abbr: homeAbbr,
      away_abbr: awayAbbr,
      bucket: fullMLBucket,
      side: fullMLBest?.side ?? null,
      fav_dog: fullMLBest?.favDog ?? null,
      direction: null,
      bucketRows,
      dowRoiIdx,
      teamRoiIdx,
      modelSide: fullMLBest?.side ?? null,
      borrowedFrom: 'full_ml',
    }),
    full_ou: buildAccuracyBlock({
      bet_type: 'full_ou',
      dow_label: dowLabel,
      home_abbr: homeAbbr,
      away_abbr: awayAbbr,
      bucket: fullOuBucket,
      side: null,
      fav_dog: null,
      direction: ouDirRaw,
      bucketRows,
      dowRoiIdx,
      teamRoiIdx,
      modelSide: null,
    }),
    f5_ml: buildAccuracyBlock({
      bet_type: 'f5_ml',
      dow_label: dowLabel,
      home_abbr: homeAbbr,
      away_abbr: awayAbbr,
      bucket: f5MLBucket,
      side: f5MLBest?.side ?? null,
      fav_dog: null,  // f5_ml buckets aren't sliced by fav/dog in the report
      direction: null,
      bucketRows,
      dowRoiIdx,
      teamRoiIdx,
      modelSide: f5MLBest?.side ?? null,
    }),
    f5_rl: buildAccuracyBlock({
      bet_type: 'f5_ml',  // RL inherits ML's bucket signal
      dow_label: dowLabel,
      home_abbr: homeAbbr,
      away_abbr: awayAbbr,
      bucket: f5MLBucket,
      side: f5MLBest?.side ?? null,
      fav_dog: null,
      direction: null,
      bucketRows,
      dowRoiIdx,
      teamRoiIdx,
      modelSide: f5MLBest?.side ?? null,
      borrowedFrom: 'f5_ml',
    }),
    f5_ou: buildAccuracyBlock({
      bet_type: 'f5_ou',
      dow_label: dowLabel,
      home_abbr: homeAbbr,
      away_abbr: awayAbbr,
      bucket: f5OuBucket,
      side: null,
      fav_dog: null,
      direction: f5OuDir,
      bucketRows,
      dowRoiIdx,
      teamRoiIdx,
      modelSide: null,
    }),
  };

  // Perfect Storm tag(s) from today's regression report. These are the
  // post-classification, post-ML→RL-swap picks already filtered to PS-tier
  // criteria. The agent should treat these as "the regression report
  // surfaced this; weight per your trust_model setting."
  const perfectStormTags = psPicks.map(p => ({
    bet_type: p.bet_type,
    pick: p.pick,
    perfect_storm_tier: p.perfect_storm_tier ?? null,
    bucket_roi_pct: p.bucket_roi_pct ?? null,
    bucket_win_pct: p.bucket_win_pct ?? null,
    edge_bucket: p.edge_bucket ?? null,
    edge_at_suggestion: p.edge_at_suggestion ?? null,
    reasoning: p.reasoning ?? null,
  }));

  return {
    game_id: gameId,
    matchup: `${awayName} @ ${homeName}`,
    away_team: awayName,
    home_team: homeName,
    away_team_abbr: awayAbbr,
    home_team_abbr: homeAbbr,
    game_date: game.official_date,
    game_time: game.game_time_et,
    status: game.status,
    starting_pitchers: {
      away_sp: game.away_sp_name || 'TBD',
      away_sp_confirmed: game.away_sp_confirmed ?? false,
      home_sp: game.home_sp_name || 'TBD',
      home_sp_confirmed: game.home_sp_confirmed ?? false,
    },
    // Six bet shapes side-by-side. Agent picks one bet_type+period combo
    // per game (or skips). RL odds (the runline juice) come from
    // mlb_odds_snapshots; mlb_games_today only carries the spread points.
    vegas_lines: {
      // Convenience summary strings for the LLM
      spread_summary: `${awayName} ${fmtSpread(awaySpread)} / ${homeName} ${fmtSpread(homeSpread)}`,
      ml_summary: `${awayName} ${fmtML(awayML) ?? 'N/A'} / ${homeName} ${fmtML(homeML) ?? 'N/A'}`,
      // Full-game
      full_ml: { home: fmtML(homeML), away: fmtML(awayML) },
      full_rl: {
        home_spread: homeSpread, home_odds: fmtML(homeSpreadOdds),
        away_spread: awaySpread, away_odds: fmtML(awaySpreadOdds),
      },
      full_ou: {
        line: game.total_line ?? null,
        over_odds: fmtML(totalOverOdds), under_odds: fmtML(totalUnderOdds),
      },
      // First 5 innings
      f5_ml: { home: fmtML(f5HomeML), away: fmtML(f5AwayML) },
      f5_rl: {
        home_spread: f5HomeSpread, home_odds: fmtML(f5HomeSpreadOdds),
        away_spread: f5AwaySpread, away_odds: fmtML(f5AwaySpreadOdds),
      },
      f5_ou: {
        line: game.f5_total_line ?? null,
        over_odds: fmtML(f5TotalOverOdds), under_odds: fmtML(f5TotalUnderOdds),
      },
      // Legacy flat fields kept so the existing prompt language still
      // resolves them — remove only after the v1_mlb prompt is rewritten
      // to consume the structured blocks above.
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: fmtML(homeML),
      away_ml: fmtML(awayML),
      total: game.total_line,
    },
    model_predictions: {
      // Full game
      ml_home_win_prob: game.ml_home_win_prob,
      ml_away_win_prob: game.ml_away_win_prob,
      home_ml_edge_pct: homeMLEdge,
      away_ml_edge_pct: awayMLEdge,
      home_ml_strong_signal: game.home_ml_strong_signal,
      away_ml_strong_signal: game.away_ml_strong_signal,
      ou_direction: ouDirRaw,
      ou_edge: ouEdge,
      ou_fair_total: game.ou_fair_total,
      ou_strong_signal: game.ou_strong_signal,
      ou_moderate_signal: game.ou_moderate_signal,
      // First 5 innings
      f5_home_win_prob: game.f5_home_win_prob,
      f5_away_win_prob: game.f5_away_win_prob,
      f5_home_ml_edge_pct: f5HomeMLEdge,
      f5_away_ml_edge_pct: f5AwayMLEdge,
      f5_home_ml_strong_signal: game.f5_home_ml_strong_signal,
      f5_away_ml_strong_signal: game.f5_away_ml_strong_signal,
      f5_ou_edge: f5OuEdge,
      f5_fair_total: game.f5_fair_total,
      is_final_prediction: game.is_final_prediction,
    },
    accuracy_signals: accuracySignals,
    perfect_storm: perfectStormTags.length > 0 ? perfectStormTags : null,
    weather: {
      temperature_f: (game as Record<string, unknown>).temperature_f ?? null,
      wind_speed_mph: (game as Record<string, unknown>).wind_speed_mph ?? null,
      wind_direction: (game as Record<string, unknown>).wind_direction ?? null,
      sky: (game as Record<string, unknown>).sky ?? null,
      weather_confirmed: game.weather_confirmed ?? null,
    },
    signals: allSignals.length > 0 ? allSignals : null,
    polymarket,
    game_data_complete: {
      source_table: 'mlb_games_today',
      raw_game_data: game,
    },
  };
}

// Pick the side (home/away) the model favors based on edge_pct, mirroring
// the regression report's `side = "home" if h_edge >= a_edge else "away"`
// logic. Returns null if both edges are missing. Also returns the
// favorite/underdog tag for the picked side (used for full_ml bucket
// lookup, which is sliced by fav/dog).
function pickModelSide(
  homeEdge: number | null,
  awayEdge: number | null,
  homeML: number | null,
  awayML: number | null,
): { side: 'home' | 'away'; edge: number; favDog: 'favorite' | 'underdog' | null } | null {
  if (homeEdge == null && awayEdge == null) return null;
  const h = homeEdge ?? -Infinity;
  const a = awayEdge ?? -Infinity;
  const side: 'home' | 'away' = h >= a ? 'home' : 'away';
  const edge = side === 'home' ? (homeEdge ?? 0) : (awayEdge ?? 0);
  const ml = side === 'home' ? homeML : awayML;
  let favDog: 'favorite' | 'underdog' | null = null;
  if (typeof ml === 'number' && Number.isFinite(ml)) {
    favDog = ml < 0 ? 'favorite' : 'underdog';
  }
  return { side, edge, favDog };
}

interface AccuracyBlockArgs {
  bet_type: string;
  dow_label: string;
  home_abbr: string | null;
  away_abbr: string | null;
  bucket: string | null;
  side: string | null;
  fav_dog: string | null;
  direction: string | null;
  bucketRows: MLBBucketRow[];
  dowRoiIdx: Map<string, number | null>;
  teamRoiIdx: Map<string, number | null>;
  modelSide: string | null;          // for ML/RL: which team the model picks
  borrowedFrom?: string;             // set when we mirror ML buckets onto RL
}

// One accuracy_signals sub-block per bet type. Surfaces the three ROI
// inputs the regression report uses to compute acc_score:
//   - dow_roi_pct: bet type performance on this day-of-week
//   - team ROI: subject team(s) performance for this bet type
//   - edge_bucket_roi_pct: bucket performance for this game's edge slice
// All ROI values are %; positive = profitable historically.
function buildAccuracyBlock(args: AccuracyBlockArgs): Record<string, unknown> {
  const isOu = args.bet_type === 'full_ou' || args.bet_type === 'f5_ou';
  const dowRoi = args.dowRoiIdx.get(`${args.bet_type}|${args.dow_label}`) ?? null;
  const homeTeamRoi = args.home_abbr
    ? args.teamRoiIdx.get(`${args.bet_type}|${args.home_abbr}`) ?? null
    : null;
  const awayTeamRoi = args.away_abbr
    ? args.teamRoiIdx.get(`${args.bet_type}|${args.away_abbr}`) ?? null
    : null;

  const bucketRow = args.bucket
    ? findMlbBucket(args.bucketRows, {
        bet_type: args.bet_type,
        bucket: args.bucket,
        side: args.side,
        fav_dog: args.fav_dog,
        direction: isOu && args.direction ? args.direction : null,
      })
    : null;

  const out: Record<string, unknown> = {
    dow_roi_pct: dowRoi,
    home_team_roi_pct: homeTeamRoi,
    away_team_roi_pct: awayTeamRoi,
    edge_bucket: args.bucket,
    edge_bucket_roi_pct: bucketRow?.roi_pct ?? null,
    edge_bucket_win_pct: bucketRow?.win_pct ?? null,
    edge_bucket_sample: bucketRow?.games ?? null,
    model_side: args.modelSide,                 // 'home' | 'away' | null (OU)
  };
  if (args.borrowedFrom) {
    out.note = `bucket signal mirrored from ${args.borrowedFrom} — RL is graded against the same edge bucket as the underlying ML pick`;
  }
  return out;
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

// Player props for the slate, keyed by game_id (the dryrun nflverse id, e.g.
// 2025_12_BUF_HOU). Mirrors the other per-game fetchers: one `.in` query, then
// group rows by game_id. Lives on the research (cfb) client alongside
// nfl_dryrun_games. NFL-only — no other sport has nfl_dryrun_props.
async function fetchNFLPropsByGameId(
  cfbClient: SupabaseClient,
  gameIds: string[]
): Promise<Map<string, Record<string, unknown>[]>> {
  const result = new Map<string, Record<string, unknown>[]>();
  if (gameIds.length === 0) return result;

  try {
    const { data, error } = await cfbClient
      .from('nfl_dryrun_props')
      .select('game_id, player_name, position, team, opponent, is_home, market, close_line, over_price, under_price, l3_avg, l5_avg, l10_avg, szn_avg, over_rate_l5, over_rate_l10, def_matchup_idx, report_status, flags')
      .in('game_id', gameIds);

    if (error || !data) {
      console.warn('[agentGameHelpers] NFL props fetch failed:', error?.message || 'No data');
      return result;
    }

    for (const row of data as Record<string, unknown>[]) {
      const gameId = String(row.game_id || '');
      if (!gameId) continue;
      if (!result.has(gameId)) result.set(gameId, []);
      result.get(gameId)!.push(formatNFLProp(row));
    }
  } catch (error) {
    console.warn('[agentGameHelpers] NFL props fetch threw:', (error as Error).message);
  }

  return result;
}

// Project one nfl_dryrun_props row to the agent-facing prop shape. is_bettable
// is the signal gate: a non-empty `flags` array means a validated P-flag fired,
// so the prop is bettable; everything else is read-only form context.
function formatNFLProp(row: Record<string, unknown>): Record<string, unknown> {
  const flags = Array.isArray(row.flags) ? row.flags : [];
  return {
    player_name: row.player_name,
    position: row.position,
    market: row.market,
    line: row.close_line,
    over_price: row.over_price,
    under_price: row.under_price,
    l5_avg: row.l5_avg,
    l10_avg: row.l10_avg,
    szn_avg: row.szn_avg,
    over_rate_l5: row.over_rate_l5,
    over_rate_l10: row.over_rate_l10,
    def_matchup_idx: row.def_matchup_idx,
    flags,
    is_bettable: Array.isArray(flags) && flags.length > 0,
  };
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
  h2hGames: Record<string, unknown>[],
  props: Record<string, unknown>[] = []
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
    // Player props are SIGNAL-GATED: only props with a non-empty `flags` array
    // (a validated P-flag fired) are bettable. is_bettable carries that gate to
    // the agent + the submit grounding check. See nfl_dryrun_props.flags.
    props: props.length > 0 ? props : null,
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
  // Prefer the explicit away_moneyline column from nba_input_values_view;
  // fall back to the complement formula only if the DB value is missing.
  const homeML = game.home_moneyline as number | null;
  const dbAwayML = game.away_moneyline as number | null;
  const awayML: number | null = dbAwayML
    ?? (homeML != null ? (homeML > 0 ? -(homeML + 100) : 100 - homeML) : null);
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
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab' | 'mlb',
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
