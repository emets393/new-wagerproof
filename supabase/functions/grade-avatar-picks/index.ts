import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { format } from 'https://esm.sh/date-fns@3.6.0';
import { toZonedTime } from 'https://esm.sh/date-fns-tz@3.0.0';

// =============================================================================
// Types
// =============================================================================

interface AvatarPick {
  id: string;
  avatar_id: string;
  game_id: string;
  sport: string;
  matchup: string;
  game_date: string;
  bet_type: 'spread' | 'moneyline' | 'total' | 'prop';
  /** Period of the bet. 'full' = whole game (all sports, DB default).
   *  'f5' = MLB first 5 innings. 'h1' = NFL/CFB first half.
   *  Defaults to 'full' on the row (DB CHECK + DEFAULT). Older picks
   *  written before migration 20260501140000 will read back as 'full'.
   *  gradePickFromView routes f5 → f5_* fields and h1 → h1_* fields.
   *  Prop picks are always 'full'. */
  period: 'full' | 'f5' | 'h1';
  pick_selection: string;
  // ── Player-prop columns (bet_type === 'prop', NFL-only). Copied verbatim by
  // submit_picks from get_props. prop_line is NULL for player_anytime_td (it
  // has no posted line). gradeProp routes these via the player_id bridge. ──
  prop_player?: string;
  prop_market?: string;
  prop_line?: number | null;
  prop_direction?: 'over' | 'under';
  odds: string | null;
  units: number;
  confidence: number;
  reasoning_text: string;
  key_factors: string[] | null;
  archived_game_data: Record<string, unknown>;
  result: 'won' | 'lost' | 'push' | 'pending';
  actual_result: string | null;
  graded_at: string | null;
}

interface GameResult {
  league: string;
  game_id: string;
  game_date: string;
  home_team: string;
  away_team: string;
  ml_result: string | null;
  spread_result: string | null;
  ou_result: string | null;
  /** Actual total runs (MLB only). Lets us grade O/U against the
   *  agent's picked line instead of trusting the closing-line ou_result,
   *  which is wrong when the line moved between pick time and close. */
  total_runs?: number | null;
  /** Actual final scores — used to render a useful actual_result string. */
  home_score?: number | null;
  away_score?: number | null;
  // ── F5 (first-5-innings) parallel fields, MLB only. ──
  // Populated from mlb_training_snapshots.f5_runs_scored / f5_runs_allowed
  // when both are non-null and result_filled_at is set. The grader routes
  // here for picks with period === 'f5'. RL grade against -0.5 (positive
  // margin only) instead of full-game's -1.5.
  f5_ml_result?: string | null;
  f5_home_score?: number | null;
  f5_away_score?: number | null;
  f5_total_runs?: number | null;
  f5_ou_result?: string | null;
  // ── H1 (first-half) parallel fields, NFL/CFB only. ──
  // Populated from football_game_results.h1_* when the game is final.
  // The grader routes here for picks with period === 'h1', mirroring the
  // F5 (MLB) branch: ML uses h1_ml_result; spread/total grade score-based
  // against h1_home_score / h1_away_score and the agent's picked line.
  h1_ml_result?: string | null;
  h1_spread_result?: string | null;
  h1_total_result?: string | null;
  h1_home_score?: number | null;
  h1_away_score?: number | null;
}

interface ParsedSpreadPick {
  team: string;
  spread: number;
}

interface ParsedTotalPick {
  direction: 'over' | 'under';
  line: number;
}

interface GradingResult {
  pick_id: string;
  result: 'won' | 'lost' | 'push';
  actual_result: string;
}

interface GradingSummary {
  total_processed: number;
  won: number;
  lost: number;
  push: number;
  skipped: number;
  errors: number;
  skipped_reasons?: Record<string, number>;
}

// --- Parlay types (avatar_parlays + avatar_parlay_legs) ---------------------
// A parlay is one staked ticket with N legs. Legs are graded with the SAME
// per-leg machinery straights use (gradePickFromView); the ticket finalizes
// only once every leg is graded. See .claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md
interface ParlayLeg {
  id: string;
  parlay_id: string;
  game_id: string;
  sport: string;
  matchup: string;
  game_date: string;
  bet_type: 'spread' | 'moneyline' | 'total' | 'prop';
  /** 'full' | 'f5' | 'h1'. All three are gradable here (matches the straight
   *  grader): 'f5' (MLB) routes to f5_* fields, 'h1' (NFL/CFB first half)
   *  routes to h1_* fields, both via gradePickFromView. Football results
   *  (full + h1) are looked up by game_id in football_game_results. */
  period: 'full' | 'f5' | 'h1';
  pick_selection: string;
  odds: string | null;
  // ── Player-prop columns (bet_type === 'prop', NFL-only). Mirror avatar_picks'
  // prop cols; written by submitParlay.ts, read by gradeProp via the player_id
  // bridge. NULL on non-prop legs. See migration 20260622000004. ──
  prop_player?: string;
  prop_market?: string;
  prop_line?: number | null;
  prop_direction?: 'over' | 'under';
  archived_game_data: Record<string, unknown>;
  leg_result: 'won' | 'lost' | 'push' | 'pending';
  graded_at: string | null;
}

interface AvatarParlay {
  id: string;
  avatar_id: string;
  sport: string;
  legs_count: number;
  combined_odds: string | null;
  units: number;
  result: 'won' | 'lost' | 'push' | 'pending';
  actual_result: string | null;
  graded_at: string | null;
  ai_audit_payload: Record<string, unknown> | null;
  target_date: string | null;
}

interface ParlaySummary {
  parlays_processed: number;
  legs_graded: number;
  won: number;
  lost: number;
  push: number;
  still_pending: number;
  errors: number;
}

/**
 * Convert American odds to decimal odds.
 *   a > 0  → 1 + a/100
 *   a < 0  → 1 + 100/|a|
 * Returns null for malformed / zero odds so the caller can decide how to
 * handle it (a leg with no usable price contributes 1.0 to the product, i.e.
 * even money, rather than silently zeroing the ticket).
 */
function americanToDecimal(odds: string | null | undefined): number | null {
  if (odds == null) return null;
  const str = String(odds).trim();
  if (!/^[+-]?[0-9]+$/.test(str)) return null;
  const a = parseInt(str, 10);
  if (a === 0) return null;
  return a > 0 ? 1 + a / 100 : 1 + 100 / Math.abs(a);
}

// =============================================================================
// Constants
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map each agent prop_market to its stat column in nfl_player_game_logs.
// anytime_td is a boolean column; the rest are numeric. Markets here mirror
// exactly the six get_props surfaces (NFL-only). See gradeProp below.
const PROP_MARKET_STAT: Record<string, string> = {
  player_pass_yds: 'pass_yds',
  player_pass_tds: 'pass_tds',
  player_rush_yds: 'rush_yds',
  player_reception_yds: 'rec_yds',
  player_receptions: 'receptions',
  player_anytime_td: 'anytime_td',
};

// =============================================================================
// Date Utilities
// =============================================================================

function getTodayInET(): string {
  const now = new Date();
  const easternTime = toZonedTime(now, 'America/New_York');
  return format(easternTime, 'yyyy-MM-dd');
}

function incrementSkipReason(summary: GradingSummary, reason: string): void {
  if (!summary.skipped_reasons) {
    summary.skipped_reasons = {};
  }
  summary.skipped_reasons[reason] = (summary.skipped_reasons[reason] || 0) + 1;
}

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (str.length >= 10) return str.slice(0, 10);
  return str;
}

function normalizeTeamName(value: string | null | undefined): string {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bst[.]?\b/g, 'saint')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMatchup(matchup: string | null | undefined): { away: string; home: string } | null {
  if (!matchup) return null;
  const raw = String(matchup).trim();
  const separators = [' @ ', ' vs ', ' v ', ' at '];
  for (const sep of separators) {
    const parts = raw.split(sep);
    if (parts.length === 2) {
      return { away: parts[0].trim(), home: parts[1].trim() };
    }
  }
  return null;
}

function getArchivedTeamNames(archivedGameData: Record<string, unknown> | null | undefined): { away: string | null; home: string | null } {
  const obj = archivedGameData || {};
  const awayCandidates = [
    obj.away_team,
    (obj.game_data_complete as Record<string, unknown> | undefined)?.away_team,
    (obj.game_data_complete as Record<string, unknown> | undefined)?.raw_game_data &&
      ((obj.game_data_complete as Record<string, unknown>).raw_game_data as Record<string, unknown>).away_team,
  ];
  const homeCandidates = [
    obj.home_team,
    (obj.game_data_complete as Record<string, unknown> | undefined)?.home_team,
    (obj.game_data_complete as Record<string, unknown> | undefined)?.raw_game_data &&
      ((obj.game_data_complete as Record<string, unknown>).raw_game_data as Record<string, unknown>).home_team,
  ];

  const away = awayCandidates.find(v => typeof v === 'string' && v.trim()) as string | undefined;
  const home = homeCandidates.find(v => typeof v === 'string' && v.trim()) as string | undefined;
  return { away: away ?? null, home: home ?? null };
}

