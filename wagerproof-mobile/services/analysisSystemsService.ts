// Saved analysis "systems" CRUD + Systems Leaderboard (see
// .claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md).
//
// A saved system = a filter set + an explicit VERDICT (which side it bets) + the EXACT
// RPC payload the page queried with. Everything lives on the MAIN Supabase project
// (`mlb_analysis_saved_filters`); the nightly grader reproduces the page's numbers from
// rpc_bet_type + rpc_filters, so the client must store them verbatim. Filters are
// immutable post-save (editing = delete + resave), so only name / is_public are updatable.

import { supabase } from './supabase';
import type { MlbAnalysisBetType, MlbAnalysisFilterState } from '@/types/mlbHistoricalAnalysis';

/** Which side a system bets. team = the matching team, fade = against it. */
export type SystemVerdict = 'team' | 'fade' | 'over' | 'under';

/** {n,wins,losses,pushes,hit_pct,roi,units} — grader-computed record shape. */
export interface SystemRecord {
  n: number;
  wins: number;
  losses: number;
  pushes: number;
  hit_pct: number | null;
  roi: number | null;
  units: number | null;
}

/** A row from mlb_analysis_saved_filters owned by the current user. */
export interface SavedSystemRow {
  id: string;
  user_id: string;
  name: string;
  bet_type: string;
  filters: Record<string, unknown>;
  verdict: SystemVerdict | null;
  rpc_bet_type: string | null;
  rpc_filters: Record<string, unknown> | null;
  is_public: boolean;
  since_saved: SystemRecord | null;
  created_at: string;
}

export interface SaveSystemInput {
  userId: string;
  name: string;
  betType: MlbAnalysisBetType;
  /** Mobile filter state — stored verbatim for later restore. */
  filters: MlbAnalysisFilterState;
  verdict: SystemVerdict;
  /** EXACT object sent to mlb_analysis as p_filters (from buildMlbRpcFilters). */
  rpcFilters: Record<string, unknown>;
  isPublic: boolean;
}

const MLB_SAVED_TABLE = 'mlb_analysis_saved_filters';

/** Fetch the current user's saved MLB systems, newest first. */
export async function fetchMySystems(userId: string): Promise<SavedSystemRow[]> {
  const { data, error } = await supabase
    .from(MLB_SAVED_TABLE)
    .select('id, user_id, name, bet_type, filters, verdict, rpc_bet_type, rpc_filters, is_public, since_saved, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[fetchMySystems]', error.message);
    throw error;
  }
  return (data as SavedSystemRow[]) || [];
}

