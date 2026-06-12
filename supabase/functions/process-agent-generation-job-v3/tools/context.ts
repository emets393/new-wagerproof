// Runtime context + ledger shared by the V3 loop and its tools. The ledger is
// server-side ground truth the model cannot forge: which games exist, which
// (game,bet_type) pairs have been grounded, and the raw fetched facts the
// grounding gate checks submitted picks against.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { LoopGovernor } from "../loopGuards.ts";
import type { SteeringProfile } from "../deriveSteeringProfile.ts";

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

  // data clients (service-role main, anon cfb)
  main: SupabaseClient;
  cfb: SupabaseClient;

  // one-time fetch: game_id → {sport, formatted game}
  games: Map<string, LoadedGame>;

  // ledger (ground truth)
  slateGameIds: Set<string>;
  deepFetched: Map<string, Set<string>>; // game_id → grounded bet_types
  fetchedFacts: Map<string, Record<string, unknown>>; // game_id → merged fetched values

  // outputs / audit
  acceptedPicks: Record<string, unknown>[];
  dropReports: Record<string, unknown>[];
  toolTrace: ToolTraceEntry[];
  reasoningTrace: string; // accumulated deepseek-reasoner CoT (~4KB), audit only
  lastSubmitReport: SubmitReport | null;

  gov: LoopGovernor;
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
