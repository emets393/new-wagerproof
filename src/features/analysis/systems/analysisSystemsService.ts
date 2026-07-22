/**
 * Saved analysis "systems" CRUD + Systems Leaderboard (web).
 * See .claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md.
 *
 * A saved system = filter set + explicit verdict (which side it bets) + the EXACT RPC
 * payload the page queried with. Lives on MAIN Supabase (`{sport}_analysis_saved_filters`).
 * Filters are immutable post-save — only name / is_public are updatable.
 */

import { supabase } from '@/integrations/supabase/client';
import { TREND_ADAPTERS, type Sport } from '@/features/analysis/sportAdapters';
import { MLB_SIDE_MARKETS } from '@/features/analysis/filterSchemaMlb';
import { NFL_SIDE_MARKETS } from '@/features/analysis/filterSchema';
import { CFB_SIDE_MARKETS } from '@/features/analysis/filterSchemaCfb';

export type SystemVerdict = 'team' | 'fade' | 'over' | 'under';

export type LeaderboardSportFilter = Sport | 'all';

export interface SystemRecord {
  n: number;
  wins: number;
  losses: number;
  pushes: number;
  hit_pct: number | null;
  roi: number | null;
  units: number | null;
}

export interface SavedSystemRow {
  id: string;
  sport: Sport;
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
  sport: Sport;
  name: string;
  betType: string;
  /** UI filter snapshot — stored verbatim for later restore. */
  filters: Record<string, unknown>;
  verdict: SystemVerdict;
  /** EXACT object sent to `{sport}_analysis` as p_filters. */
  rpcFilters: Record<string, unknown>;
  isPublic: boolean;
}

export interface SystemLast10 {
  n: number;
  wins: number;
  results: number[];
}

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
  /** UI snapshot so click-through restores the exact page state. */
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

const SAVED_TABLE: Record<Sport, string> = {
  mlb: 'mlb_analysis_saved_filters',
  nfl: 'nfl_analysis_saved_filters',
  cfb: 'cfb_analysis_saved_filters',
};

const SELECT_COLS =
  'id, user_id, name, bet_type, filters, verdict, rpc_bet_type, rpc_filters, is_public, since_saved, created_at';

const SYSTEM_TOTAL_MARKETS: Record<Sport, readonly string[]> = {
  mlb: ['total', 'f5_total'],
  nfl: ['fg_total', 'h1_total', 'team_total'],
  cfb: ['fg_total', 'h1_total', 'team_total'],
};

const SYSTEM_SIDE_MARKETS: Record<Sport, readonly string[]> = {
  mlb: MLB_SIDE_MARKETS,
  nfl: NFL_SIDE_MARKETS,
  cfb: CFB_SIDE_MARKETS,
};

export function savedTableFor(sport: Sport): string {
  return SAVED_TABLE[sport];
}

export function isSystemTotalMarket(sport: Sport, betType: string): boolean {
  return SYSTEM_TOTAL_MARKETS[sport].includes(betType);
}

export function isSystemSideMarket(sport: Sport, betType: string): boolean {
  return (SYSTEM_SIDE_MARKETS[sport] as readonly string[]).includes(betType);
}

/** True when a side market's filters don't pick a team side — Save dialog forces Home/Away/Fav/Dog. */
export function isSystemSideSymmetric(
  sport: Sport,
  snapshot: Record<string, unknown>,
): boolean {
  return TREND_ADAPTERS[sport].isSideSymmetric(snapshot);
}

async function fetchMySystemsForSport(userId: string, sport: Sport): Promise<SavedSystemRow[]> {
  const { data, error } = await supabase
    .from(SAVED_TABLE[sport])
    .select(SELECT_COLS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error(`[fetchMySystems:${sport}]`, error.message);
    throw error;
  }
  return ((data as Omit<SavedSystemRow, 'sport'>[]) || []).map((row) => ({ ...row, sport }));
}

/** Fetch the current user's systems. Prefer `sport`; pass `'all'` to merge every sport. */
export async function fetchMySystems(
  userId: string,
  sport: LeaderboardSportFilter = 'all',
): Promise<SavedSystemRow[]> {
  if (sport !== 'all') return fetchMySystemsForSport(userId, sport);
  const rows = await Promise.all(
    (['mlb', 'nfl', 'cfb'] as Sport[]).map((s) => fetchMySystemsForSport(userId, s)),
  );
  return rows.flat().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function saveSystem(input: SaveSystemInput): Promise<string> {
  const { data, error } = await supabase
    .from(SAVED_TABLE[input.sport])
    .insert({
      user_id: input.userId,
      name: input.name.trim(),
      bet_type: input.betType,
      filters: input.filters,
      verdict: input.verdict,
      rpc_bet_type: input.betType,
      rpc_filters: input.rpcFilters,
      is_public: input.isPublic,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[saveSystem]', error.message);
    throw error;
  }
  const id = (data as { id: string }).id;
  // Shared systems need a grade pass for filters_hash + all_time before the
  // leaderboard RPC will return them — don't wait for the nightly cron alone.
  if (input.isPublic) void requestGradeAnalysisSystems();
  return id;
}

/**
 * Ask the grader to score the current user's systems now (auth JWT).
 * Fire-and-forget from save / Share-on — failures are logged, never thrown.
 */
export async function requestGradeAnalysisSystems(): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('grade-analysis-systems', { body: {} });
    if (error) console.error('[requestGradeAnalysisSystems]', error.message);
  } catch (e) {
    console.error('[requestGradeAnalysisSystems]', e);
  }
}