/** Insert a new saved system. Returns the created row id. */
export async function saveSystem(input: SaveSystemInput): Promise<string> {
  const { data, error } = await supabase
    .from(MLB_SAVED_TABLE)
    .insert({
      user_id: input.userId,
      name: input.name.trim(),
      bet_type: input.betType,       // UI bet type
      filters: input.filters,        // mobile filter state (for restore)
      verdict: input.verdict,
      rpc_bet_type: input.betType,   // same bet type sent to mlb_analysis p_bet_type
      rpc_filters: input.rpcFilters, // EXACT p_filters payload
      is_public: input.isPublic,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[saveSystem]', error.message);
    throw error;
  }
  return (data as { id: string }).id;
}

/** Rename a system (only `name` is updatable — filters+verdict are immutable). */
export async function renameSystem(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from(MLB_SAVED_TABLE)
    .update({ name: name.trim() })
    .eq('id', id);
  if (error) {
    console.error('[renameSystem]', error.message);
    throw error;
  }
}

/** Toggle whether a system appears on the public Systems Leaderboard. */
export async function setSystemPublic(id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase
    .from(MLB_SAVED_TABLE)
    .update({ is_public: isPublic })
    .eq('id', id);
  if (error) {
    console.error('[setSystemPublic]', error.message);
    throw error;
  }
}

/** Delete a saved system. */
export async function deleteSystem(id: string): Promise<void> {
  const { error } = await supabase
    .from(MLB_SAVED_TABLE)
    .delete()
    .eq('id', id);
  if (error) {
    console.error('[deleteSystem]', error.message);
    throw error;
  }
}

// ── Systems Leaderboard ──────────────────────────────────────────────────────

/** {n,wins,results:[1,0,...newest first]} */
export interface SystemLast10 {
  n: number;
  wins: number;
  results: number[];
}

/** {kind:'win'|'loss', len} */
export interface SystemStreak {
  kind: 'win' | 'loss';
  len: number;
}

export interface LeaderboardSystem {
  sport: string;
  system_id: string;
  name: string;
  verdict: SystemVerdict;
  bet_type: string;
  rpc_bet_type: string;
  /** UI snapshot travels with the row so click-through can restore the page state. */
  filters: Record<string, unknown>;
  username: string;
  created_at: string;
  since_saved: SystemRecord | null;
  all_time: SystemRecord | null;
  current_season: SystemRecord | null;
  season_label: number | null;
  last10: SystemLast10 | null;
  streak: SystemStreak | null;
  graded_at: string | null;
}

/**
 * Fetch the public Systems Leaderboard. MLB-only for now (p_sport = 'mlb').
 * Numbers are grader-computed server-side — never recompute client-side.
 */
export async function fetchSystemsLeaderboard(
  sport: string = 'mlb',
  limit: number = 50,
): Promise<LeaderboardSystem[]> {
  const { data, error } = await supabase.rpc('analysis_systems_leaderboard', {
    p_sport: sport,
    p_limit: limit,
  });
  if (error) {
    console.error('[analysis_systems_leaderboard]', error.message);
    throw error;
  }
  return (data as LeaderboardSystem[]) || [];
}

// ── Plain-English helpers (shared by My Systems + Leaderboard) ────────────────

/** e.g. "Bets the Under" / "Bets ON matching teams" / "Fades matching teams". */
export function verdictLabel(verdict: SystemVerdict | null): string {
  switch (verdict) {
    case 'over': return 'Bets the Over';
    case 'under': return 'Bets the Under';
    case 'team': return 'Bets ON matching teams';
    case 'fade': return 'Fades matching teams';
    default: return '';
  }
}

/** The "…as if you bet X" fragment used in confirmation + leaderboard banner. */
export function verdictBetPhrase(verdict: SystemVerdict): string {
  switch (verdict) {
    case 'over': return 'the Over';
    case 'under': return 'the Under';
    case 'team': return 'on these teams';
    case 'fade': return 'against these teams';
  }
}

/** Short "bets {side}" fragment for the leaderboard viewing banner. */
export function verdictSideWord(verdict: SystemVerdict | null): string {
  switch (verdict) {
    case 'over': return 'the Over';
    case 'under': return 'the Under';
    case 'team': return 'on matching teams';
    case 'fade': return 'against matching teams';
    default: return '';
  }
}

/** "2-1 since you saved" / "0-0 so far" / null → waiting on matching games. */
export function sinceSavedLabel(rec: SystemRecord | null): string {
  if (!rec) return 'Waiting on matching games';
  if (!rec.n) return '0-0 so far';
  return `${rec.wins}-${rec.losses} since you saved`;
}

/** Sample-size badge for the leaderboard: Early / Established / Proven. */
export function sampleBadge(n: number | null | undefined): 'Early' | 'Established' | 'Proven' | null {
  if (n == null) return null;
  if (n >= 100) return 'Proven';
  if (n >= 30) return 'Established';
  if (n >= 10) return 'Early';
  return null;
}

// Fire / ice thresholds — keep in sync with native AnalysisSystemCopy:
//   🔥 Fire: win streak len ≥ 3, OR last-10 with n ≥ 10 and wins ≥ 7
//   ❄️ Ice:  loss streak len ≥ 3, OR last-10 with n ≥ 10 and wins ≤ 3
export function isHotStreak(streak: SystemStreak | null | undefined): boolean {
  return !!streak && streak.kind === 'win' && streak.len >= 3;
}
export function isColdStreak(streak: SystemStreak | null | undefined): boolean {
  return !!streak && streak.kind === 'loss' && streak.len >= 3;
}
export function isHotLast10(last10: SystemLast10 | null | undefined): boolean {
  return !!last10 && last10.n >= 10 && last10.wins >= 7;
}
export function isColdLast10(last10: SystemLast10 | null | undefined): boolean {
  return !!last10 && last10.n >= 10 && last10.wins <= 3;
}
export type SystemTemperature = 'fire' | 'ice' | 'neutral';
export function systemTemperature(
  streak: SystemStreak | null | undefined,
  last10: SystemLast10 | null | undefined,
): SystemTemperature {
  if (isHotStreak(streak)) return 'fire';
  if (isColdStreak(streak)) return 'ice';
  if (isHotLast10(last10)) return 'fire';
  if (isColdLast10(last10)) return 'ice';
  return 'neutral';
}

/** Lightweight plain-English chips from a saved MLB UI snapshot (leaderboard cards). */
export function mlbFilterChipLabels(filters: Record<string, unknown> | null | undefined): string[] {
  if (!filters) return [];
  const chips: string[] = [];
  const str = (k: string) => {
    const v = filters[k];
    return typeof v === 'string' ? v : '';
  };
  const num = (k: string) => {
    const v = filters[k];
    return typeof v === 'number' ? v : null;
  };
  const arr = (k: string) => {
    const v = filters[k];
    return Array.isArray(v) ? v : [];
  };

  const seasonMin = num('seasonMin');
  const seasonMax = num('seasonMax');
  if (seasonMin != null && seasonMax != null && (seasonMin > 2023 || seasonMax < 2026)) {
    chips.push(`Seasons ${seasonMin}–${seasonMax}`);
  }
  const side = str('side');
  if (side && side !== 'any') chips.push(side === 'home' ? 'Home' : side === 'away' ? 'Away' : side);
  const favDog = str('favDog');
  if (favDog && favDog !== 'any') {
    chips.push(favDog === 'favorite' ? 'Favorites' : favDog === 'underdog' ? 'Underdogs' : favDog);
  }
  const lastResult = str('lastResult');
  if (lastResult && lastResult !== 'any') chips.push(`Last: ${lastResult === 'won' ? 'Won' : 'Lost'}`);
  const lastAts = str('lastAts');
  if (lastAts && lastAts !== 'any') {
    chips.push(`Last: ${lastAts === 'covered' ? 'Covered RL' : "Didn't cover RL"}`);
  }
  const lastTotal = str('lastTotal');
  if (lastTotal && lastTotal !== 'any') chips.push(`Last: ${lastTotal === 'over' ? 'Over' : 'Under'}`);
  const lastRole = str('lastRole');
  if (lastRole && lastRole !== 'any') {
    chips.push(`Last: ${lastRole === 'favorite' ? 'Favorite' : 'Underdog'}`);
  }
  for (const t of arr('teams')) {
    if (typeof t === 'string') chips.push(t);
    else if (t && typeof t === 'object' && 'name' in t && typeof (t as { name: unknown }).name === 'string') {
      chips.push((t as { name: string }).name);
    }
  }
  for (const t of arr('opponents')) {
    if (typeof t === 'string') chips.push(`vs ${t}`);
    else if (t && typeof t === 'object' && 'name' in t && typeof (t as { name: unknown }).name === 'string') {
      chips.push(`vs ${(t as { name: string }).name}`);
    }
  }
  const spHand = str('spHand');
  if (spHand && spHand !== 'any') chips.push(`SP ${spHand}HP`);
  const oppSpHand = str('oppSpHand');
  if (oppSpHand && oppSpHand !== 'any') chips.push(`Opp SP ${oppSpHand}HP`);
  const windDir = str('windDir');
  if (windDir && windDir !== 'any') chips.push(`Wind ${windDir}`);
  if (filters.interleague === true) chips.push('Interleague: Yes');
  if (filters.interleague === false) chips.push('Interleague: No');
  if (filters.doubleheader === true) chips.push('DH: Yes');
  if (filters.doubleheader === false) chips.push('DH: No');
  const days = arr('daysOfWeek');
  for (const d of days) {
    if (typeof d === 'string') chips.push(d);
  }
  return chips.slice(0, 12);
}
