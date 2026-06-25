// process-agent-generation-job-v3 — the agentic generation worker. Sibling of
// process-agent-generation-job-v2 (V2 untouched). Claims a V3-engine run,
// derives the steering profile, fetches the slate once, runs the bounded
// agentic loop, and records V3 telemetry. Picks are written inside submit_picks.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { resolvePremiumAccess } from "../shared/entitlements.ts";
import { getTodayInET } from "../shared/dateUtils.ts";
import { deriveSteeringProfile } from "./deriveSteeringProfile.ts";
import { LoopGovernor, V3_LIMITS, type V3Limits } from "./loopGuards.ts";
import { runAgenticLoop } from "./agenticGenerationLoop.ts";
import { loadGames, buildSlate } from "./tools/gameSource.ts";
import type { AgentGenContext } from "./tools/context.ts";

const PROMPT_VERSION = "v3-incode-1";

// deepseek-reasoner/-chat are retired aliases (dead after 2026-07-24); the V4
// names are the only supported DeepSeek options. Flash is the default until
// tuning says otherwise.
const DEFAULT_MODEL = "deepseek-v4-flash";

// $/token (cache-miss input / output), per api-docs.deepseek.com/quick_start/pricing
// (2026-06). Unknown models fall back to pro rates (conservative).
const MODEL_COSTS: Record<string, { inTok: number; outTok: number }> = {
  "deepseek-v4-flash": { inTok: 0.14e-6, outTok: 0.28e-6 },
  "deepseek-v4-pro": { inTok: 0.435e-6, outTok: 0.87e-6 },
  "deepseek-reasoner": { inTok: 0.14e-6, outTok: 0.28e-6 }, // alias → v4-flash thinking
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function resolveProvider(model: string): { url: string; keyEnv: string; supportsForcedToolChoice: boolean } {
  // DeepSeek thinking mode (default on V4 models) rejects a named/forced
  // tool_choice with HTTP 400 — it only allows "auto"/"none". So we force the
  // final submit via an instruction message instead (see agenticGenerationLoop).
  // OpenAI supports forced tool_choice.
  if (model.startsWith("deepseek")) {
    return { url: "https://api.deepseek.com/v1/chat/completions", keyEnv: "DEEPSEEK_API_KEY", supportsForcedToolChoice: false };
  }
  return { url: "https://api.openai.com/v1/chat/completions", keyEnv: "OPENAI_API_KEY", supportsForcedToolChoice: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Internal auth: x-internal-secret OR service-role bearer (same as V2).
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  const provided = req.headers.get("x-internal-secret");
  if (!((internalSecret && provided === internalSecret) || (serviceKey && auth === serviceKey))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const cfbUrl = Deno.env.get("CFB_SUPABASE_URL")!;
  const cfbAnon = Deno.env.get("CFB_SUPABASE_ANON_KEY")!;
  const main: SupabaseClient = createClient(supabaseUrl, serviceKey!, { auth: { persistSession: false } });
  const cfb: SupabaseClient = createClient(cfbUrl, cfbAnon, { auth: { persistSession: false } });

  const workerId = `worker-v3-${crypto.randomUUID().slice(0, 8)}`;
  const { data: claimed } = await main.rpc("claim_generation_runs_v3", { p_worker_id: workerId, p_limit: 1, p_lease_seconds: 300 });
  const run = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!run) return new Response(JSON.stringify({ ok: true, claimed: 0 }), { headers: { ...CORS, "Content-Type": "application/json" } });

  const runId = run.id as string;
  const runModel = (run.model_name as string) || DEFAULT_MODEL;
  let marked = false;
  const markSucceeded = async (picks: number, note: string | null, gov?: LoopGovernor) => {
    marked = true;
    const inTok = gov?.tokensIn ?? 0, outTok = gov?.tokensOut ?? 0;
    // Assumes cache-miss input rates (conservative; DeepSeek bills CoT as output).
    const rates = MODEL_COSTS[runModel] ?? MODEL_COSTS["deepseek-v4-pro"];
    const cost = inTok * rates.inTok + outTok * rates.outTok;
    await main.rpc("mark_generation_run_succeeded_v2", {
      p_run_id: runId, p_picks_generated: picks, p_prompt_version: PROMPT_VERSION,
      p_input_tokens: inTok, p_output_tokens: outTok, p_estimated_cost_usd: cost, p_model_name: runModel,
    });
    if (note) console.log(`[v3] run ${runId}: ${note}`);
  };
  const markFailed = async (code: string, msg: string, retryable: boolean) => {
    marked = true;
    await main.rpc("mark_generation_run_failed_v2", { p_run_id: runId, p_error_code: code, p_error_message: msg, p_retryable: retryable });
  };

  try {
    await main.rpc("mark_generation_run_processing_v2", { p_run_id: runId });

    const { data: avatar, error: avErr } = await main
      .from("avatar_profiles")
      .select("id, user_id, preferred_sports, archetype, personality_params, custom_insights")
      .eq("id", run.avatar_id)
      .single();
    if (avErr || !avatar) { await markFailed("AVATAR_NOT_FOUND", avErr?.message ?? "no avatar", false); return ok(runId, "failed_terminal"); }

    const access = await resolvePremiumAccess(main, avatar.user_id as string);
    if (!access.hasPremiumAccess) { await markSucceeded(0, "not_entitled"); return ok(runId, "succeeded"); }

    const steering = deriveSteeringProfile(avatar as Record<string, unknown>);
    const targetDate = (run.target_date as string) || getTodayInET();
    // Per-run limit overrides (tuning experiments / staged rollout of new caps).
    // resolveLimits clamps everything so a bad row can't outrun the 300s lease.
    const gov = new LoopGovernor(resolveLimits(run.v3_limit_overrides));

    const ctx: AgentGenContext = {
      runId, avatarId: run.avatar_id as string, steering,
      personalityParams: (avatar.personality_params as Record<string, unknown>) ?? {},
      systemPromptVersion: PROMPT_VERSION,
      targetDate, generationType: (run.generation_type as string) ?? "manual",
      dryRun: run.dry_run === true,
      main, cfb,
      games: new Map(), slateGameIds: new Set(), deepFetched: new Map(), fetchedFacts: new Map(), bettableProps: new Map(),
      acceptedPicks: [], dropReports: [], toolTrace: [], reasoningTrace: "", lastSubmitReport: null,
      gov,
    };

    const { total } = await loadGames(ctx);
    if (total === 0) { await markSucceeded(0, "no_games", gov); await telemetry(main, ctx, "v3", "no_games"); return ok(runId, "succeeded"); }

    const slate = buildSlate(ctx);
    if (slate.weak && steering.constraints.skipWeakSlates) { await markSucceeded(0, "weak_slate", gov); await telemetry(main, ctx, "v3", "weak_slate"); return ok(runId, "succeeded"); }

    // Seed slate's preferred bet type as grounded (S2a).
    for (const id of ctx.slateGameIds) ctx.deepFetched.set(id, new Set([steering.preferredBetType === "any" ? "spread" : steering.preferredBetType]));

    const model = runModel;
    const provider = resolveProvider(model);
    const apiKey = Deno.env.get(provider.keyEnv);
    if (!apiKey) { await markFailed("MISSING_API_KEY", `${provider.keyEnv} not set`, true); return ok(runId, "failed_retryable"); }

    const result = await runAgenticLoop(ctx, slate, {
      model, apiKey, chatCompletionsUrl: provider.url,
      supportsForcedToolChoice: provider.supportsForcedToolChoice,
      passBackReasoning: model.startsWith("deepseek"),
    });

    await markSucceeded(ctx.acceptedPicks.length, `engine=${result.engineUsed} accepted=${result.accepted} turns=${result.turns}`, gov);
    await telemetry(main, ctx, result.engineUsed, result.reason);
    return ok(runId, "succeeded");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[v3] run ${runId} error:`, msg);
    if (!marked) await markFailed("LOOP_ERROR", msg, true);
    return ok(runId, "failed_retryable");
  } finally {
    // S10.7 — never orphan the lease. If nothing marked the run (e.g. abort
    // before any mark), mark it retryable so the V3 dispatch cron recovers it.
    if (!marked) { try { await markFailed("UNMARKED", "run ended unmarked", true); } catch { /* ignore */ } }
  }
});

/** Merge per-run limit overrides over V3_LIMITS, hard-clamped so no row can
 *  push a run past the 300s queue lease or the edge-function wall clock. */
function resolveLimits(raw: unknown): V3Limits {
  if (!raw || typeof raw !== "object") return V3_LIMITS;
  const o = raw as Record<string, unknown>;
  const num = (key: keyof V3Limits, max: number, min = 1) => {
    const v = o[key];
    return typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : V3_LIMITS[key];
  };
  return {
    maxTurns: num("maxTurns", 10),
    maxToolCalls: num("maxToolCalls", 30),
    maxDeepFetches: num("maxDeepFetches", 16),
    maxSubmitAttempts: num("maxSubmitAttempts", 5),
    maxTokensOut: num("maxTokensOut", 32_000, 4_000),
    tokenCeiling: num("tokenCeiling", 400_000, 50_000),
    wallClockMs: num("wallClockMs", 270_000, 60_000), // lease 300s − finalize margin
    perTurnMs: num("perTurnMs", 120_000, 30_000),
    fallbackReserveMs: num("fallbackReserveMs", 60_000, 0),
    thrashThreshold: num("thrashThreshold", 5, 2),
    malformedThreshold: num("malformedThreshold", 5, 2),
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

function ok(runId: string, status: string): Response {
  return new Response(JSON.stringify({ ok: true, run_id: runId, status }), { headers: { ...CORS, "Content-Type": "application/json" } });
}
