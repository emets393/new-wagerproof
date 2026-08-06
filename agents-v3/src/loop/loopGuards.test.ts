// The invariant coupling the two caps a single turn can hit: the OUTPUT-TOKEN
// cap must bind before the per-turn TIMER does.
//
// Why it matters — the two failure modes are not symmetric. Hitting
// maxTokensOut ends the turn as truncated, which agenticGenerationLoop trips on,
// retries once, then throws: loud, retried, and that turn's usage already
// reached the governor. Hitting perTurnMs aborts the fetch, and the loop's abort
// path only `break`s — the run is marked SUCCEEDED with 0 picks, and because
// usage is added only after a fully-consumed stream, estimated_cost_usd is
// written as $0 so isOverDailySpendCap never sees the tokens that were burned.
// If the timer binds first, a raised maxTokensOut is unreachable and every
// over-budget turn takes the silent path. Raising one cap without the other is
// exactly the regression this asserts against.

import { describe, expect, it } from "vitest";
import { V3_LIMITS } from "./loopGuards";

// Conservative floor for sustained output-token throughput on a GPT-5-class
// reasoning model. This is an ASSUMPTION — OpenAI publishes no throughput SLA —
// set below observed rates on purpose so the invariant errs toward giving a turn
// MORE wall time than it needs. Reasoning tokens count here too: on /v1/responses
// max_output_tokens covers reasoning as well as visible output.
const MIN_OUTPUT_TOKENS_PER_SEC = 130;

describe("V3_LIMITS turn budget", () => {
  it("gives a turn enough wall time to actually reach maxTokensOut", () => {
    const msToEmitFullBudget = (V3_LIMITS.maxTokensOut / MIN_OUTPUT_TOKENS_PER_SEC) * 1000;
    expect(V3_LIMITS.perTurnMs).toBeGreaterThanOrEqual(msToEmitFullBudget);
  });

  it("still bounds one stuck turn inside the run's wall clock, with room to finalize", () => {
    // A hung turn has to leave the loop enough time to force the terminal
    // submit — it stops forcing once timeLeftMs() drops under 30s.
    expect(V3_LIMITS.perTurnMs).toBeLessThan(V3_LIMITS.wallClockMs - 60_000);
  });
});
