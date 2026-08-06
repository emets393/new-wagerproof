// Loop-level regression test for the silent-zero-pick funnel.
//
// The funnel: a turn that is cut off after the submit_picks item opens but
// before its first argument token arrives carries `arguments: ""`. That turn
// HAS a tool call, so the truncation guard (which requires toolCalls.length===0)
// never fires — and if the loop coerces "" to "{}", submitPicks reads it as a
// valid zero-pick submission, sets allAccepted, and the run finishes green with
// no picks and no error anywhere on the ledger.

import { describe, expect, it } from "vitest";
import { runAgenticLoop } from "./agenticGenerationLoop";
import { LoopGovernor } from "./loopGuards";
import { deriveSteeringProfile } from "./deriveSteeringProfile";
import type { AgentGenContext } from "./tools/context";
import type { SlateResult } from "./tools/gameSource";
import type { Transport, TurnResult } from "./transport";

function fakeCtx(): AgentGenContext {
  // Only the fields the loop touches on this path; submitPicks is never reached.
  return {
    steering: deriveSteeringProfile({ preferred_sports: ["mlb"] }),
    targetDate: "2026-08-01",
    window: "day",
    weekKey: null,
    gov: new LoopGovernor(),
    toolTrace: [],
    acceptedPicks: [],
    dropReports: [],
    lastSubmitReport: null,
    reasoningTrace: "",
    slateGameIds: new Set<string>(["g1"]),
  } as unknown as AgentGenContext;
}

const SLATE: SlateResult = {
  count: 1,
  weak: false,
  sport_groups: [{ sport: "mlb", count: 1 }],
  lens_manifest: [],
  games: [{ game_id: "g1", sport: "mlb" } as never],
  truncated: { dropped_count: 0, by: null },
};

function transportReturning(turn: () => TurnResult): { transport: Transport; calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    transport: {
      model: "gpt-5.6-luna",
      wire: "responses",
      capabilities: { forcedToolChoice: true },
      sendTurn: async () => {
        calls += 1;
        return turn();
      },
    },
  };
}

describe("runAgenticLoop — blank tool arguments", () => {
  it("does not accept a submit_picks whose arguments were cut off to an empty string", async () => {
    const { transport, calls } = transportReturning(() => ({
      toolCalls: [{ id: "call_1", name: "submit_picks", arguments: "" }],
      textContent: null,
      reasoning: null,
      finish: "truncated",
      usage: { inputTokens: 9000, outputTokens: 40000, reasoningTokens: 40000 },
    }));

    const ctx = fakeCtx();
    const res = await runAgenticLoop(ctx, SLATE, { transport });

    // Before the fix: one turn, allAccepted:true, reason:null — a green run.
    expect(res.allAccepted).toBe(false);
    expect(res.accepted).toBe(0);
    expect(ctx.lastSubmitReport).toBeNull(); // submitPicks must never have run
    expect(calls()).toBeGreaterThan(1); // the model was told to resubmit
    expect(res.reason).toBe("circuit:malformed_tool_calls");
  });

  it("still accepts a deliberate empty-picks submission", async () => {
    // Guard against over-correcting: `{"picks":[]}` is a legitimate "nothing
    // cleared the bar" outcome and must stay a clean, terminal submit.
    const { transport } = transportReturning(() => ({
      toolCalls: [{ id: "call_1", name: "submit_picks", arguments: '{"picks":[]}' }],
      textContent: null,
      reasoning: null,
      finish: "tool_calls",
      usage: { inputTokens: 100, outputTokens: 200, reasoningTokens: 0 },
    }));

    const ctx = fakeCtx();
    const res = await runAgenticLoop(ctx, SLATE, { transport });

    expect(res.allAccepted).toBe(true);
    expect(res.accepted).toBe(0);
    expect(res.turns).toBe(1);
  });
});
