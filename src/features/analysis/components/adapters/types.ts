/**
 * Per-sport adapter contract for the unified Historical Trends workbench.
 *
 * Everything sport-specific lives behind a `TrendsSportAdapter`: bet-type spine, RPC names,
 * the snapshot→p_filters transcription (`toRpcFilters`), the NL chat binding (`applyChat`), the
 * rail body, active chips, copy, presets and dynamic loaders. The visual components under
 * `../` know nothing about a sport — they take data + callbacks and render.
 *
 * Snapshot shape per sport:
 *   NFL → NflWebFilterSnapshot, CFB → CfbWebFilterSnapshot (both canonical).
 *   MLB → the looser inline page shape (OptRange|null, min/max strings, pitcher objects) that the
 *   old MLBAnalytics page held; `applyChat` bridges to/from the canonical MlbFilterSnapshot the
 *   engine speaks. See `mlb.tsx`.
 */
import type React from 'react';
import type { FilterPatchOp } from '@/features/analysis/sportFilterEngine';
import type { TeamOption } from '@/features/analysis/TeamMultiSelect';

export type Sport = 'nfl' | 'cfb' | 'mlb';

// ── Analysis response (null-tolerant — SQL can emit null on zero-row slices) ──────────────────
export interface Opt {
  side: string;
  n: number;
  wins: number;
  hit_pct: number;
  roi: number | null;
}
export interface Bar {
  dimension: string;
  options: Opt[];
}
export interface BreakdownRow {
  n: number;
  hit_pct: number;
  roi: number | null;
  [key: string]: unknown;
}
export interface AnalysisResponse {
  bet_type: string;
  coverage: { season_min: number; season_max: number; n_bets: number; n_games: number };
  baseline_pct: number;
  overall: { n: number; wins: number; hit_pct: number; roi: number | null };
  bars: Bar[];
  by_team?: BreakdownRow[];
  by_coach?: BreakdownRow[];
  by_referee?: BreakdownRow[];
  by_conference?: BreakdownRow[];
  by_venue?: BreakdownRow[];
}

export interface Overall {
  n: number;
  wins: number;
  hit_pct: number;
  roi: number | null;
}

export type UpcomingGame = Record<string, unknown>;

// ── Adapter support types ─────────────────────────────────────────────────────────────────────
export interface BetGroup {
  group: string;
  items: { key: string; label: string }[];
}

export interface BreakdownTabDef {
  key: string;
  label: string;
  rows: BreakdownRow[];
  /** team-keyed tabs render logos; coach/ref/conference/venue don't. */
  hasLogos: boolean;
  /** row property to read the label from (team | coach | referee | conference | venue). */
  labelKey: string;
}

export interface PresetDef {
  label: string;
  betType: string;
  filters: Record<string, unknown>;
}

export interface ActiveChip {
  label: string;
  /** snapshot patch to merge when the chip is closed (resets that dimension to default). */
  patch: Record<string, unknown>;
}

/** Loaded once per adapter mount — team options + the sport's dynamic lists. */
export interface AdapterData {
  teamOptions: TeamOption[];
  coaches?: string[];
  referees?: string[];
  conferences?: string[];
  conferenceTeamMap?: Record<string, string[]>;
  cfbLogos?: Record<string, string>;
  /** MLB pitcher catalog (id/name/hand/team) + flat names for chat validation. */
  pitcherCatalog?: { id: number; name: string; hand: string | null; team: string | null }[];
  pitcherNames?: string[];
}

export interface ChatResult<S> {
  snapshot: S;
  applied: { dimension: string }[];
  rejected: { reason: string }[];
  noChange: boolean;
}

// ── The adapter ───────────────────────────────────────────────────────────────────────────────
export interface TrendsSportAdapter<S extends Record<string, unknown> = Record<string, unknown>> {
  sport: Sport;
  label: string;

  // bet-type spine
  betGroups: BetGroup[];
  defaultBetType: string;
  limitedBetTypes: ReadonlySet<string>;
  seasonFloorFor(betType: string): number;
  seasonMax: number;

  // snapshot lifecycle
  reset(betType: string): S;
  normalize(raw: unknown, betType?: string): S;
  /** apply bet-type change side effects (season-floor clamp, MLB total reset). Returns next snapshot. */
  withBetType(snapshot: S, betType: string): S;

  // RPC
  analysisRpc: string;
  upcomingRpc: string;
  /** snapshot → p_filters. `data` supplies dynamic context (CFB conference→team expansion). */
  toRpcFilters(snapshot: S, data?: AdapterData): Record<string, unknown>;
  /** filters used for the upcoming-games RPC (MLB drops weather-only filters). */
  upcomingRpcFilters?(snapshot: S, rpcFilters: Record<string, unknown>): Record<string, unknown>;
  /** a warning line when upcoming filters are relaxed vs the analysis filters. */
  upcomingNote?(snapshot: S, rpcFilters: Record<string, unknown>): string | null;

  // chat
  toCurrentFilterPayload(snapshot: S): Record<string, unknown>;
  chatBodyExtras(data: AdapterData): Record<string, unknown>;
  applyChat(current: S, ops: FilterPatchOp[], ctx: { sentence: string; data: AdapterData }): ChatResult<S>;
  nlExamples: string[];

  // presentation of results
  isTotalMarket(betType: string): boolean;
  recoverTotalOverall: boolean;
  hideSideBarsWhenSymmetric: boolean;
  isSideSymmetric(snapshot: S): boolean;
  showsROI(betType: string): boolean;
  verb(betType: string): string;
  outcomeWord(betType: string): string;
  nounFor(betType: string): string;
  sideLabel(betType: string, side: string): string;
  headlineSubject(snapshot: S, data: AnalysisResponse | null): string;
  scopeNote(snapshot: S, data: AdapterData): string;
  focusSide(snapshot: S, dimension: string, side: string): Record<string, unknown>;

  // breakdown + upcoming
  breakdownTabs(snapshot: S, data: AnalysisResponse): BreakdownTabDef[];
  logoFor(row: BreakdownRow, tab: BreakdownTabDef, data: AdapterData): string | null;
  lineForBet(betType: string, game: UpcomingGame): string;
  upcomingLabel(count: number): string;
  upcomingTime(game: UpcomingGame): string;
  upcomingChips?(game: UpcomingGame): string[];

  // presets + chips + saved
  presets: PresetDef[];
  applyPreset(preset: PresetDef): S;
  activeChips(snapshot: S): ActiveChip[];
  savedTable: string;

  /**
   * Snapshot keys owned by each rail FilterGroup, keyed by the group's exact `title`.
   * The filter drawer diffs these keys against `reset(betType)` to badge sections with
   * active-filter counts and float them to the top.
   */
  groupFields: Record<string, readonly string[]>;

  // loaders + rail
  useAdapterData(): AdapterData;
  RailSections: React.FC<{ snapshot: S; update: (patch: Partial<S>) => void; data: AdapterData }>;
}
