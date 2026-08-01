// DEPRECATED 2026-08-01 — do not build on this, do not extend.
//
// Headlines are now deterministic, computed client-side by the pure formatters in
// src/features/games/detail/headlines/. This LLM path was retired because it kept
// getting side attribution backwards (calling a -3.3 home edge "+3.3 for the home
// team"), which the judge pass below did not reliably catch.
//
// It now has NO READER anywhere in the repo. A 2026-08-01 audit found the only
// remaining references to ai_completions.headline_text are the writer
// (agents-v3/src/summaries/runDailySummaries.ts:178), the column DDL
// (supabase/migrations/20260726120000_widget_headline_summaries.sql:23,:37,:46) and
// prose in the docs; src/features/games/hooks/useAiCompletions.ts fetches bodies only.
// The earlier claim that NflPredictionsSection.tsx read it is stale — that read is gone.
//
// ACTION FOR THE OWNER: the schedule below is defined IN CODE (see the `cron` field on
// the schedules.task call), so this comment does not stop it — it still fires daily,
// burning tokens for output
// nobody reads. Disable the 'daily-widget-summaries' schedule in the Trigger.dev
// dashboard (or drop it on the next deploy). Deliberately NOT changed here: this pass
// does not touch cron expressions or delete tasks.
//
// Intentionally NOT migrated to gpt-5.6-luna — leave the model ids as-is; the
// replacement is deterministic code, not a better model.
// See .claude/docs/17_widget_headlines.md.
//
// dailyWidgetSummaries — writes the big plain-language one-liner that sits at the
// top of every game-detail widget, once a day for the whole slate.
//
// Lives here rather than in a Supabase edge function because it is a fan-out over
// every game × widget with an LLM call per item: it needs the retry, concurrency
// and run-history machinery Trigger.dev already gives the pick generator, and it
// shares the same daily spend cap.
//
// Each headline is written by one model and then judged by a second pass before
// it is published; a headline that fails QC is stored with headline_text NULL so
// the client withholds it. See src/summaries/generateHeadline.ts.

import { schedules, logger } from "@trigger.dev/sdk";
import { runDailySummaries, mainClient } from "../src/summaries/runDailySummaries";
import { SUPPORTED_SPORTS } from "../src/summaries/slateSource";
import { isOverDailySpendCap } from "../src/runtimeHelpers";
import { getTodayInET } from "../src/shared/dateUtils";

export const dailyWidgetSummaries = schedules.task({
  id: "daily-widget-summaries",
  // 11:00 UTC = 7am ET. Late enough that the morning model run and the odds
  // refresh have landed, early enough to be in place before US daytime traffic.
  cron: { pattern: "0 11 * * *", timezone: "America/New_York" },
  // The whole slate is one run: ~50 MLB games × 3 widgets × 2 short calls.
  maxDuration: 3600,
  run: async () => {
    const main = mainClient();

    // Shares the V3 generation budget — headlines are a nice-to-have and must
    // never be the reason pick generation gets cut off.
    if (await isOverDailySpendCap(main)) {
      logger.warn("daily spend cap reached — skipping widget summaries");
      return { skipped: "spend_cap" as const };
    }

    const targetDate = getTodayInET();
    const result = await runDailySummaries({ targetDate, sports: SUPPORTED_SPORTS });

    logger.info("widget summaries complete", {
      targetDate,
      generated: result.generated,
      passed: result.passed,
      corrected: result.corrected,
      failed: result.failed,
      skipped: result.skipped,
      errorCount: result.errors.length,
    });

    // A high failure rate means the prompts or the payloads have drifted — worth
    // surfacing loudly rather than leaving users with cards that lost their headline.
    if (result.generated > 0 && result.failed / result.generated > 0.3) {
      logger.error("more than 30% of headlines failed QC", {
        failed: result.failed,
        generated: result.generated,
        sampleErrors: result.errors.slice(0, 5),
      });
    }

    return result;
  },
});
