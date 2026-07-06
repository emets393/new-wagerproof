// runV3Generation — the V3 agentic generation orchestration, lifted from the
// Deno edge worker (process-agent-generation-job-v3/index.ts) and made
// transport-agnostic so the Trigger.dev task can call it directly.
//
// Differences from the edge worker: no Deno.serve/HTTP, no queue claim — inputs
// arrive as a payload (the gateway already created the agent_generation_runs
// "ledger" row, whose id is payload.ledgerRunId). The mark_*/telemetry RPCs are
// reused verbatim against that row. Retryable failures THROW so Trigger.dev's
// retry policy recovers them (replacing the old lease-recovery cron); terminal
// outcomes return a result. A no-op-when-unset onProgress sink streams live
// status to the task (which maps it to run metadata).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolvePremiumAccess } from "../shared/entitlements";
import { getTodayInET, getFootballWeekKeyET } from "../shared/dateUtils";
import { deriveSteeringProfile } from "./deriveSteeringProfile";
import { LoopGovernor, V3_LIMITS, type V3Limits } from "./loopGuards";
import { runAgenticLoop } from "./agenticGenerationLoop";
import { loadGames, buildSlate } from "./tools/gameSource";
import { passthroughTrace, type AgentGenContext, type ProgressEvent, type TraceFn } from "./tools/context";

const PROMPT_VERSION = "v3-incode-1";

// deepseek-reasoner/-chat are retired aliases (dead after 2026-07-24); the V4
// names are the only supported DeepSeek options. Flash is the default.
const DEFAULT_MODEL = "deepseek-v4-flash";

// $/token (cache-miss input / output), per api-docs.deepseek.com/quick_start/pricing
// (2026-06). Unknown models fall back to pro rates (conservative).
const MODEL_COSTS: Record<string, { inTok: number; outTok: number }> = {
  "deepseek-v4-flash": { inTok: 0.14e-6, outTok: 0.28e-6 },
  "deepseek-v4-pro": { inTok: 0.435e-6, outTok: 0.87e-6 },
  "deepseek-reasoner": { inTok: 0.14e-6, outTok: 0.28e-6 }, // alias → v4-flash thinking
};

function resolveProvider(model: string): { url: string; keyEnv: string; supportsForcedToolChoice: boolean } {
  // DeepSeek thinking mode (default on V4 models) rejects a named/forced
  // tool_choice with HTTP 400 — it only allows "auto"/"none". So we force the
  // final submit via an instruction message instead (see agenticGenerationLoop).
  if (model.startsWith("deepseek")) {
    return { url: "https://api.deepseek.com/v1/chat/completions", keyEnv: "DEEPSEEK_API_KEY", supportsForcedToolChoice: false };
  }
  return { url: "https://api.openai.com/v1/chat/completions", keyEnv: "OPENAI_API_KEY", supportsForcedToolChoice: true };
}

export interface RunV3Payload {
  /** agent_generation_runs row id (the ledger), created by the gateway. */
  ledgerRunId: string;
  avatarId: string;
  targetDate?: string; // ET date; defaults to today
  generationType?: string; // 'manual' | 'auto'
  /** 'week' = build ONE week-long NFL/CFB parlay from the remaining football week. */
  window?: "day" | "week";
  dryRun?: boolean;
  modelName?: string;
  v3LimitOverrides?: unknown;
}

export interface RunV3Hooks {
  onProgress?: (e: ProgressEvent) => void;
  trace?: TraceFn;
}

export type RunV3Outcome = {
  status: "succeeded" | "failed_terminal";
  picks: number;
  engineUsed?: string;
  reason?: string | null;
  note?: string;
  code?: string;
  // Human-readable audit of what was actually staked (and what was dropped),
  // surfaced into the Trigger.dev run output + logs so a run can be audited
  // entirely from the dashboard — not just by querying avatar_picks. Trimmed on
  // purpose: the heavy blobs (archived_game_data, ai_audit_payload, tool trace)
  // stay in the DB, well under Trigger's output/metadata size limits.
  acceptedPicks?: Record<string, unknown>[];
  rejected?: { game_id: string; bet_type: string; reason: string }[];
};

