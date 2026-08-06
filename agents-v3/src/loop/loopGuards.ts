// LoopGovernor — every V3 loop cap lives here, in code, because the model
// ignores prose caps. Also the per-run circuit breaker (tool thrash / malformed
// tool-call JSON). Time is injectable for tests.

import type { Usage } from "./types";

export interface V3Limits {
  maxTurns: number;
  maxToolCalls: number; // total non-slate tool calls
  maxDeepFetches: number; // distinct game_ids deep-fetched
  maxSubmitAttempts: number;
  maxTokensOut: number; // per request (request max_tokens)
  tokenCeiling: number; // total in+out per run (soft → force submit)
  wallClockMs: number;
  perTurnMs: number; // hard cap on a single LLM turn (AbortController)
  fallbackReserveMs: number; // reserve to run the V2 static fallback
  thrashThreshold: number; // same tool+args N times → trip
  malformedThreshold: number; // malformed tool_call JSON N times → trip
}

export const V3_LIMITS: V3Limits = {
  // RAISED 2026-06-29 for the Trigger.dev path. The old caps (7/24/16, 240s)
  // were pinned under the Supabase 300s edge lease, which force-submitted NFL/CFB
  // agents before they reached conviction/injuries/1H/TT. On Trigger.dev the task
  // has maxDuration:600, so the wall-clock budget (540s) and per-step caps open up
  // — this is the pick-quality win that motivated the move. Per-run overrides via
  // agent_generation_runs.v3_limit_overrides (clamped in resolveLimits).
  maxTurns: 12,
  // Each deep fetch adds (compacted) context that slows the next thinking turn,
  // so these remain the real latency bound — just looser now there's room to ~540s
  // (~13s/fetch). MLB (~10 tools) never reaches the higher cap; football can.
  maxToolCalls: 40,
  maxDeepFetches: 28,
  // 4 submit attempts: deepseek often omits a required field on its first submit
  // and self-corrects from the reject report; extra slack costs little now.
  maxSubmitAttempts: 4,
  // RAISED 2026-08-01 (24_000 → 40_000) with the move to /v1/responses. What this
  // caps now differs by wire: on DeepSeek it is still only the visible
  // answer/tool-call output (CoT is billed and budgeted separately), but
  // max_output_tokens on Responses covers REASONING TOKENS TOO. At xhigh the
  // thinking can consume the whole cap before a single tool call is emitted,
  // which surfaces as a truncated turn with zero tool calls — the exact failure
  // the loop's truncation guard exists to catch, and a silent zero-pick run if
  // that guard ever slips. OpenAI's guidance is to reserve ~25K for reasoning +
  // output; 40K leaves that plus room for a multi-pick submit_picks JSON with an
  // optional decision_trace. Stays under resolveLimits' 48K clamp so a per-run
  // override can still move it either way.
  maxTokensOut: 40_000,
  // Sum of per-turn prompt+completion tokens, NOT a context-window measure: both
  // wires re-bill the whole conversation every turn, so this grows quadratically
  // and acts as the run's cost/turn brake. Unchanged by the Responses port —
  // echoing reasoning items makes each prompt bigger, so it will trip somewhat
  // earlier; that is the conservative direction, and retuning it belongs with
  // real telemetry (circuit reasons + input_tokens per run), not a guess.
  tokenCeiling: 320_000,
  // Hard wall-clock, enforced via AbortController on every fetch (see the loop).
  // Kept under the 600s task maxDuration with a ~60s finalize margin.
  wallClockMs: 540_000,
  // Single thinking turn can't exceed this — bounds one stuck/slow reasoning turn.
  // RAISED 2026-08-01 (150_000 → 330_000) together with maxTokensOut, because the
  // two caps are coupled and their failure modes are NOT symmetric: hitting the
  // token cap ends the turn as truncated, which the loop trips on, retries once,
  // and then throws — loud, and the turn's usage is already on the governor.
  // Hitting this timer aborts the fetch, and the loop's abort path just breaks:
  // SUCCEEDED with 0 picks, and since usage is only added after a fully-consumed
  // stream, the ledger records $0 so the daily spend cap never sees what the turn
  // actually burned. At the old 150s the timer bound FIRST — no GPT-5-class model
  // emits 40K output tokens (reasoning included, on Responses) that fast — making
  // the raised cap unreachable and every over-budget turn take the silent path.
  // This caps a PATHOLOGICAL turn, not a typical one, so it costs no turns in a
  // normal run; total run length is still bounded by wallClockMs, which the loop
  // applies as min(timeLeft, perTurnMs). NOTE: resolveLimits still clamps a
  // per-run override of this key to 200_000, so a row can only lower it.
  perTurnMs: 330_000,
  fallbackReserveMs: 45_000,
  thrashThreshold: 3,
  malformedThreshold: 3,
};

export class LoopGovernor {
  toolCalls = 0;
  deepFetches = 0;
  submitAttempts = 0;
  tokensIn = 0;
  tokensOut = 0;
  malformedCount = 0;
  tripped: string | null = null;

  private readonly deadlineAt: number;
  private readonly argDigests = new Map<string, number>();

  constructor(
    private readonly limits: V3Limits = V3_LIMITS,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.deadlineAt = now() + limits.wallClockMs;
  }

  get totalTokens(): number {
    return this.tokensIn + this.tokensOut;
  }
  addUsage(u: Usage | null): void {
    if (!u) return;
    this.tokensIn += u.prompt_tokens || 0;
    this.tokensOut += u.completion_tokens || 0;
  }
  timeLeftMs(): number {
    return this.deadlineAt - this.now();
  }

  /** Charge a tool call against the total budget + detect thrash. `isDeep`
   *  also charges the deep-fetch budget. Returns an error string when the call
   *  must be refused (the loop sends {error} back instead of running it). */
  chargeToolCall(name: string, argsDigest: string, isDeep: boolean): string | null {
    const key = `${name}:${argsDigest}`;
    const seen = (this.argDigests.get(key) ?? 0) + 1;
    this.argDigests.set(key, seen);
    if (seen >= this.limits.thrashThreshold) {
      this.trip(`thrash:${name}`);
      return "repeated identical call — submit your picks now";
    }
    this.toolCalls += 1;
    if (this.toolCalls > this.limits.maxToolCalls) {
      return "tool-call budget exhausted — submit your picks now";
    }
    if (isDeep) {
      this.deepFetches += 1;
      if (this.deepFetches > this.limits.maxDeepFetches) {
        return "deep-fetch budget exhausted — pick from what you have and submit";
      }
    }
    return null;
  }

  recordMalformed(): void {
    this.malformedCount += 1;
    if (this.malformedCount >= this.limits.malformedThreshold) this.trip("malformed_tool_calls");
  }

  trip(reason: string): void {
    if (!this.tripped) this.tripped = reason;
  }

  /** Force the final submit when out of turns, near the wall-clock deadline,
   *  over the token ceiling, or the breaker tripped. */
  shouldForceSubmit(turn: number): boolean {
    return (
      this.tripped !== null ||
      turn >= this.limits.maxTurns - 1 ||
      this.timeLeftMs() < 30_000 ||
      this.totalTokens > this.limits.tokenCeiling
    );
  }

  /** Whether there's enough time left to attempt the bounded V2 static fallback. */
  canRunFallback(): boolean {
    return this.timeLeftMs() > this.limits.fallbackReserveMs;
  }

  get limitsRef(): V3Limits {
    return this.limits;
  }
}