function isLikelyPushLine(value: number): boolean {
  // Whole-number lines can push; half-point hooks generally cannot.
  return Number.isInteger(value);
}

// =============================================================================
// Pick Selection Parsing
// =============================================================================

/**
 * Strip the optional "F5 " period marker from a selection string before
 * parsing. The period is now tracked on the pick row itself, so the
 * marker in selection text is descriptive only — parsers should ignore it.
 * Matches standalone "F5" tokens at the start, end, or middle of the
 * string (case insensitive). Examples normalized:
 *   "F5 Under 4.5"          -> "Under 4.5"
 *   "Yankees F5 -0.5"       -> "Yankees -0.5"
 *   "Yankees F5 ML"         -> "Yankees ML"
 */
function stripF5Marker(selection: string): string {
  return selection
    .replace(/\bF5\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse spread pick selection like "Bills -3" or "Chiefs +3.5".
 * Accepts MLB F5 markers ("Yankees F5 -0.5") — the F5 token is stripped
 * before parsing because period is tracked on the pick row.
 */
function parseSpreadPick(selection: string): ParsedSpreadPick | null {
  const cleaned = stripF5Marker(selection);
  const match = cleaned.match(/^(.+?)\s*([+-]?\d+\.?\d*)$/);
  if (!match) {
    console.log(`[grade-avatar-picks] Could not parse spread selection: ${selection}`);
    return null;
  }
  return {
    team: match[1].trim(),
    spread: parseFloat(match[2]),
  };
}

/**
 * Parse total pick selection like "Over 48.5" or "Under 48.5".
 * Accepts MLB F5 markers ("F5 Under 4.5") — the F5 token is stripped
 * before parsing because period is tracked on the pick row.
 */
function parseTotalPick(selection: string): ParsedTotalPick | null {
  const cleaned = stripF5Marker(selection);
  const match = cleaned.match(/^(over|under)\s+(\d+\.?\d*)$/i);
  if (!match) {
    console.log(`[grade-avatar-picks] Could not parse total selection: ${selection}`);
    return null;
  }
  return {
    direction: match[1].toLowerCase() as 'over' | 'under',
    line: parseFloat(match[2]),
  };
}

/**
 * Parse moneyline pick selection like "Bills -150" or "Bills ML"
 * Returns the team name
 */
function parseMoneylinePick(selection: string): string | null {
  // Strip the optional MLB F5 marker first ("Yankees F5 ML" → "Yankees ML").
  // Period is on the pick row; the marker is descriptive only.
  let cleaned = stripF5Marker(selection).replace(/\s*ML$/i, '').trim();
  cleaned = cleaned.replace(/\s*[+-]\d+$/, '').trim();
  if (!cleaned) {
    console.log(`[grade-avatar-picks] Could not parse moneyline selection: ${selection}`);
    return null;
  }
  return cleaned;
}

// =============================================================================
// Game Results from all_game_results View (CFB Supabase)
// =============================================================================

/**
 * Fetch pre-computed game results from the all_game_results view.
 * Returns a Map keyed by game_id for O(1) lookup.
 */
async function fetchGameResults(
  cfbClient: SupabaseClient,
  league: string,
  gameDates: string[]
): Promise<Map<string, GameResult>> {
  const results = new Map<string, GameResult>();
  if (gameDates.length === 0) return results;

  const { data, error } = await cfbClient
    .from('all_game_results')
    .select('*')
    .eq('league', league.toUpperCase())
    .in('game_date', gameDates);

  if (error) {
    console.error(`[grade-avatar-picks] Error fetching game results for ${league}:`, error);
    return results;
  }

  for (const row of data || []) {
    results.set(row.game_id, row as GameResult);
  }

  console.log(`[grade-avatar-picks] Fetched ${results.size} ${league.toUpperCase()} game results for dates: ${gameDates.join(', ')}`);
  return results;
}

// =============================================================================
// MLB Game Results from mlb_training_snapshots (CFB Supabase)
// =============================================================================

/**
 * Fetch MLB game results from the mlb_training_snapshots table.
 * Each game has TWO rows (home + away). We query the home row to get one row
 * per game and compute ml_result, spread_result, and ou_result.
 *
 * - ml_result: winning team name (from `won` boolean)
 * - spread_result: team that covered the standard -1.5 run line, or 'PUSH'
 * - ou_result: 'over', 'under', or 'push' (directly from the column)
 */
async function fetchMLBGameResults(
  cfbClient: SupabaseClient,
  gameDates: string[]
): Promise<Map<string, GameResult>> {
  const results = new Map<string, GameResult>();
  if (gameDates.length === 0) return results;

  const { data, error } = await cfbClient
    .from('mlb_training_snapshots')
    .select('game_pk, official_date, team_name, opp_team_name, home_away, runs_scored, runs_allowed, won, ou_result, f5_runs_scored, f5_runs_allowed, f5_ou_result, result_filled_at')
    .eq('home_away', 'home')
    .not('result_filled_at', 'is', null)
    .in('official_date', gameDates);

  if (error) {
    console.error('[grade-avatar-picks] Error fetching MLB game results from mlb_training_snapshots:', error);
    return results;
  }

  for (const row of data || []) {
    const gameId = String(row.game_pk);
    const homeTeam = String(row.team_name);
    const awayTeam = String(row.opp_team_name);
    const homeScore = Number(row.runs_scored) || 0;
    const awayScore = Number(row.runs_allowed) || 0;
    const margin = homeScore - awayScore; // positive = home won

    // ML result: which team won
    const mlResult = row.won ? homeTeam : awayTeam;

    // Spread result: standard MLB run line is -1.5 / +1.5
    // Winner by 2+ covers -1.5; winner by exactly 1 means the loser covers +1.5
    let spreadResult: string | null = null;
    if (margin > 1.5) {
      // Home won by 2+ → home covers -1.5
      spreadResult = homeTeam;
    } else if (margin < -1.5) {
      // Away won by 2+ → away covers -1.5
      spreadResult = awayTeam;
    } else if (margin === 1) {
      // Home won by exactly 1 → away covers +1.5
      spreadResult = awayTeam;
    } else if (margin === -1) {
      // Away won by exactly 1 → home covers +1.5
      spreadResult = homeTeam;
    }
    // margin === 0 shouldn't happen in baseball (no ties in completed games)

    // ── First-5 fields. F5 can tie (margin === 0) when both teams score
    // equal runs through 5, so f5_ml_result needs to handle that case.
    // F5 RL is typically -0.5 / +0.5 — winner by ANY runs covers -0.5,
    // tie pushes -0.5 (impossible if tied f5 runs scored), and loser
    // never covers +0.5 (since they didn't lose). The actual grading
    // happens in gradePickFromView via f5_home_score/f5_away_score margin.
    const hasF5 = row.f5_runs_scored != null && row.f5_runs_allowed != null;
    const f5HomeScore = hasF5 ? Number(row.f5_runs_scored) : null;
    const f5AwayScore = hasF5 ? Number(row.f5_runs_allowed) : null;
    let f5MlResult: string | null = null;
    if (hasF5 && f5HomeScore != null && f5AwayScore != null) {
      if (f5HomeScore > f5AwayScore) f5MlResult = homeTeam;
      else if (f5AwayScore > f5HomeScore) f5MlResult = awayTeam;
      else f5MlResult = 'push';  // tied through 5 = F5 ML push
    }

    results.set(gameId, {
      league: 'MLB',
      game_id: gameId,
      game_date: String(row.official_date),
      home_team: homeTeam,
      away_team: awayTeam,
      ml_result: mlResult,
      spread_result: spreadResult,
      ou_result: row.ou_result ? String(row.ou_result) : null,
      total_runs: homeScore + awayScore,
      home_score: homeScore,
      away_score: awayScore,
      // F5 parallels — null for any game without F5 data captured.
      f5_ml_result: f5MlResult,
      f5_home_score: f5HomeScore,
      f5_away_score: f5AwayScore,
      f5_total_runs: hasF5 && f5HomeScore != null && f5AwayScore != null
        ? f5HomeScore + f5AwayScore
        : null,
      f5_ou_result: row.f5_ou_result ? String(row.f5_ou_result) : null,
    });
  }

  console.log(`[grade-avatar-picks] Fetched ${results.size} MLB game results for dates: ${gameDates.join(', ')}`);
  return results;
}

// =============================================================================
// NFL/CFB Game Results from football_game_results view (RESEARCH Supabase)
// =============================================================================

/**
 * Fetch NFL/CFB game results from the football_game_results view.
 *
 * UNLIKE NBA/NCAAB (fetched by date) and MLB, football results are looked up
 * by `game_id` — NFL uses the nflverse scheme, CFB uses the CFBD id, and the
 * agent's pick already stores that exact `game_id`. We therefore query
 * `.in('game_id', gameIds)` and return a Map keyed by game_id for O(1) lookup.
 *
 * The view exposes both precomputed result strings (ml/spread/ou + h1_*) and
 * raw scores. We map ML straight from `ml_result`/`h1_ml_result`, but spread
 * and total are graded SCORE-BASED in gradePickFromView (against the agent's
 * picked line, not the view's closing-line result) — same as the MLB path.
 * See .claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md §"NFL/CFB grading".
 */
async function fetchFootballGameResults(
  cfbClient: SupabaseClient,
  gameIds: string[]
): Promise<Map<string, GameResult>> {
  const results = new Map<string, GameResult>();
  if (gameIds.length === 0) return results;

  const { data, error } = await cfbClient
    .from('football_game_results')
    .select('league, game_id, game_date, home_team, away_team, home_score, away_score, h1_home_score, h1_away_score, ml_result, spread_result, ou_result, h1_ml_result, h1_spread_result, h1_total_result')
    .in('game_id', gameIds);

  if (error) {
    console.error('[grade-avatar-picks] Error fetching football game results from football_game_results:', error);
    return results;
  }

  for (const row of data || []) {
    const gameId = String(row.game_id);
    results.set(gameId, {
      league: row.league ? String(row.league) : '',
      game_id: gameId,
      game_date: String(row.game_date),
      home_team: String(row.home_team),
      away_team: String(row.away_team),
      ml_result: row.ml_result != null ? String(row.ml_result) : null,
      spread_result: row.spread_result != null ? String(row.spread_result) : null,
      ou_result: row.ou_result != null ? String(row.ou_result) : null,
      home_score: row.home_score != null ? Number(row.home_score) : null,
      away_score: row.away_score != null ? Number(row.away_score) : null,
      // H1 parallels — null until the game is final / 1H scores are filled.
      h1_ml_result: row.h1_ml_result != null ? String(row.h1_ml_result) : null,
      h1_spread_result: row.h1_spread_result != null ? String(row.h1_spread_result) : null,
      h1_total_result: row.h1_total_result != null ? String(row.h1_total_result) : null,
      h1_home_score: row.h1_home_score != null ? Number(row.h1_home_score) : null,
      h1_away_score: row.h1_away_score != null ? Number(row.h1_away_score) : null,
    });
  }

  console.log(`[grade-avatar-picks] Fetched ${results.size} football game results for game_ids: ${gameIds.join(', ')}`);
  return results;
}

// =============================================================================
// NFL Player-Prop Grading Data (nfl_dryrun_props + nfl_player_game_logs, RESEARCH)
// =============================================================================

/**
 * Fetch the two tables needed to grade NFL player props, both on the RESEARCH
 * project (read via the same cfbClient as fetchFootballGameResults).
 *
 * 1. BRIDGE — `nfl_dryrun_props` carries `player_id` alongside the verbatim
 *    `(game_id, player_name, market)` the agent copied into the pick. Direct
 *    name→stat matching is only ~74% reliable, so we resolve the agent pick to
 *    its dryrun-props row by `(game_id, lower(player_name), market)` (unique) to
 *    get a stable `player_id`. Keyed `${game_id}::${player.toLowerCase()}::${market}`.
 * 2. STATS — `nfl_player_game_logs` holds the realized stat columns keyed by
 *    `(player_id, season, week)` (parsed from the pick's game_id). Keyed
 *    `${player_id}::${season}::${week}`.
 *
 * Defensive (same style as fetchFootballGameResults): any error → empty maps, so
 * every prop pick stays pending rather than false-grading. A missing bridge or
 * stats row also yields a miss in gradeProp → null → pending.
 */
async function fetchPropGradingData(
  cfbClient: SupabaseClient,
  propPicks: AvatarPick[],
): Promise<{ bridge: Map<string, string>; stats: Map<string, Record<string, unknown>> }> {
  const bridge = new Map<string, string>();
  const stats = new Map<string, Record<string, unknown>>();
  if (propPicks.length === 0) return { bridge, stats };

  try {
    // Distinct game_ids across the pending prop picks.
    const gameIds = [...new Set(propPicks.map(p => p.game_id).filter(Boolean))];
    if (gameIds.length === 0) return { bridge, stats };

    // 1. Bridge: nfl_dryrun_props → player_id, keyed by (game_id, player, market).
    const { data: bridgeRows, error: bridgeErr } = await cfbClient
      .from('nfl_dryrun_props')
      .select('game_id, player_name, market, player_id')
      .in('game_id', gameIds);

    if (bridgeErr) {
      console.error('[grade-avatar-picks] Error fetching nfl_dryrun_props (prop bridge):', bridgeErr);
      return { bridge, stats };
    }

    for (const row of bridgeRows || []) {
      if (row.player_id == null) continue;
      const key = `${String(row.game_id)}::${String(row.player_name ?? '').toLowerCase()}::${String(row.market ?? '')}`;
      bridge.set(key, String(row.player_id));
    }

    // 2. Stats: nfl_player_game_logs keyed by (player_id, season, week). Collect
    //    the distinct (season, week) pairs from the prop picks' game_ids
    //    ("{season}_{week}_{AWAY}_{HOME}") and fetch all logs for those weeks.
    const seasons = new Set<number>();
    const weeks = new Set<number>();
    for (const id of gameIds) {
      const parts = id.split('_');
      const season = Number(parts[0]);
      const week = Number(parts[1]);
      if (Number.isFinite(season)) seasons.add(season);
      if (Number.isFinite(week)) weeks.add(week);
    }

    if (seasons.size > 0 && weeks.size > 0) {
      const { data: statRows, error: statErr } = await cfbClient
        .from('nfl_player_game_logs')
        .select('player_id, season, week, pass_yds, pass_tds, rush_yds, rec_yds, receptions, anytime_td')
        .in('season', [...seasons])
        .in('week', [...weeks]);

      if (statErr) {
        console.error('[grade-avatar-picks] Error fetching nfl_player_game_logs (prop stats):', statErr);
        return { bridge, stats };
      }

      for (const row of statRows || []) {
        const key = `${String(row.player_id)}::${Number(row.season)}::${Number(row.week)}`;
        stats.set(key, row as Record<string, unknown>);
      }
    }

    console.log(`[grade-avatar-picks] Prop grading data: ${bridge.size} bridge rows, ${stats.size} stat rows for ${gameIds.length} game_ids`);
    return { bridge, stats };
  } catch (error) {
    console.error('[grade-avatar-picks] Unexpected error fetching prop grading data:', error);
    return { bridge, stats };
  }
}

/**
 * Grade one NFL player-prop pick via the player_id bridge.
 *
 * Returns the SAME shape as gradePickFromView. Returns null (pick stays pending)
 * whenever the bridge row or the stats row is missing — NEVER false-grade a
 * player we can't positively resolve. Coverage ceiling is ~77% for the dryrun
 * week (game-log completeness), so misses are expected and must stay pending.
 *
 * - anytime_td: graded against the boolean `anytime_td`. over → won if true;
 *   under → won if false. No push.
 * - lined markets: graded against the numeric stat vs the pick's prop_line and
 *   direction, with a push on an exact tie (same over/under math as totals).
 */
function gradeProp(
  pick: AvatarPick,
  bridge: Map<string, string>,
  stats: Map<string, Record<string, unknown>>,
): { result: 'won' | 'lost' | 'push'; actual_result: string } | null {
  const parts = pick.game_id.split('_');
  const season = Number(parts[0]);
  const week = Number(parts[1]);
  const player = pick.prop_player ?? '';
  const market = pick.prop_market ?? '';
  const direction = pick.prop_direction;
  const dirLabel = direction === 'over' ? 'Over' : 'Under';

  // Bridge: pick → player_id. Miss → stays pending (no false grade).
  const playerId = bridge.get(`${pick.game_id}::${player.toLowerCase()}::${market}`);
  if (!playerId) {
    console.log(`[grade-avatar-picks][prop] no bridge row for pick=${pick.id} game=${pick.game_id} player="${player}" market=${market} — staying pending`);
    return null;
  }

  // Stats row for (player_id, season, week). Miss → stays pending.
  const row = stats.get(`${playerId}::${season}::${week}`);
  if (!row) {
    console.log(`[grade-avatar-picks][prop] no stats row for pick=${pick.id} player_id=${playerId} season=${season} week=${week} — staying pending`);
    return null;
  }

  const statCol = PROP_MARKET_STAT[market];
  if (!statCol) {
    console.log(`[grade-avatar-picks][prop] unknown prop_market="${market}" for pick=${pick.id} — staying pending`);
    return null;
  }
  const actual = row[statCol];

  // anytime_td — boolean outcome, no push.
  if (market === 'player_anytime_td') {
    const scored = actual === true;
    let result: 'won' | 'lost' | 'push';
    if (direction === 'over') result = scored ? 'won' : 'lost';
    else result = scored ? 'lost' : 'won'; // under: win when NO TD
    return {
      result,
      actual_result: `${player} anytime TD: ${scored ? 'yes' : 'no'} (${dirLabel}) → ${result}`,
    };
  }

  // Lined markets — numeric stat vs the pick's picked line.
  const line = pick.prop_line;
  const actualNum = typeof actual === 'number' ? actual : Number(actual);
  if (line == null || !Number.isFinite(actualNum)) {
    console.log(`[grade-avatar-picks][prop] missing line/stat for pick=${pick.id} market=${market} line=${line} actual=${String(actual)} — staying pending`);
    return null;
  }

  let result: 'won' | 'lost' | 'push';
  if (actualNum > line) {
    result = direction === 'over' ? 'won' : 'lost';
  } else if (actualNum < line) {
    result = direction === 'under' ? 'won' : 'lost';
  } else {
    result = 'push'; // exact tie on the line
  }
  return {
    result,
    actual_result: `${player} ${statCol} ${actualNum} vs ${line} ${dirLabel} → ${result}`,
  };
}

// =============================================================================
// Team Name Resolution
// =============================================================================

/**
 * Resolve an abbreviated team name from pick_selection (e.g., "Lakers") to the
 * canonical full name from the view (e.g., "Los Angeles Lakers").
 *
 * Strategy:
 *   1. Direct match against home_team / away_team
 *   2. Substring match (either direction)
 *   3. Matchup fallback — parse "Away @ Home" and substring-match
 */
function resolveCanonicalTeamName(
  pickedTeam: string,
  gameResult: GameResult,
  matchup: string | null,
  archivedGameData: Record<string, unknown> | null
): string | null {
  const picked = normalizeTeamName(pickedTeam);
  const home = normalizeTeamName(gameResult.home_team);
  const away = normalizeTeamName(gameResult.away_team);
  if (!picked) return null;

  // Direct match
  if (picked === home) return gameResult.home_team;
  if (picked === away) return gameResult.away_team;

  // Substring match, but avoid ambiguous two-sided matches.
  const homeContains = home.includes(picked) || picked.includes(home);
  const awayContains = away.includes(picked) || picked.includes(away);
  if (homeContains && !awayContains) return gameResult.home_team;
  if (awayContains && !homeContains) return gameResult.away_team;

  // Matchup fallback: infer side first, then map to canonical game-result side.
  if (matchup) {
    const parsed = parseMatchup(matchup);
    if (parsed) {
      const matchupAway = normalizeTeamName(parsed.away);
      const matchupHome = normalizeTeamName(parsed.home);
      const homeSideMatch = matchupHome.includes(picked) || picked.includes(matchupHome);
      const awaySideMatch = matchupAway.includes(picked) || picked.includes(matchupAway);
      if (homeSideMatch && !awaySideMatch) {
        return gameResult.home_team;
      }
      if (awaySideMatch && !homeSideMatch) {
        return gameResult.away_team;
      }
    }
  }

  // Archived game data fallback (exact game context at pick time).
  const archivedTeams = getArchivedTeamNames(archivedGameData);
  const archivedAway = normalizeTeamName(archivedTeams.away);
  const archivedHome = normalizeTeamName(archivedTeams.home);
  const archivedHomeMatch = archivedHome && (archivedHome.includes(picked) || picked.includes(archivedHome));
  const archivedAwayMatch = archivedAway && (archivedAway.includes(picked) || picked.includes(archivedAway));
  if (archivedHomeMatch && !archivedAwayMatch) return gameResult.home_team;
  if (archivedAwayMatch && !archivedHomeMatch) return gameResult.away_team;

  console.log(`[grade-avatar-picks] Could not resolve "${pickedTeam}" to canonical name for ${gameResult.away_team} @ ${gameResult.home_team}`);
  return null;
}

// =============================================================================
// Pick Grading Using View's Pre-Computed Results
// =============================================================================

/**
 * Grade a single pick using the view's ml_result, spread_result, ou_result.
 * Returns null if the game isn't final yet (result columns are null).
 */
function gradePickFromView(
  pick: AvatarPick,
  gameResult: GameResult
): { result: 'won' | 'lost' | 'push'; actual_result: string } | null {
  const actualResultPrefix = `${gameResult.away_team} vs ${gameResult.home_team}`;
  // Period-aware routing. Non-MLB/football picks have period === 'full'
  // by default (DB column default) so the full-game branches still apply.
  // For F5 (MLB) picks, swap in the f5_* parallel fields; for H1 (NFL/CFB
  // first-half) picks, swap in the h1_* parallel fields. If the period
  // fields are missing (e.g. game not final yet, or older data captured
  // before period results were recorded), return null so the pick stays
  // pending — never silently grade a period bet against full-game results.
  const isF5 = pick.period === 'f5';
  const isH1 = pick.period === 'h1';
  const periodLabel = isF5 ? 'F5' : isH1 ? '1H' : 'Final';

  switch (pick.bet_type) {
    case 'moneyline': {
      // Period routing: F5 → f5_ml_result (MLB), H1 → h1_ml_result (NFL/CFB),
      // else full-game ml_result. Missing period result → stays pending.
      const mlResult = isF5 ? gameResult.f5_ml_result : isH1 ? gameResult.h1_ml_result : gameResult.ml_result;
      if (!mlResult) {
        if (isF5) console.log(`[grade-avatar-picks][f5_ml] no F5 result yet for pick=${pick.id} game=${pick.game_id}`);
        if (isH1) console.log(`[grade-avatar-picks][h1_ml] no 1H result yet for pick=${pick.id} game=${pick.game_id}`);
        return null;
      }

      const pickedTeam = parseMoneylinePick(pick.pick_selection);
      if (!pickedTeam) return null;

      const canonical = resolveCanonicalTeamName(pickedTeam, gameResult, pick.matchup, pick.archived_game_data);
      if (!canonical) return null;

      // F5/H1 ML can push when both teams score equally in the period.
      let result: 'won' | 'lost' | 'push';
      if (mlResult === 'push') {
        result = 'push';
      } else {
        result = canonical === mlResult ? 'won' : 'lost';
      }
      return {
        result,
        actual_result: `${actualResultPrefix} — ${periodLabel} ML winner: ${mlResult}`,
      };
    }

    case 'spread': {
      // Grade against the AGENT'S signed spread. The old logic just
      // checked "did the picked team match spread_result", which broke
      // in 1-run games:
      //   - "WinningTeam +1.5" (won outright) was graded LOST because
      //     spread_result pointed at the losing team (who covered +1.5).
      //   - "LosingTeam -1.5" (lost outright) was graded WON because
      //     spread_result also pointed at the losing team.
      // The correct math is (margin from picked team's perspective)
      // + (signed picked spread). Positive → won, negative → lost,
      // zero → push (impossible on ±1.5, possible on whole-number lines).
      console.log(`[grade-avatar-picks][spread] pick=${pick.id} game=${pick.game_id} selection="${pick.pick_selection}"`);

      const parsed = parseSpreadPick(pick.pick_selection);
      if (!parsed) {
        console.log(`[grade-avatar-picks][spread] PARSE_FAIL pick=${pick.id} selection="${pick.pick_selection}"`);
        return null;
      }

      const canonical = resolveCanonicalTeamName(parsed.team, gameResult, pick.matchup, pick.archived_game_data);
      if (!canonical) {
        console.log(`[grade-avatar-picks][spread] CANONICAL_FAIL pick=${pick.id} parsed_team="${parsed.team}" matchup="${pick.matchup}"`);
        return null;
      }

      let result: 'won' | 'lost' | 'push';
      let actual: string;

      // Score-based path (MLB always; NFL/CFB via football_game_results):
      // grade against actual margin. For F5 picks route to f5_home_score /
      // f5_away_score; for H1 (NFL/CFB) picks route to h1_home_score /
      // h1_away_score. Same math: margin (from picked side) + signed spread,
      // positive = won, negative = lost, zero = push (only on whole lines).
      const homeScoreForGrade = isF5 ? gameResult.f5_home_score : isH1 ? gameResult.h1_home_score : gameResult.home_score;
      const awayScoreForGrade = isF5 ? gameResult.f5_away_score : isH1 ? gameResult.h1_away_score : gameResult.away_score;
      if (typeof homeScoreForGrade === 'number' && typeof awayScoreForGrade === 'number') {
        const homeNorm = normalizeTeamName(gameResult.home_team);
        const canonNorm = normalizeTeamName(canonical);
        const margin = canonNorm === homeNorm
          ? (homeScoreForGrade - awayScoreForGrade)
          : (awayScoreForGrade - homeScoreForGrade);
        const cover = margin + parsed.spread;
        if (cover > 0) result = 'won';
        else if (cover < 0) result = 'lost';
        else result = 'push';
        actual = `${actualResultPrefix} — ${periodLabel} ${awayScoreForGrade}-${homeScoreForGrade} (${canonical} margin ${margin >= 0 ? '+' : ''}${margin} vs spread ${parsed.spread >= 0 ? '+' : ''}${parsed.spread})`;
      } else if (isF5) {
        // F5 picks need F5 scores — never fall through to full-game scores.
        console.log(`[grade-avatar-picks][f5_spread] no F5 scores for pick=${pick.id} game=${pick.game_id}`);
        return null;
      } else if (isH1) {
        // H1 picks need 1H scores — never fall through to full-game scores.
        console.log(`[grade-avatar-picks][h1_spread] no 1H scores for pick=${pick.id} game=${pick.game_id}`);
        return null;
      } else {
        // Non-MLB fallback: trust the view's spread_result. This can
        // misgrade ±N.5 picks where the team and spread direction
        // don't both match — that's a pre-existing bug for NBA/NCAAB
        // we'll address separately if needed.
        if (!gameResult.spread_result) return null;
        const normalizedSpreadResult = normalizeTeamName(gameResult.spread_result);
        const normalizedCanonical = normalizeTeamName(canonical);
        if (normalizedSpreadResult === 'push') {
          if (!isLikelyPushLine(parsed.spread)) return null;
          result = 'push';
        } else if (normalizedCanonical === normalizedSpreadResult) {
          result = 'won';
        } else {
          result = 'lost';
        }
        actual = `${actualResultPrefix} — Spread: ${gameResult.spread_result}`;
      }

      console.log(`[grade-avatar-picks][spread] OK pick=${pick.id} result=${result} canonical="${canonical}" parsed_spread=${parsed.spread}`);
      return { result, actual_result: actual };
    }

    case 'total': {
      const parsed = parseTotalPick(pick.pick_selection);
      if (!parsed) return null;

      // Grade against the AGENT'S picked line, not the closing line. The
      // upstream `ou_result` column is computed against `closing_total`,
      // which can drift between pick time and game time — e.g. agent
      // picks OVER 7.5, line moves to 8 by close, total lands at 8 →
      // closing-line says 'push' but pick at 7.5 should be a WIN.
      // Use total_runs (MLB) or fall back to ou_result (NBA/NCAAB
      // where the view's ou_result is trustworthy).
      let result: 'won' | 'lost' | 'push';
      let actual: string;

      // For F5 totals use f5_total_runs; for H1 (NFL/CFB) totals derive the
      // 1H total from h1_home_score + h1_away_score (score-based, graded
      // against the agent's picked line — same as MLB); otherwise full-game.
      const h1TotalForGrade = (isH1 && typeof gameResult.h1_home_score === 'number' && typeof gameResult.h1_away_score === 'number')
        ? gameResult.h1_home_score + gameResult.h1_away_score
        : null;
      const totalForGrade = isF5 ? gameResult.f5_total_runs : isH1 ? h1TotalForGrade : gameResult.total_runs;
      const homeScoreLabel = isF5 ? gameResult.f5_home_score : isH1 ? gameResult.h1_home_score : gameResult.home_score;
      const awayScoreLabel = isF5 ? gameResult.f5_away_score : isH1 ? gameResult.h1_away_score : gameResult.away_score;
      if (typeof totalForGrade === 'number') {
        const total = totalForGrade;
        if (total > parsed.line) {
          result = parsed.direction === 'over' ? 'won' : 'lost';
        } else if (total < parsed.line) {
          result = parsed.direction === 'under' ? 'won' : 'lost';
        } else {
          // total === parsed.line — only possible on whole-number lines.
          // Half-point hooks like 7.5 / 8.5 / 4.5 can never push since
          // totals are always integers; if we got here with a hook,
          // something is wrong upstream so return null and let it skip.
          if (!isLikelyPushLine(parsed.line)) return null;
          result = 'push';
        }
        actual = `${actualResultPrefix} — ${periodLabel} ${awayScoreLabel ?? '?'}-${homeScoreLabel ?? '?'} (total ${total} vs ${parsed.line})`;
      } else if (isF5) {
        // F5 totals can't fall back to full-game numbers. If we don't
        // have f5_total_runs the pick stays pending until grading runs
        // again with the F5 result populated.
        console.log(`[grade-avatar-picks][f5_total] no F5 total for pick=${pick.id} game=${pick.game_id}`);
        return null;
      } else if (isH1) {
        // H1 totals can't fall back to full-game numbers — never grade a
        // 1H bet against the full-game total. Stays pending until the 1H
        // scores are populated in football_game_results.
        console.log(`[grade-avatar-picks][h1_total] no 1H scores for pick=${pick.id} game=${pick.game_id}`);
        return null;
      } else {
        // Non-MLB fallback: trust the view's ou_result (computed against
        // whatever line that view uses).
        if (!gameResult.ou_result) return null;
        const ouResult = gameResult.ou_result.toLowerCase();
        if (ouResult === 'push') {
          if (!isLikelyPushLine(parsed.line)) return null;
          result = 'push';
        } else if (ouResult === parsed.direction) {
          result = 'won';
        } else {
          result = 'lost';
        }
        actual = `${actualResultPrefix} — Total: ${gameResult.ou_result}`;
      }

      return { result, actual_result: actual };
    }

    default:
      console.error(`[grade-avatar-picks] Unknown bet type: ${pick.bet_type}`);
      return null;
  }
}

// =============================================================================
// Game Lookup
// =============================================================================

/**
 * Find a GameResult for a pick. Tries game_id first, then falls back to
 * matching by game_date + team names parsed from the matchup string.
 */
function findGameResult(
  pick: AvatarPick,
  resultsMap: Map<string, GameResult>,
  allResults: GameResult[]
): GameResult | null {
  // Primary: lookup by game_id
  if (resultsMap.has(pick.game_id)) {
    return resultsMap.get(pick.game_id)!;
  }

  // NFL/CFB are keyed by game_id ONLY (nflverse / CFBD ids). The view isn't
  // fetched by date and team names don't normalize cleanly across feeds, so
  // never fall back to date/team matching for football — a miss means the
  // game isn't final yet and the pick should stay pending.
  if (pick.sport === 'nfl' || pick.sport === 'cfb') {
    console.log(`[grade-avatar-picks] No football game result for pick ${pick.id} (game_id: ${pick.game_id}) — staying pending`);
    return null;
  }

  const pickDate = toDateOnly(pick.game_date);
  const parsedMatchup = parseMatchup(pick.matchup);
  const archivedTeams = getArchivedTeamNames(pick.archived_game_data);
  const rawAway = normalizeTeamName(parsedMatchup?.away ?? archivedTeams.away);
  const rawHome = normalizeTeamName(parsedMatchup?.home ?? archivedTeams.home);

  // Fallback: match by game_date + robust team-name normalization.
  if (rawAway && rawHome && pickDate) {
    for (const result of allResults) {
      const resultDate = toDateOnly(result.game_date);
      if (!resultDate || resultDate !== pickDate) continue;

      const resultAway = normalizeTeamName(result.away_team);
      const resultHome = normalizeTeamName(result.home_team);

      const homeMatch = resultHome.includes(rawHome) || rawHome.includes(resultHome);
      const awayMatch = resultAway.includes(rawAway) || rawAway.includes(resultAway);

      if (homeMatch && awayMatch) {
        console.log(`[grade-avatar-picks] Matched pick ${pick.id} by team/date fallback: ${pick.matchup}`);
        return result;
      }
    }
  }

  console.log(`[grade-avatar-picks] No game result found for pick ${pick.id} (${pick.matchup}, game_id: ${pick.game_id})`);
  return null;
}

// =============================================================================
// Parlay Grading (avatar_parlays + avatar_parlay_legs)
// =============================================================================

/**
 * Grade pending parlays. Each NON-prop leg is graded with the SAME logic
 * straight picks use (gradePickFromView, against the same per-sport result
 * sources), then the ticket is rolled up ONLY when every leg is graded.
 *
 * Conservative gating (correctness-critical — this feeds real W-L + units):
 *   - prop legs ARE graded, via gradeProp (player_id bridge + game logs) — the
 *     same path straight prop picks use. A null (missing bridge/stats row) keeps
 *     that leg pending, which keeps the whole parlay pending (never false-grade).
 *   - any leg in an unsupported sport / not-final / parse-ambiguous stays
 *     pending, which keeps the whole parlay pending. We never finalize a
 *     ticket with an ungraded leg.
 * Football (NFL/CFB) full + h1 legs ARE graded: looked up by game_id in
 * football_game_results, with h1 routed to the h1_* fields by gradePickFromView.
 *
 * Roll-up (only when NO leg is pending):
 *   - any leg lost            → parlay 'lost'
 *   - else every leg won      → parlay 'won'
 *   - else (push + won, none lost): push legs DROP OUT; re-price on the
 *     surviving won legs (product of their decimal odds). No survivors
 *     (all push) → parlay 'push'.
 * The re-priced decimal is stored in ai_audit_payload.settled_decimal for the
 * payout step.
 */
async function gradeParlays(
  supabase: SupabaseClient,
  cfbClient: SupabaseClient,
  dryRun: boolean,
  affectedAvatars: Set<string>,
): Promise<ParlaySummary> {
  const summary: ParlaySummary = {
    parlays_processed: 0,
    legs_graded: 0,
    won: 0,
    lost: 0,
    push: 0,
    still_pending: 0,
    errors: 0,
  };

  // 1. Fetch pending parlays and their legs.
  const { data: pendingParlays, error: parlayErr } = await supabase
    .from('avatar_parlays')
    .select('*')
    .eq('result', 'pending');

  if (parlayErr) {
    console.error('[grade-avatar-picks][parlay] Failed to fetch pending parlays:', parlayErr);
    summary.errors++;
    return summary;
  }
  if (!pendingParlays || pendingParlays.length === 0) {
    console.log('[grade-avatar-picks][parlay] No pending parlays to grade');
    return summary;
  }

  const parlayIds = (pendingParlays as AvatarParlay[]).map(p => p.id);
  const { data: allLegs, error: legErr } = await supabase
    .from('avatar_parlay_legs')
    .select('*')
    .in('parlay_id', parlayIds);

  if (legErr) {
    console.error('[grade-avatar-picks][parlay] Failed to fetch parlay legs:', legErr);
    summary.errors++;
    return summary;
  }

  const legsByParlay = new Map<string, ParlayLeg[]>();
  for (const leg of (allLegs || []) as ParlayLeg[]) {
    const arr = legsByParlay.get(leg.parlay_id) ?? [];
    arr.push(leg);
    legsByParlay.set(leg.parlay_id, arr);
  }

  // 2. Batch-fetch game results per sport across ALL gradable legs at once,
  //    mirroring the straight-pick path. Only legs we will actually try to
  //    grade (non-prop, supported sport) contribute keys. NFL/CFB legs —
  //    including h1 — are looked up by game_id via football_game_results.
  const nbaDates = new Set<string>();
  const ncaabDates = new Set<string>();
  const mlbDates = new Set<string>();
  const footballGameIds = new Set<string>();
  for (const leg of (allLegs || []) as ParlayLeg[]) {
    if (leg.bet_type === 'prop') continue;
    if (leg.sport === 'nba') nbaDates.add(leg.game_date);
    else if (leg.sport === 'ncaab') ncaabDates.add(leg.game_date);
    else if (leg.sport === 'mlb') mlbDates.add(leg.game_date);
    else if (leg.sport === 'nfl' || leg.sport === 'cfb') footballGameIds.add(leg.game_id);
  }

  const [nbaResults, ncaabResults, mlbResults, footballResults] = await Promise.all([
    nbaDates.size > 0
      ? fetchGameResults(cfbClient, 'NBA', [...nbaDates])
      : Promise.resolve(new Map<string, GameResult>()),
    ncaabDates.size > 0
      ? fetchGameResults(cfbClient, 'NCAAB', [...ncaabDates])
      : Promise.resolve(new Map<string, GameResult>()),
    mlbDates.size > 0
      ? fetchMLBGameResults(cfbClient, [...mlbDates])
      : Promise.resolve(new Map<string, GameResult>()),
    footballGameIds.size > 0
      ? fetchFootballGameResults(cfbClient, [...footballGameIds])
      : Promise.resolve(new Map<string, GameResult>()),
  ]);

  const footballAll = [...footballResults.values()];
  const resultsByLeague: Record<string, { map: Map<string, GameResult>; all: GameResult[] }> = {
    nba: { map: nbaResults, all: [...nbaResults.values()] },
    ncaab: { map: ncaabResults, all: [...ncaabResults.values()] },
    mlb: { map: mlbResults, all: [...mlbResults.values()] },
    nfl: { map: footballResults, all: footballAll },
    cfb: { map: footballResults, all: footballAll },
  };

  // 2b. Prop legs grade off the player_id bridge (nfl_dryrun_props) +
  //     nfl_player_game_logs, NOT football_game_results — same path straight
  //     prop picks use. Fetch that data ONCE across every pending parlay's prop
  //     legs (fetchPropGradingData only reads .game_id, so a leg-shaped view is
  //     enough). A missing bridge/stats row → gradeProp null → leg stays pending.
  const propLegs = ((allLegs || []) as ParlayLeg[]).filter(l => l.bet_type === 'prop');
  const propData = propLegs.length > 0
    ? await fetchPropGradingData(cfbClient, propLegs as unknown as AvatarPick[])
    : null;

  // 3. Grade each parlay's legs, then roll up.
  for (const parlay of pendingParlays as AvatarParlay[]) {
    summary.parlays_processed++;
    try {
      const legs = legsByParlay.get(parlay.id) ?? [];
      if (legs.length === 0) {
        console.warn(`[grade-avatar-picks][parlay] Parlay ${parlay.id} has no legs — leaving pending`);
        summary.still_pending++;
        continue;
      }

      // --- Grade each not-yet-graded, gradable leg ---
      for (const leg of legs) {
        if (leg.leg_result !== 'pending') continue;          // already settled

        // Prop legs grade via gradeProp (player_id bridge + game logs), NOT the
        // football_game_results lookup below — the same path straight prop picks
        // use. A null (missing bridge/stats row) leaves this leg pending, which
        // keeps the whole parlay pending via the roll-up's anyPending gate.
        if (leg.bet_type === 'prop') {
          const propAsPick: AvatarPick = {
            id: leg.id,
            avatar_id: parlay.avatar_id,
            game_id: leg.game_id,
            sport: leg.sport,
            matchup: leg.matchup,
            game_date: leg.game_date,
            bet_type: 'prop',
            period: leg.period as AvatarPick['period'],
            pick_selection: leg.pick_selection,
            prop_player: leg.prop_player,
            prop_market: leg.prop_market,
            prop_line: leg.prop_line,
            prop_direction: leg.prop_direction,
            odds: leg.odds,
            units: 0,
            confidence: 0,
            reasoning_text: '',
            key_factors: null,
            archived_game_data: leg.archived_game_data,
            result: 'pending',
            actual_result: null,
            graded_at: null,
          };
          const propGrading = propData ? gradeProp(propAsPick, propData.bridge, propData.stats) : null;
          if (!propGrading) continue;                        // missing bridge/stats → stays pending

          leg.leg_result = propGrading.result;
          leg.graded_at = new Date().toISOString();
          summary.legs_graded++;
          if (!dryRun) {
            const { error: legUpdErr } = await supabase
              .from('avatar_parlay_legs')
              .update({ leg_result: propGrading.result, graded_at: leg.graded_at })
              .eq('id', leg.id);
            if (legUpdErr) {
              console.error(`[grade-avatar-picks][parlay] Failed to update prop leg ${leg.id}:`, legUpdErr);
              summary.errors++;
            }
          }
          console.log(`[grade-avatar-picks][parlay] Prop leg ${leg.id} → ${propGrading.result} (${propGrading.actual_result})`);
          continue;
        }
        // h1 (NFL/CFB first half) IS gradable now — gradePickFromView routes
        // it to the h1_* fields; football results are looked up by game_id.

        const leagueData = resultsByLeague[leg.sport];
        if (!leagueData) continue;                           // unsupported sport → stays pending

        // gradePickFromView/findGameResult read the same shape on a straight
        // pick; build an AvatarPick view over the leg so we reuse it verbatim.
        const legAsPick: AvatarPick = {
          id: leg.id,
          avatar_id: parlay.avatar_id,
          game_id: leg.game_id,
          sport: leg.sport,
          matchup: leg.matchup,
          game_date: leg.game_date,
          bet_type: leg.bet_type as AvatarPick['bet_type'],
          period: leg.period as AvatarPick['period'],
          pick_selection: leg.pick_selection,
          odds: leg.odds,
          units: 0,
          confidence: 0,
          reasoning_text: '',
          key_factors: null,
          archived_game_data: leg.archived_game_data,
          result: 'pending',
          actual_result: null,
          graded_at: null,
        };

        const gameResult = findGameResult(legAsPick, leagueData.map, leagueData.all);
        if (!gameResult) continue;                           // game not found yet → stays pending

        const grading = gradePickFromView(legAsPick, gameResult);
        if (!grading) continue;                              // not final / parse-ambiguous → stays pending

        // Persist the leg result (mutate local copy too so roll-up sees it).
        leg.leg_result = grading.result;
        leg.graded_at = new Date().toISOString();
        summary.legs_graded++;
        if (!dryRun) {
          const { error: legUpdErr } = await supabase
            .from('avatar_parlay_legs')
            .update({ leg_result: grading.result, graded_at: leg.graded_at })
            .eq('id', leg.id);
          if (legUpdErr) {
            console.error(`[grade-avatar-picks][parlay] Failed to update leg ${leg.id}:`, legUpdErr);
            summary.errors++;
          }
        }
        console.log(`[grade-avatar-picks][parlay] Leg ${leg.id} (${leg.bet_type}/${leg.period}) → ${grading.result}`);
      }

      // --- Roll up: only finalize when NO leg is pending ---
      const anyPending = legs.some(l => l.leg_result === 'pending');
      if (anyPending) {
        summary.still_pending++;
        continue;
      }

      const anyLost = legs.some(l => l.leg_result === 'lost');
      const survivors = legs.filter(l => l.leg_result === 'won');   // push legs drop out
      const wonCount = survivors.length;
      const pushCount = legs.filter(l => l.leg_result === 'push').length;

      let parlayResult: 'won' | 'lost' | 'push';
      let settledDecimal: number;   // 1.0 = no payout beyond stake (full push)

      if (anyLost) {
        parlayResult = 'lost';
        settledDecimal = 0;         // unused on a loss (payout = -units)
      } else if (survivors.length > 0) {
        // No leg lost and at least one won → 'won', re-priced on the surviving
        // won legs only (push legs already dropped out of `survivors`). When
        // every leg won this is just the product over all legs.
        parlayResult = 'won';
        settledDecimal = survivors.reduce(
          (acc, l) => acc * (americanToDecimal(l.odds) ?? 1),
          1,
        );
      } else {
        // No survivors → every leg pushed → ticket pushes (stake returned).
        parlayResult = 'push';
        settledDecimal = 1;
      }

      const actualResult = anyLost
        ? `${legs.filter(l => l.leg_result === 'lost').length}/${legs.length} legs lost`
        : pushCount > 0
          ? `${wonCount}/${legs.length} legs won, ${pushCount} push`
          : `${wonCount}/${legs.length} legs won`;

      // Preserve the rest of ai_audit_payload; stash settled_decimal for payout.
      const mergedAudit = {
        ...(parlay.ai_audit_payload ?? {}),
        settled_decimal: parlayResult === 'won' ? settledDecimal : (parlayResult === 'push' ? 1 : 0),
      };

      if (!dryRun) {
        const { error: parlayUpdErr } = await supabase
          .from('avatar_parlays')
          .update({
            result: parlayResult,
            actual_result: actualResult,
            graded_at: new Date().toISOString(),
            ai_audit_payload: mergedAudit,
          })
          .eq('id', parlay.id);
        if (parlayUpdErr) {
          console.error(`[grade-avatar-picks][parlay] Failed to finalize parlay ${parlay.id}:`, parlayUpdErr);
          summary.errors++;
          continue;
        }
      }

      summary[parlayResult]++;
      affectedAvatars.add(parlay.avatar_id);
      console.log(`[grade-avatar-picks][parlay] Parlay ${parlay.id} → ${parlayResult} (${actualResult}, settled_decimal=${mergedAudit.settled_decimal})`);
    } catch (error) {
      console.error(`[grade-avatar-picks][parlay] Error grading parlay ${parlay.id}:`, error);
      summary.errors++;
    }
  }

  console.log(`[grade-avatar-picks][parlay] Summary: ${JSON.stringify(summary)}`);
  return summary;
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[grade-avatar-picks] Starting pick grading...');

  try {
    let dryRun = false;
    let recalcAll = false;
    try {
      const body = await req.json();
      dryRun = Boolean((body as Record<string, unknown> | null)?.dry_run);
      recalcAll = Boolean((body as Record<string, unknown> | null)?.recalc_all);
    } catch {
      // Allow empty or non-JSON cron requests.
    }
    if (dryRun) {
      console.log('[grade-avatar-picks] Running in DRY RUN mode (no DB writes)');
    }

    // Initialize Main Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize CFB Supabase client (hosts all_game_results view)
    const cfbSupabaseUrl = Deno.env.get('CFB_SUPABASE_URL') ?? '';
    const cfbSupabaseKey = Deno.env.get('CFB_SUPABASE_ANON_KEY') ?? '';
    const cfbClient = (cfbSupabaseUrl && cfbSupabaseKey)
      ? createClient(cfbSupabaseUrl, cfbSupabaseKey)
      : null;

    if (!cfbClient) {
      console.warn('[grade-avatar-picks] CFB Supabase not configured — all picks will stay pending');
      return new Response(
        JSON.stringify({
          success: true,
          summary: { total_processed: 0, won: 0, lost: 0, push: 0, skipped: 0, errors: 0 },
          avatars_updated: [],
          details: [],
          warning: 'CFB Supabase not configured',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = getTodayInET();
    console.log(`[grade-avatar-picks] Today (ET): ${today}`);

    // -------------------------------------------------------------------------
    // 1. Fetch pending picks — NBA, NCAAB, MLB (by date) and NFL/CFB (by
    //    game_id via football_game_results). Football finals only populate
    //    when the dryrun build runs live, so off-season football picks just
    //    stay pending — no harm in including them in the filter.
    // -------------------------------------------------------------------------
    const { data: pendingPicks, error: fetchError } = await supabase
      .from('avatar_picks')
      .select('*')
      .eq('result', 'pending')
      .lte('game_date', today)
      .in('sport', ['nba', 'ncaab', 'mlb', 'nfl', 'cfb']);

    if (fetchError) {
      throw new Error(`Failed to fetch pending picks: ${fetchError.message}`);
    }

    // NOTE: don't early-return on zero pending straight picks — pending
    // PARLAYS still need grading below. The date-collection + grading loop
    // both no-op on an empty array, so we just fall through with [].
    const straightPicks: AvatarPick[] = (pendingPicks ?? []) as AvatarPick[];
    if (straightPicks.length === 0) {
      console.log('[grade-avatar-picks] No pending straight picks to grade (checking parlays)');
    } else {
      console.log(`[grade-avatar-picks] Found ${straightPicks.length} pending NBA/NCAAB/MLB picks to process`);
    }

    // -------------------------------------------------------------------------
    // 2. Collect unique game dates per league and batch fetch results
    // -------------------------------------------------------------------------
    const nbaDates = new Set<string>();
    const ncaabDates = new Set<string>();
    const mlbDates = new Set<string>();
    // NFL/CFB are looked up by game_id (not date) via football_game_results.
    const footballGameIds = new Set<string>();

    for (const pick of straightPicks) {
      if (pick.sport === 'nba') nbaDates.add(pick.game_date);
      else if (pick.sport === 'ncaab') ncaabDates.add(pick.game_date);
      else if (pick.sport === 'mlb') mlbDates.add(pick.game_date);
      else if (pick.sport === 'nfl' || pick.sport === 'cfb') footballGameIds.add(pick.game_id);
    }

    const [nbaResults, ncaabResults, mlbResults, footballResults] = await Promise.all([
      nbaDates.size > 0
        ? fetchGameResults(cfbClient, 'NBA', [...nbaDates])
        : Promise.resolve(new Map<string, GameResult>()),
      ncaabDates.size > 0
        ? fetchGameResults(cfbClient, 'NCAAB', [...ncaabDates])
        : Promise.resolve(new Map<string, GameResult>()),
      mlbDates.size > 0
        ? fetchMLBGameResults(cfbClient, [...mlbDates])
        : Promise.resolve(new Map<string, GameResult>()),
      footballGameIds.size > 0
        ? fetchFootballGameResults(cfbClient, [...footballGameIds])
        : Promise.resolve(new Map<string, GameResult>()),
    ]);

    // NFL and CFB share one football_game_results Map (each row carries its
    // own league); both sports resolve picks by game_id against it.
    const footballAll = [...footballResults.values()];
    const resultsByLeague: Record<string, { map: Map<string, GameResult>; all: GameResult[] }> = {
      nba: { map: nbaResults, all: [...nbaResults.values()] },
      ncaab: { map: ncaabResults, all: [...ncaabResults.values()] },
      mlb: { map: mlbResults, all: [...mlbResults.values()] },
      nfl: { map: footballResults, all: footballAll },
      cfb: { map: footballResults, all: footballAll },
    };

    // -------------------------------------------------------------------------
    // 3. Grade each pick
    // -------------------------------------------------------------------------
    const summary: GradingSummary = {
      total_processed: 0,
      won: 0,
      lost: 0,
      push: 0,
      skipped: 0,
      errors: 0,
    };
    const gradedDetails: GradingResult[] = [];
    const affectedAvatars = new Set<string>();

    // Prop picks don't live in football_game_results — they grade off the
    // player_id bridge (nfl_dryrun_props) + nfl_player_game_logs. Fetch that
    // data ONCE up front, only when there's at least one pending prop pick.
    const propPicks = straightPicks.filter(p => p.bet_type === 'prop');
    const hasProps = propPicks.length > 0;
    const propData = hasProps ? await fetchPropGradingData(cfbClient, propPicks) : null;

    for (const pick of straightPicks) {
      summary.total_processed++;

      try {
        // ── Prop picks: route to the prop grader and skip the game-result
        //    lookup entirely (props aren't in football_game_results). A null
        //    result (missing bridge/stats row) keeps the pick pending —
        //    identical downstream handling to a straight not-final skip. ──
        if (pick.bet_type === 'prop') {
          const grading = propData ? gradeProp(pick, propData.bridge, propData.stats) : null;
          if (!grading) {
            console.log(`[grade-avatar-picks] Skipping prop pick ${pick.id} — bridge/stats row missing (stays pending)`);
            summary.skipped++;
            incrementSkipReason(summary, 'prop_not_gradable');
            continue;
          }
          if (!dryRun) {
            const { error: updateError } = await supabase
              .from('avatar_picks')
              .update({
                result: grading.result,
                actual_result: grading.actual_result,
                graded_at: new Date().toISOString(),
                grading_skip_reason: null,
              })
              .eq('id', pick.id);
            if (updateError) {
              console.error(`[grade-avatar-picks] Failed to update prop pick ${pick.id}:`, updateError);
              summary.errors++;
              continue;
            }
          }
          summary[grading.result]++;
          affectedAvatars.add(pick.avatar_id);
          gradedDetails.push({
            pick_id: pick.id,
            result: grading.result,
            actual_result: grading.actual_result,
          });
          console.log(`[grade-avatar-picks] Graded prop pick ${pick.id}: ${grading.result} (${grading.actual_result})`);
          continue;
        }

        const leagueData = resultsByLeague[pick.sport];
        if (!leagueData) {
          summary.skipped++;
          incrementSkipReason(summary, 'unsupported_sport');
          continue;
        }

        const gameResult = findGameResult(pick, leagueData.map, leagueData.all);
        if (!gameResult) {
          // If the game date is at least 2 days behind today (ET) and
          // the game is still missing from the snapshots, treat it as
          // postponed / no-action and grade as a push. Industry standard
          // for postponed games is bet refund, which we represent as
          // 'push'. We use a 2-day buffer (not just "past today") to
          // avoid race conditions with late-night Pacific games whose
          // results haven't loaded yet.
          const pickDate = toDateOnly(pick.game_date);
          const todayDate = today;
          let dayDiff = 0;
          if (pickDate) {
            const a = new Date(pickDate + 'T00:00:00Z').getTime();
            const b = new Date(todayDate + 'T00:00:00Z').getTime();
            dayDiff = Math.round((b - a) / 86_400_000);
          }
          if (dayDiff >= 2) {
            console.log(`[grade-avatar-picks] Postponement push: pick ${pick.id} game_date=${pickDate} dayDiff=${dayDiff}`);
            summary.push++;
            if (!dryRun) {
              await supabase.from('avatar_picks').update({
                result: 'push',
                actual_result: `${pick.matchup} — postponed / no action`,
                graded_at: new Date().toISOString(),
                grading_skip_reason: 'game_postponed',
              }).eq('id', pick.id);
            }
            affectedAvatars.add(pick.avatar_id);
            gradedDetails.push({
              pick_id: pick.id,
              result: 'push',
              actual_result: `${pick.matchup} — postponed / no action`,
            });
            continue;
          }
          summary.skipped++;
          incrementSkipReason(summary, 'game_not_found');
          if (!dryRun) {
            await supabase.from('avatar_picks')
              .update({ grading_skip_reason: 'no_game_result_found' })
              .eq('id', pick.id);
          }
          continue;
        }

        const grading = gradePickFromView(pick, gameResult);
        if (!grading) {
          console.log(`[grade-avatar-picks] Skipping pick ${pick.id} — game not final or parse error`);
          summary.skipped++;
          incrementSkipReason(summary, 'not_final_or_parse_or_ambiguous');
          if (!dryRun) {
            await supabase.from('avatar_picks')
              .update({ grading_skip_reason: 'not_final_or_parse_error' })
              .eq('id', pick.id);
          }
          continue;
        }

        // Update the pick in database
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('avatar_picks')
            .update({
              result: grading.result,
              actual_result: grading.actual_result,
              graded_at: new Date().toISOString(),
              grading_skip_reason: null, // Clear any previous skip reason on successful grade
            })
            .eq('id', pick.id);

          if (updateError) {
            console.error(`[grade-avatar-picks] Failed to update pick ${pick.id}:`, updateError);
            summary.errors++;
            continue;
          }
        }

        summary[grading.result]++;
        affectedAvatars.add(pick.avatar_id);
        gradedDetails.push({
          pick_id: pick.id,
          result: grading.result,
          actual_result: grading.actual_result,
        });

        console.log(`[grade-avatar-picks] Graded pick ${pick.id}: ${grading.result} (${grading.actual_result})`);

      } catch (error) {
        console.error(`[grade-avatar-picks] Error grading pick ${pick.id}:`, error);
        summary.errors++;
      }
    }

    // -------------------------------------------------------------------------
    // 3b. Grade pending PARLAYS (reuses the same per-leg grader). Runs before
    //     the recalc loop so any avatar whose parlay just finalized is included
    //     in affectedAvatars and gets its performance recomputed below.
    // -------------------------------------------------------------------------
    const parlaySummary = await gradeParlays(supabase, cfbClient, dryRun, affectedAvatars);

    // -------------------------------------------------------------------------
    // 4. Recalculate performance for affected avatars (or ALL if recalc_all)
    // -------------------------------------------------------------------------
    const avatarsUpdated: string[] = [];

    if (recalcAll) {
      // Recalc ALL avatars that have any picks (for backfill after formula fixes)
      console.log('[grade-avatar-picks] recalc_all=true — recalculating ALL avatars');
      const { data: allAvatars, error: avatarFetchError } = await supabase
        .from('avatar_performance_cache')
        .select('avatar_id');

      if (avatarFetchError) {
        console.error('[grade-avatar-picks] Failed to fetch avatar list for recalc_all:', avatarFetchError);
      } else {
        for (const row of allAvatars || []) {
          affectedAvatars.add(row.avatar_id);
        }
      }
    }

    for (const avatarId of affectedAvatars) {
      if (dryRun) {
        avatarsUpdated.push(avatarId);
        continue;
      }
      try {
        const { error: recalcError } = await supabase.rpc('recalculate_avatar_performance', {
          p_avatar_id: avatarId,
        });

        if (recalcError) {
          console.error(`[grade-avatar-picks] Failed to recalculate performance for avatar ${avatarId}:`, recalcError);
        } else {
          avatarsUpdated.push(avatarId);
          console.log(`[grade-avatar-picks] Recalculated performance for avatar ${avatarId}`);
        }
      } catch (error) {
        console.error(`[grade-avatar-picks] Error recalculating avatar ${avatarId}:`, error);
      }
    }

    // -------------------------------------------------------------------------
    // 5. Return summary
    // -------------------------------------------------------------------------
    const duration = Date.now() - startTime;
    console.log(`[grade-avatar-picks] Completed in ${duration}ms`);
    console.log(`[grade-avatar-picks] Summary: ${JSON.stringify(summary)}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        parlay_summary: parlaySummary,
        avatars_updated: avatarsUpdated,
        details: gradedDetails,
        dry_run: dryRun,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[grade-avatar-picks] Unhandled error:', error);
    console.error('[grade-avatar-picks] Stack:', (error as Error).stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message || 'Unknown error',
        errorType: (error as Error).constructor.name,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