/** Trim the full avatar_picks rows down to the fields worth auditing in the
 *  Trigger.dev dashboard. */
function toAuditPicks(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((p) => {
    const view: Record<string, unknown> = {
      game_id: p.game_id,
      matchup: p.matchup,
      sport: p.sport,
      bet_type: p.bet_type,
      period: p.period,
      selection: p.pick_selection,
      odds: p.odds,
      units: p.units,
      confidence: p.confidence,
      reasoning: p.reasoning_text,
      key_factors: p.key_factors,
    };
    if (p.bet_type === "prop") {
      view.prop_player = p.prop_player;
      view.prop_market = p.prop_market;
      view.prop_line = p.prop_line;
      view.prop_direction = p.prop_direction;
    }
    return view;
  });
}

export async function markTriggerLedgerRunFailed(
  main: SupabaseClient,
  runId: string,
  code: string,
  msg: string,
  retryable: boolean,
): Promise<void> {
  const status = retryable ? "failed_retryable" : "failed_terminal";
  const { error } = await main
    .from("agent_generation_runs")
    .update({
      status,
      completed_at: retryable ? null : new Date().toISOString(),
      error_code: code,
      error_message: msg.slice(0, 1_000),
      next_attempt_at: retryable ? new Date(Date.now() + 60_000).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .in("status", ["queued", "leased", "processing", "failed_retryable"]);
  if (error) throw error;
}

export async function runV3Generation(payload: RunV3Payload, hooks: RunV3Hooks = {}): Promise<RunV3Outcome> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL!;
  const cfbUrl = process.env.CFB_SUPABASE_URL!;
  const cfbAnon = process.env.CFB_SUPABASE_ANON_KEY!;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  const main: SupabaseClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const cfb: SupabaseClient = createClient(cfbUrl, cfbAnon, { auth: { persistSession: false } });

  const runId = payload.ledgerRunId;
  const runModel = payload.modelName || DEFAULT_MODEL;

  let marked = false;
  const markProcessing = async () => {
    const { data: current } = await main
      .from("agent_generation_runs")
      .select("attempt_count, started_at")
      .eq("id", runId)
      .single();
    const nowIso = new Date().toISOString();
    const { error } = await main
      .from("agent_generation_runs")
      .update({
        status: "processing",
        started_at: current?.started_at ?? nowIso,
        attempt_count: Number(current?.attempt_count ?? 0) + 1,
        max_attempts: 3,
        model_name: runModel,
        updated_at: nowIso,
      })
      .eq("id", runId)
      .in("status", ["queued", "leased", "failed_retryable"]);
    if (error) throw error;
  };
  const markSucceeded = async (picks: number, note: string | null, gov?: LoopGovernor) => {
    marked = true;
    const inTok = gov?.tokensIn ?? 0, outTok = gov?.tokensOut ?? 0;
    // Assumes cache-miss input rates (conservative; DeepSeek bills CoT as output).
    const rates = MODEL_COSTS[runModel] ?? MODEL_COSTS["deepseek-v4-pro"];
    const cost = inTok * rates.inTok + outTok * rates.outTok;
    const completedAt = new Date().toISOString();
    const { data: updated, error } = await main
      .from("agent_generation_runs")
      .update({
        status: "succeeded",
        completed_at: completedAt,
        picks_generated: picks,
        prompt_version: PROMPT_VERSION,
        input_tokens: inTok,
        output_tokens: outTok,
        estimated_cost_usd: cost,
        model_name: runModel,
        weak_slate: note === "weak_slate",
        no_games: note === "no_games",
        error_code: null,
        error_message: null,
        updated_at: completedAt,
      })
      .eq("id", runId)
      .in("status", ["queued", "leased", "processing", "failed_retryable"])
      .select("avatar_id, generation_type")
      .single();
    if (error) throw error;
    if (updated?.avatar_id) {
      await main
        .from("avatar_profiles")
        .update(updated.generation_type === "auto" ? { last_auto_generated_at: completedAt } : { last_generated_at: completedAt })
        .eq("id", updated.avatar_id)
        .then(() => {}, () => {});
    }
    if (note) console.log(`[v3] run ${runId}: ${note}`);
  };
  const markFailed = async (code: string, msg: string, retryable: boolean) => {
    marked = true;
    await markTriggerLedgerRunFailed(main, runId, code, msg, retryable);
  };

  try {
    await markProcessing();
    hooks.onProgress?.({ kind: "phase", phase: "starting" });

    const { data: avatar, error: avErr } = await main
      .from("avatar_profiles")
      .select("id, user_id, preferred_sports, archetype, personality_params, custom_insights")
      .eq("id", payload.avatarId)
      .single();
    if (avErr || !avatar) {
      await markFailed("AVATAR_NOT_FOUND", avErr?.message ?? "no avatar", false);
      return { status: "failed_terminal", picks: 0, code: "AVATAR_NOT_FOUND", note: avErr?.message ?? "no avatar" };
    }

    const access = await resolvePremiumAccess(main, avatar.user_id as string);
    if (!access.hasPremiumAccess) {
      await markSucceeded(0, "not_entitled");
      return { status: "succeeded", picks: 0, note: "not_entitled" };
    }

    let steering = deriveSteeringProfile(avatar as Record<string, unknown>);
    const targetDate = payload.targetDate || getTodayInET();

    // Week-long-parlay run: NFL/CFB only (their slates already span the whole
    // football week). Force the run into parlays-only mode — the existing
    // submit-gate + prompt machinery then guarantees the only output is a
    // parlay ticket; no new terminal tool needed.
    const window: "day" | "week" = payload.window === "week" ? "week" : "day";
    let weekKey: string | null = null;
    if (window === "week") {
      const football = steering.preferredSports.filter((s) => s === "nfl" || s === "cfb");
      if (football.length === 0) {
        await markFailed("WEEKLY_NOT_AVAILABLE", "weekly parlays require NFL or CFB in preferred_sports", false);
        return { status: "failed_terminal", picks: 0, code: "WEEKLY_NOT_AVAILABLE", note: "no NFL/CFB" };
      }
      weekKey = getFootballWeekKeyET();
      steering = {
        ...steering,
        preferredSports: football,
        parlaysOnly: true,
        maxParlayLegs: steering.weeklyParlayLegs,
      };
    }
    // Per-run limit overrides (tuning experiments / staged rollout). resolveLimits
    // clamps everything so a bad row can't outrun the task's maxDuration.
    const gov = new LoopGovernor(resolveLimits(payload.v3LimitOverrides));

    const ctx: AgentGenContext = {
      runId, avatarId: payload.avatarId, steering,
      personalityParams: (avatar.personality_params as Record<string, unknown>) ?? {},
      systemPromptVersion: PROMPT_VERSION,
      targetDate, generationType: payload.generationType ?? "manual",
      dryRun: payload.dryRun === true,
      window, weekKey, weeklyTicketsSubmitted: 0,
      main, cfb,
      games: new Map(), slateGameIds: new Set(), deepFetched: new Map(), fetchedFacts: new Map(), bettableProps: new Map(),
      acceptedPicks: [], dropReports: [], toolTrace: [], reasoningTrace: "", lastSubmitReport: null,
      gov,
      onProgress: hooks.onProgress,
      trace: hooks.trace,
    };

    const span = hooks.trace ?? passthroughTrace;
    hooks.onProgress?.({ kind: "phase", phase: "loading_slate" });
    const { total } = await span("load-slate", () => loadGames(ctx));
    if (total === 0) {
      await markSucceeded(0, "no_games", gov);
      await telemetry(main, ctx, "v3", "no_games");
      return { status: "succeeded", picks: 0, note: "no_games" };
    }

    const slate = buildSlate(ctx);
    // Week runs skip the weak-slate early-out: the user explicitly asked for a
    // ticket, and even a 2-game remainder of the week is parlayable.
    if (slate.weak && steering.constraints.skipWeakSlates && window !== "week") {
      await markSucceeded(0, "weak_slate", gov);
      await telemetry(main, ctx, "v3", "weak_slate");
      return { status: "succeeded", picks: 0, note: "weak_slate" };
    }

    // Seed slate's preferred bet type as grounded (S2a). 'prop' grounds via the
    // bettableProps ledger (not deepFetched), so seed 'spread' for any/prop.
    const seedBetType = steering.preferredBetType === "any" || steering.preferredBetType === "prop" ? "spread" : steering.preferredBetType;
    for (const id of ctx.slateGameIds) ctx.deepFetched.set(id, new Set([seedBetType]));

    const model = runModel;
    const provider = resolveProvider(model);
    const apiKey = process.env[provider.keyEnv];
    if (!apiKey) {
      await markFailed("MISSING_API_KEY", `${provider.keyEnv} not set`, true);
      throw new Error(`${provider.keyEnv} not set`); // retryable: config may be fixed
    }

    const result = await runAgenticLoop(ctx, slate, {
      model, apiKey, chatCompletionsUrl: provider.url,
      supportsForcedToolChoice: provider.supportsForcedToolChoice,
      passBackReasoning: model.startsWith("deepseek"),
    });

    await markSucceeded(ctx.acceptedPicks.length, `engine=${result.engineUsed} accepted=${result.accepted} turns=${result.turns}`, gov);
    await telemetry(main, ctx, result.engineUsed, result.reason);
    hooks.onProgress?.({ kind: "phase", phase: "done", detail: `${ctx.acceptedPicks.length} pick(s)` });
    return {
      status: "succeeded",
      picks: ctx.acceptedPicks.length,
      engineUsed: result.engineUsed,
      reason: result.reason,
      acceptedPicks: toAuditPicks(ctx.acceptedPicks),
      rejected: ctx.lastSubmitReport?.rejected ?? [],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[v3] run ${runId} error:`, msg);
    // Mark retryable so the ledger reflects the failure; rethrow so Trigger.dev
    // retries (this replaces the legacy lease-recovery cron).
    if (!marked) await markFailed("LOOP_ERROR", msg, true);
    throw e;
  }
}

/** Merge per-run limit overrides over V3_LIMITS, hard-clamped so no row can push
 *  a run past the task's maxDuration (600s). Maxes raised vs. the edge worker now
 *  the 240s/300s-lease ceiling is gone. */
function resolveLimits(raw: unknown): V3Limits {
  if (!raw || typeof raw !== "object") return V3_LIMITS;
  const o = raw as Record<string, unknown>;
  const num = (key: keyof V3Limits, max: number, min = 1) => {
    const v = o[key];
    return typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : V3_LIMITS[key];
  };
  return {
    maxTurns: num("maxTurns", 16),
    maxToolCalls: num("maxToolCalls", 60),
    maxDeepFetches: num("maxDeepFetches", 40),
    maxSubmitAttempts: num("maxSubmitAttempts", 6),
    maxTokensOut: num("maxTokensOut", 48_000, 4_000),
    tokenCeiling: num("tokenCeiling", 600_000, 50_000),
    wallClockMs: num("wallClockMs", 580_000, 60_000), // under the 600s maxDuration
    perTurnMs: num("perTurnMs", 200_000, 30_000),
    fallbackReserveMs: num("fallbackReserveMs", 60_000, 0),
    thrashThreshold: num("thrashThreshold", 6, 2),
    malformedThreshold: num("malformedThreshold", 6, 2),
  };
}

async function telemetry(main: SupabaseClient, ctx: AgentGenContext, engineUsed: string, reason: string | null) {
  try {
    await main.rpc("record_v3_run_telemetry", {
      p_run_id: ctx.runId,
      p_tool_call_count: ctx.gov.toolCalls,
      p_turn_count: ctx.toolTrace.length,
      p_deep_fetch_count: ctx.gov.deepFetches,
      p_tool_trace: ctx.toolTrace,
      p_reasoning_trace: ctx.reasoningTrace,
      p_engine_used: engineUsed,
      p_fallback_reason: reason,
      p_circuit_tripped: ctx.gov.tripped,
    });
  } catch (e) {
    console.warn(`[v3] telemetry failed for ${ctx.runId}:`, e instanceof Error ? e.message : e);
  }
}