export async function renameSystem(sport: Sport, id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from(SAVED_TABLE[sport])
    .update({ name: name.trim() })
    .eq('id', id);
  if (error) {
    console.error('[renameSystem]', error.message);
    throw error;
  }
}

export async function setSystemPublic(sport: Sport, id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase
    .from(SAVED_TABLE[sport])
    .update({ is_public: isPublic })
    .eq('id', id);
  if (error) {
    console.error('[setSystemPublic]', error.message);
    throw error;
  }
  if (isPublic) void requestGradeAnalysisSystems();
}

export async function deleteSystem(sport: Sport, id: string): Promise<void> {
  const { error } = await supabase.from(SAVED_TABLE[sport]).delete().eq('id', id);
  if (error) {
    console.error('[deleteSystem]', error.message);
    throw error;
  }
}

async function fetchLeaderboardForSport(sport: Sport, limit: number): Promise<LeaderboardSystem[]> {
  const { data, error } = await supabase.rpc('analysis_systems_leaderboard', {
    p_sport: sport,
    p_limit: limit,
  });
  if (error) {
    console.error(`[analysis_systems_leaderboard:${sport}]`, error.message);
    throw error;
  }
  return ((data as LeaderboardSystem[]) || []).map((row) => ({
    ...row,
    sport: row.sport || sport,
  }));
}

/**
 * Public Systems Leaderboard. For `all`, fetch each sport and merge by all-time ROI
 * (numbers are grader-computed — never recompute client-side).
 */
export async function fetchSystemsLeaderboard(
  sport: LeaderboardSportFilter = 'all',
  limit: number = 50,
): Promise<LeaderboardSystem[]> {
  if (sport !== 'all') return fetchLeaderboardForSport(sport, limit);

  const perSport = await Promise.all(
    (['mlb', 'nfl', 'cfb'] as Sport[]).map((s) => fetchLeaderboardForSport(s, limit)),
  );
  return perSport
    .flat()
    .sort((a, b) => (b.all_time?.roi ?? -Infinity) - (a.all_time?.roi ?? -Infinity))
    .slice(0, limit);
}

// ── Plain-English helpers (never say verdict / RPC / snapshot in UI) ──────────

export function verdictLabel(verdict: SystemVerdict | null): string {
  switch (verdict) {
    case 'over':
      return 'Bets the Over';
    case 'under':
      return 'Bets the Under';
    case 'team':
      return 'Bets ON matching teams';
    case 'fade':
      return 'Fades matching teams';
    default:
      return '';
  }
}

export function verdictBetPhrase(verdict: SystemVerdict): string {
  switch (verdict) {
    case 'over':
      return 'the Over';
    case 'under':
      return 'the Under';
    case 'team':
      return 'on these teams';
    case 'fade':
      return 'against these teams';
  }
}

export function verdictSideWord(verdict: SystemVerdict | null): string {
  switch (verdict) {
    case 'over':
      return 'the Over';
    case 'under':
      return 'the Under';
    case 'team':
      return 'on matching teams';
    case 'fade':
      return 'against matching teams';
    default:
      return '';
  }
}

export function sinceSavedLabel(rec: SystemRecord | null): string {
  if (!rec) return 'Waiting on matching games';
  if (!rec.n) return '0-0 so far';
  return `${rec.wins}-${rec.losses} since you saved`;
}

export function recordText(rec: SystemRecord | null): string {
  if (!rec) return '—';
  if (!rec.n) return '0-0 so far';
  const base = `${rec.wins}-${rec.losses}`;
  return rec.pushes > 0 ? `${base}-${rec.pushes}` : base;
}

export function sampleBadge(n: number | null | undefined): 'Early' | 'Established' | 'Proven' | null {
  if (n == null) return null;
  if (n >= 100) return 'Proven';
  if (n >= 30) return 'Established';
  if (n >= 10) return 'Early';
  return null;
}

// Fire / ice — keep in sync with native AnalysisSystemCopy + Expo analysisSystemsService
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

export function sportLabel(sport: string): string {
  switch (sport) {
    case 'mlb':
      return 'MLB';
    case 'nfl':
      return 'NFL';
    case 'cfb':
      return 'CFB';
    default:
      return sport.toUpperCase();
  }
}

/** Plain-English chips from a saved UI snapshot via the sport adapter's activeChips. */
export function filterChipLabels(
  sport: Sport,
  filters: Record<string, unknown> | null | undefined,
  betType: string,
): string[] {
  if (!filters) return [];
  try {
    const snap = TREND_ADAPTERS[sport].normalize(filters, betType);
    return TREND_ADAPTERS[sport]
      .activeChips(snap)
      .map((c) => c.label)
      .slice(0, 12);
  } catch {
    return [];
  }
}

export function isSport(value: string | null | undefined): value is Sport {
  return value === 'nfl' || value === 'cfb' || value === 'mlb';
}
