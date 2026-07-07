// weeklyParlayAutoGenV3 — the scheduled fan-out for week-long parlay tickets.
// Clone of dailyAutoGenV3, keyed on the football week (ET Tuesday anchor,
// Tue→Mon) instead of the calendar day. Polls Tue–Thu daytime ET: lines post
// Tuesday, and Thursday coverage catches agents whose owners enable the setting
// just before TNF. Eligibility is idempotent (NOT EXISTS weekly auto run this
// week), so re-polling is safe.
// See .claude/docs/agents/16_PARLAY_AGENTS.md (week window design).

import { schedules, logger } from "@trigger.dev/sdk";
import { generateV3Picks } from "./generateV3Picks";
import type { RunV3Payload } from "../src/loop/runV3Generation";
import { ledgerClient, isOverDailySpendCap } from "../src/runtimeHelpers";
import { getTodayInET, getFootballWeekKeyET } from "../src/shared/dateUtils";

const DEFAULT_MODEL = "deepseek-v4-flash";

export const weeklyParlayAutoGenV3 = schedules.task({
  id: "weekly-parlay-auto-gen-v3",
  // Every 30 min, Tue–Thu 8am–8pm ET. One weekly RUN per agent per football week
  // (that run submits up to 3 distinct tickets) — the NOT EXISTS in the
  // eligibility RPC makes later ticks no-ops.
  cron: { pattern: "*/30 8-20 * * 2-4", timezone: "America/New_York" },
  run: async (payload) => {
    const main = ledgerClient();

    if (await isOverDailySpendCap(main)) {
      logger.warn("daily spend cap reached — skipping weekly-parlay tick");
      return { skipped: "spend_cap" as const };
    }

    // Eligibility lives in SQL: active + auto_generate + weekly_parlay_enabled
    // (personality_params) + NFL/CFB coverage + autopilot entitlement + owner
    // active <5d + no weekly auto run this football week yet.
    const { data: due, error } = await main.rpc("select_due_weekly_parlay_avatars_v3_trigger", {
      p_now: payload.timestamp.toISOString(),
      p_limit: 50,
    });
    if (error) {
      logger.error("weekly eligibility query failed", { error: error.message });
      return { error: error.message };
    }
    const avatars = (due ?? []) as { avatar_id: string; user_id: string }[];
    if (avatars.length === 0) return { triggered: 0 };

    const targetDate = getTodayInET();
    const weekKey = getFootballWeekKeyET(payload.timestamp);
    const items: { payload: RunV3Payload; options: { idempotencyKey: string; tags: string[]; metadata: Record<string, string> } }[] = [];

    for (const a of avatars) {
      const { data: row, error: insErr } = await main
        .from("agent_generation_runs")
        .insert({
          avatar_id: a.avatar_id,
          user_id: a.user_id,
          generation_type: "auto",
          target_date: targetDate,
          run_scope: "weekly",
          week_key: weekKey,
          engine_version: "v3_trigger",
          status: "queued",
          priority: 50,
          model_name: DEFAULT_MODEL,
        })
        .select("id")
        .single();
      if (insErr || !row) {
        logger.warn("weekly ledger insert failed", { avatar: a.avatar_id, error: insErr?.message });
        continue;
      }
      items.push({
        payload: { ledgerRunId: row.id as string, avatarId: a.avatar_id, targetDate, generationType: "auto", window: "week" },
        options: {
          idempotencyKey: `auto-weekly:${a.avatar_id}:${weekKey}`,
          tags: [`avatar:${a.avatar_id}`, `user:${a.user_id}`, "type:auto", "scope:weekly"],
          metadata: {
            phase: "queued",
            avatarId: a.avatar_id,
            ledgerRunId: row.id as string,
            targetDate,
            weekKey,
          },
        },
      });
    }

    if (items.length > 0) {
      await generateV3Picks.batchTrigger(items);
      // No last_auto_generated_at stamp here — that field gates the DAILY
      // autopilot; weekly dedupe is the ledger NOT EXISTS + idempotency key.
    }

    logger.info("weekly-parlay tick", { eligible: avatars.length, triggered: items.length, weekKey });
    return { triggered: items.length, weekKey };
  },
});
