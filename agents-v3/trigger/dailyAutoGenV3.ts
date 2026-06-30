// dailyAutoGenV3 — the scheduled fan-out that replaces the legacy pg_cron
// enqueue_due_auto_generation_runs_v2. Every 10 min it asks Supabase which
// avatars are due (the eligibility predicates live in SQL, reusing
// can_use_agent_autopilot), creates a ledger row per avatar, and batch-triggers
// generateV3Picks. Idempotency keys make a same-day re-run a no-op.
// See .claude/docs/agents/11_GENERATION_V3_TRIGGERDEV.md

import { schedules, logger } from "@trigger.dev/sdk";
import { generateV3Picks } from "./generateV3Picks";
import type { RunV3Payload } from "../src/loop/runV3Generation";
import { ledgerClient, isOverDailySpendCap } from "../src/runtimeHelpers";
import { getTodayInET } from "../src/shared/dateUtils";

const DEFAULT_MODEL = "deepseek-v4-flash";

export const dailyAutoGenV3 = schedules.task({
  id: "daily-auto-gen-v3",
  // Every 10 min (matches the legacy cadence). Each avatar is gated on its own
  // auto_generate_time + timezone inside the eligibility RPC, so this just polls.
  cron: "*/10 * * * *",
  run: async (payload) => {
    const main = ledgerClient();

    if (await isOverDailySpendCap(main)) {
      logger.warn("daily spend cap reached — skipping auto-gen tick");
      return { skipped: "spend_cap" as const };
    }

    // Eligibility lives in SQL (avatar_profiles ⋈ profiles, can_use_agent_autopilot,
    // not-yet-today, auto_generate_time passed, user active < 5d). SELECT-only — it
    // does NOT enqueue into the legacy queue.
    const { data: due, error } = await main.rpc("select_due_auto_avatars_v3_trigger", {
      p_now: payload.timestamp.toISOString(),
      p_limit: 50,
    });
    if (error) {
      logger.error("eligibility query failed", { error: error.message });
      return { error: error.message };
    }
    const avatars = (due ?? []) as { avatar_id: string; user_id: string }[];
    if (avatars.length === 0) return { triggered: 0 };

    const targetDate = getTodayInET();
    const items: { payload: RunV3Payload; options: { idempotencyKey: string; tags: string[]; metadata: Record<string, string> } }[] = [];
    const triggeredAvatarIds: string[] = [];

    for (const a of avatars) {
      // Pre-create the ledger row (engine_version='v3_trigger' → invisible to the
      // legacy dispatcher) so runV3Generation has a row to mark.
      const { data: row, error: insErr } = await main
        .from("agent_generation_runs")
        .insert({
          avatar_id: a.avatar_id,
          user_id: a.user_id,
          generation_type: "auto",
          target_date: targetDate,
          engine_version: "v3_trigger",
          status: "queued",
          priority: 50,
          model_name: DEFAULT_MODEL,
        })
        .select("id")
        .single();
      if (insErr || !row) {
        logger.warn("ledger insert failed", { avatar: a.avatar_id, error: insErr?.message });
        continue;
      }
      items.push({
        payload: { ledgerRunId: row.id as string, avatarId: a.avatar_id, targetDate, generationType: "auto" },
        options: {
          idempotencyKey: `auto:${a.avatar_id}:${targetDate}`,
          tags: [`avatar:${a.avatar_id}`, `user:${a.user_id}`, "type:auto"],
          metadata: {
            phase: "queued",
            avatarId: a.avatar_id,
            ledgerRunId: row.id as string,
            targetDate,
          },
        },
      });
      triggeredAvatarIds.push(a.avatar_id);
    }

    if (items.length > 0) {
      await generateV3Picks.batchTrigger(items);
      // Stamp last_auto_generated_at so the next tick excludes these avatars today
      // (the idempotencyKey is the hard dedupe; this is the soft one).
      await main
        .from("avatar_profiles")
        .update({ last_auto_generated_at: payload.timestamp.toISOString() })
        .in("id", triggeredAvatarIds);
    }

    logger.info("auto-gen tick", { eligible: avatars.length, triggered: items.length });
    return { triggered: items.length };
  },
});
