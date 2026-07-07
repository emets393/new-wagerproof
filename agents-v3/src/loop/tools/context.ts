// Runtime context + ledger shared by the V3 loop and its tools. The ledger is
// server-side ground truth the model cannot forge: which games exist, which
// (game,bet_type) pairs have been grounded, and the raw fetched facts the
// grounding gate checks submitted picks against.

import { SupabaseClient } from "@supabase/supabase-js";
import type { LoopGovernor } from "../loopGuards";
import type { SteeringProfile } from "../deriveSteeringProfile";

export type Sport = "nfl" | "cfb" | "nba" | "ncaab" | "mlb";

/** A fully-formatted game from agentGameHelpers (the V2 snapshot shape). */
export type FormattedGame = Record<string, unknown>;

export interface LoadedGame {
  sport: Sport;
  fg: FormattedGame;
}

export interface ToolTraceEntry {
  seq: number;
  tool_call_id: string;
  name: string;
  args_digest: string;
  result_summary: string; // ≤200 chars
  result_excerpt: string; // ≤1500 chars — embedded in each pick's audit for Copy Full Trace
  ms: number;
  ok: boolean;
}

/** A live-progress event emitted by the loop. The Trigger.dev task maps these to
 *  run metadata (read by the iOS client); the loop itself stays transport-agnostic. */
export type ProgressEvent =
  | { kind: "phase"; phase: string; detail?: string }
  | { kind: "turn"; turn: number; maxTurns: number }
  | { kind: "tool"; tool: string; detail?: string }
  | { kind: "submit"; attempt: number; accepted: number; rejected: number };

/** Wrap an async step in a tracing span. The Trigger.dev task wires this to
 *  logger.trace, so each step (load-slate, each LLM turn, each tool fetch, the
 *  submit) becomes its own bar in the dashboard run waterfall. Attributes are set
 *  at span-creation only — post-hoc span.setAttribute() breaks Trigger's span
 *  export, so per-step payloads go in the run output instead. Passthrough when
 *  unset (the loop stays transport-agnostic). */
export type TraceFn = <T>(name: string, fn: () => Promise<T>, attributes?: Record<string, string | number | boolean>) => Promise<T>;
export const passthroughTrace: TraceFn = (_name, fn) => fn();

export interface AgentGenContext {
  // identity / config
  runId: string;
  avatarId: string;
  steering: SteeringProfile;
  /** Raw personality_params snapshot for archived_personality (unchanged from V2). */
  personalityParams: Record<string, unknown>;
  systemPromptVersion: string;
  targetDate: string;
  generationType: string; // 'manual' | 'auto'
  dryRun: boolean;
  /** 'day' (default) or 'week' — a week-long-parlay run (NFL/CFB only). */
  window: "day" | "week";
  /** ET Tuesday anchoring the football week (Tue→Mon); set only on week runs. */
  weekKey: string | null;
  /** Week runs offer up to a FEW distinct tickets; submitParlay counts across calls. */
  weeklyTicketsSubmitted: number;
  /** Sorted leg-key signatures of parlay tickets already shipped this run, so a
   *  week-long run's tickets stay DISTINCT across submit_parlay calls. */
  submittedParlaySignatures: Set<string>;

  // data clients (service-role main, anon cfb)
  main: SupabaseClient;
  cfb: SupabaseClient;

  // one-time fetch: game_id → {sport, formatted game}
  games: Map<string, LoadedGame>;

  // ledger (ground truth)
  slateGameIds: Set<string>;
  deepFetched: Map<string, Set<string>>; // game_id → grounded bet_types
  fetchedFacts: Map<string, Record<string, unknown>>; // game_id → merged fetched values
  // game_id → set of bettable prop keys. A prop key is
  // `${player_name.toLowerCase()}::${market}::${line}` (line = close_line).
  // get_props populates this for props with is_bettable; the submit tool gates
  // prop bets against it. MUST match the key format readTools.ts builds.
  bettableProps: Map<string, Set<string>>;

  // outputs / audit
  acceptedPicks: Record<string, unknown>[];
  dropReports: Record<string, unknown>[];
  toolTrace: ToolTraceEntry[];
  reasoningTrace: string; // accumulated deepseek-reasoner CoT (~4KB), audit only
  lastSubmitReport: SubmitReport | null;

  gov: LoopGovernor;

  /** Optional live-progress sink. The Trigger.dev task wires this to run
   *  metadata; the loop stays transport-agnostic and it's a no-op when unset. */
  onProgress?: (e: ProgressEvent) => void;

  /** Optional span factory. The Trigger.dev task wires this to logger.trace so
   *  each step shows as its own bar in the dashboard run waterfall. Passthrough
   *  when unset (the loop stays transport-agnostic). */
  trace?: TraceFn;
}

export interface SubmitReport {
  ok: boolean;
  accepted: number;
  rejected: { game_id: string; bet_type: string; reason: string }[];
  validSlateGameIds: string[]; // echoed verbatim on reject (anti-livelock)
  allAccepted: boolean;
}

/** Mark a game's bet type as grounded (deep-fetched or slate-seeded). */
export function markGrounded(ctx: AgentGenContext, gameId: string, betType: string): void {
  const set = ctx.deepFetched.get(gameId) ?? new Set<string>();
  set.add(betType);
  ctx.deepFetched.set(gameId, set);
}

/** Merge raw fetched values for a game so the grounding gate can cross-check
 *  submitted odds/metrics against what was actually returned. */
export function recordFacts(ctx: AgentGenContext, gameId: string, facts: Record<string, unknown>): void {
  const cur = ctx.fetchedFacts.get(gameId) ?? {};
  ctx.fetchedFacts.set(gameId, { ...cur, ...facts });
}
