// LoopGovernor — every V3 loop cap lives here, in code, because the model
// ignores prose caps. Also the per-run circuit breaker (tool thrash / malformed
// tool-call JSON). Time is injectable for tests.

import type { Usage } from "./types.ts";

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
  maxTurns: 7,
  // These caps are the REAL latency bound: each deep fetch adds (compacted)
  // context that makes the next thinking-mode turn slower. Tuned 2026-06-09 on
  // deepseek-v4-flash/-pro via dry-run experiments (15-game MLB slate): 18/10
  // lands flash ~85-107s and pro ~109-131s with ~0 budget refusals; 22/12 made
  // flash SLOWER and thrashy (2x tokens, more refusals, fewer picks). Budget
  // exhaustion here is a feature — it forces a timely submit. Per-run overrides
  // via agent_generation_runs.v3_limit_overrides (clamped in resolveLimits).
  maxToolCalls: 18,
  maxDeepFetches: 10,
  // 3 (not 2) submit attempts: deepseek often omits a required field on its
  // first submit and self-corrects from the reject report; 2 left no slack.
  maxSubmitAttempts: 3,
  // Headroom so a multi-pick submit_picks JSON (with optional decision_trace)
  // doesn't truncate mid-object. deepseek-reasoner bills CoT separately, so
  // this caps only the visible answer/tool-call output.
  maxTokensOut: 16000,
  tokenCeiling: 180_000,
  // Hard wall-clock, enforced via AbortController on every fetch (see the loop).
  // Kept well under the 300s queue lease so the worker always finalizes before
  // the lease-recovery cron could re-dispatch it.
  wallClockMs: 240_000,
  // Single thinking turn can't exceed this — bounds one stuck/slow reasoning
  // turn so it can't eat the whole budget. v4-pro turns regularly run 90s+
  // (a 90s cap tripped turn_timeout mid-experiment); 110s clears them.
  perTurnMs: 110_000,
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
