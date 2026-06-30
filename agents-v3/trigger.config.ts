import { defineConfig } from "@trigger.dev/sdk";

// V3 agentic pick-generation worker. Parallel path to the legacy Supabase
// edge-function pipeline; serves only the new wagerproof-ios-native client.
// See .claude/docs/agents/11_GENERATION_V3_TRIGGERDEV.md
export default defineConfig({
  project: "proj_ughxoicacuqodceiwlus",
  dirs: ["./trigger"],
  runtime: "node",
  // I/O-bound: a run is ~100-230s mostly blocked on the LLM, near-zero CPU.
  machine: "small-1x",
  // 600s ceiling replaces the old 240s budget forced by the 300s edge lease —
  // this is what lets us raise the loop's turn/tool/fetch budgets.
  maxDuration: 600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 30_000,
      randomize: true,
    },
  },
});
