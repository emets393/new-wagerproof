import { defineConfig } from "@trigger.dev/sdk";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";

// V3 agentic pick-generation worker. Parallel path to the legacy Supabase
// edge-function pipeline; serves only the new wagerproof-ios-native client.
// See .claude/docs/agents/18_GENERATION_V3_TRIGGERDEV.md

// Runtime env vars the task itself reads (see src/runtimeHelpers.ts,
// src/loop/runV3Generation.ts, src/shared/revenuecat.ts). Trigger.dev Cloud
// keeps these per-environment (dev/staging/prod), so `deploy` syncs whatever
// is in the local .env (loaded into the CLI process) into the target
// environment on every run — otherwise a freshly deployed environment has
// none of them set and the task crashes on its first real invocation.
const SYNCED_ENV_VAR_NAMES = [
  "DEEPSEEK_API_KEY",
  "OPENAI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CFB_SUPABASE_URL",
  "CFB_SUPABASE_ANON_KEY",
  "REVENUECAT_SECRET_API_KEY",
  "REVENUECAT_ENTITLEMENT_IDENTIFIER",
  "V3_DAILY_SPEND_CAP_USD",
];

export default defineConfig({
  project: "proj_ughxoicacuqodceiwlus",
  dirs: ["./trigger"],
  // node-22, NOT "node" (= Node 21 on Trigger.dev): supabase-js >= 2.108's
  // realtime-js requires a native WebSocket and THROWS at createClient() on
  // Node < 22 — which killed every prod run at startup on v20260701.2.
  runtime: "node-22",
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
  build: {
    extensions: [
      syncEnvVars(async () =>
        SYNCED_ENV_VAR_NAMES.filter((name) => process.env[name]).map((name) => ({
          name,
          value: process.env[name]!,
        }))
      ),
    ],
  },
});
