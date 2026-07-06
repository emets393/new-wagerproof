// generateV3Picks — the Trigger.dev task that runs one V3 agentic pick
// generation. It is the parallel-path replacement for the Supabase edge worker:
// Trigger.dev owns the queue/concurrency/retries (no pg_cron lease/dispatch),
// and the loop's live progress is mirrored into run `metadata` that the iOS
// client reads by polling Trigger.dev's REST run-retrieve endpoint.
// See .claude/docs/agents/11_GENERATION_V3_TRIGGERDEV.md

import { schemaTask, metadata, logger, AbortTaskRunError } from "@trigger.dev/sdk";
import { z } from "zod";
import { markTriggerLedgerRunFailed, runV3Generation, type RunV3Payload } from "../src/loop/runV3Generation";
import type { ProgressEvent } from "../src/loop/tools/context";
import { ledgerClient, isOverDailySpendCap } from "../src/runtimeHelpers";

// Human labels for the live status line. Unknown tools fall back to a humanized
// form of the raw name (e.g. get_market_odds -> "Get market odds").
const TOOL_LABELS: Record<string, string> = {
  get_slate: "Reviewing today's slate",
  get_market_odds: "Reading market odds",
  get_signals: "Pulling sharp signals",
  get_conviction: "Checking conviction",
  get_full_game: "Analyzing full-game model",
  get_first_half: "Analyzing first half",
  get_team_totals: "Checking team totals",
  get_props: "Scanning player props",
  get_perfect_storm: "Looking for perfect-storm spots",
  get_pitcher_matchup: "Reading pitcher matchups",
  get_bullpen: "Reading bullpen data",
  get_batting: "Reading batting splits",
  get_park_factors: "Checking park factors",
  get_team_ratings: "Comparing team ratings",
  get_trends: "Reviewing recent trends",
  get_injuries: "Checking injuries",
  get_weather: "Checking weather",
};

function humanizeTool(name: string): string {
  const label = TOOL_LABELS[name];
  if (label) return label;
  const words = name.replace(/^get_/, "").replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : name;
}

export const generateV3Picks = schemaTask({
  id: "generate-v3-picks",
  schema: z.object({
    ledgerRunId: z.string().uuid(),
    avatarId: z.string().uuid(),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    generationType: z.string().optional(),
    window: z.enum(["day", "week"]).optional(),
    dryRun: z.boolean().optional(),
    modelName: z.string().optional(),
    v3LimitOverrides: z.unknown().optional(),
  }),
  machine: "small-1x",
  maxDuration: 600,
  // One global cap on concurrent runs (replaces the dispatch-of-5 + circuit run
  // cap). We intentionally do not use concurrencyKey: in Trigger.dev that creates
  // one queue copy per key, which would turn this into a per-user cap.
  queue: { concurrencyLimit: 10 },
  retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 1_000, maxTimeoutInMs: 30_000, randomize: true },

  run: async (payload: RunV3Payload) => {
    const main = ledgerClient();

    // $-spend guard (replaces v3_circuit_state). Abort without retry — retrying
    // would only hit the same cap.
    if (await isOverDailySpendCap(main)) {
      await markTriggerLedgerRunFailed(main, payload.ledgerRunId, "SPEND_CAP", "daily spend cap reached", false).then(() => {}, () => {});
      throw new AbortTaskRunError("daily spend cap reached");
    }

    metadata.set("phase", "queued").set("turn", 0).set("toolCalls", 0).set("picksAccepted", 0);

    // Map loop progress events → run metadata (read by the iOS client).
    const onProgress = (e: ProgressEvent): void => {
      switch (e.kind) {
        case "phase":
          metadata.set("phase", e.phase);
          if (e.detail) metadata.set("phaseDetail", e.detail);
          break;
        case "turn":
          metadata.set("turn", e.turn).set("maxTurns", e.maxTurns);
          break;
        case "tool":
          metadata.set("currentTool", humanizeTool(e.tool));
          if (e.detail) metadata.set("currentToolDetail", e.detail);
          metadata.increment("toolCalls", 1);
          break;
        case "submit":
          metadata.set("phase", "submitting").set("submitAttempt", e.attempt);
          metadata.set("picksAccepted", e.accepted).set("picksRejected", e.rejected);
          break;
      }
    };

    // Wire the loop's span factory to logger.trace so each step (load-slate,
    // each LLM turn, each tool fetch, the submit) shows as its own bar in the
    // dashboard run waterfall — not just one root span for the whole task.
    const outcome = await runV3Generation(payload, {
      onProgress,
      trace: (name, fn, attributes) => logger.trace(name, async () => fn(), { attributes }),
    });

    metadata.set("status", outcome.status).set("picksAccepted", outcome.picks);
    if (outcome.note) metadata.set("note", outcome.note);
    logger.info("v3 generation finished", {
      runId: payload.ledgerRunId,
      status: outcome.status,
      picks: outcome.picks,
      engineUsed: outcome.engineUsed,
      reason: outcome.reason,
    });
    // Audit surface: the actual staked picks + any drops-with-reasons, so a run
    // is reviewable entirely from the Trigger.dev dashboard (this log + the run
    // output) instead of only by querying avatar_picks.
    if (outcome.acceptedPicks?.length || outcome.rejected?.length) {
      logger.info("v3 submitted picks", {
        runId: payload.ledgerRunId,
        accepted: outcome.acceptedPicks ?? [],
        rejected: outcome.rejected ?? [],
      });
    }

    // Terminal failure (e.g. avatar not found) — surface as a failed run, no retry.
    if (outcome.status === "failed_terminal") {
      throw new AbortTaskRunError(outcome.note ?? outcome.code ?? "terminal failure");
    }
    return outcome;
  },

  // Backstop: if all retries fail (or the run aborts), make sure the ledger row
  // doesn't stay stuck in 'processing' so the app stops spinning.
  onFailure: async ({ payload, error }) => {
    try {
      const main = ledgerClient();
      await markTriggerLedgerRunFailed(
        main,
        (payload as RunV3Payload).ledgerRunId,
        "TASK_FAILED",
        String((error as Error)?.message ?? error).slice(0, 500),
        false,
      );
    } catch {
      /* ignore — best-effort */
    }
  },
});
