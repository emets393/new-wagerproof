// DEPRECATED 2026-08-01 — the LLM widget-headline pipeline. Do not extend.
//
// Superseded by the deterministic client-side formatters in
// src/features/games/detail/headlines/, which cannot contradict the numbers they sit
// above. This writer is the ONLY thing still touching ai_completions.headline_text
// (:178) — a repo-wide audit on 2026-08-01 found no reader left on web, iOS, Android,
// RN, or the MCP surfaces.
//
// ACTION FOR THE OWNER: its caller agents-v3/trigger/dailyWidgetSummaries.ts still has
// a live in-code Trigger.dev schedule, so this keeps running and burning tokens daily
// for output nobody consumes. Disable that schedule in the Trigger.dev dashboard.
// Deliberately NOT done here — this pass changes no cron expression and deletes nothing.
//
// Intentionally NOT migrated to gpt-5.6-luna (see DEFAULT_MODEL below): the replacement
// is deterministic code, so spending on a better model would be wasted.
//
// The daily headline run: load slate -> build per-widget payloads -> write ->
// quality-check -> upsert. Extracted from the Trigger.dev task so it can be
// exercised from a script against the real database without the scheduler.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateHeadline } from "./generateHeadline";
import { loadSlate, SUPPORTED_SPORTS, type SlateGame } from "./slateSource";
import {
  buildWidgetPayload,
  WIDGETS_BY_SPORT,
  type Sport,
  type WidgetType,
} from "./widgetPayloads";

// OpenAI: the writer and judge are short, cheap, structured-output calls, and
// gpt-4.1-mini is what the rest of agents-v3 currently defaults to.
const DEFAULT_MODEL = "gpt-4.1-mini";

/**
 * Same provider split as runV3Generation.resolveProvider — both endpoints speak
 * the OpenAI chat-completions shape, so only the base URL and key differ.
 * SUMMARY_MODEL exists so a local smoke test can point at whichever provider has
 * credit without editing code.
 */
function resolveProvider(): { url: string; apiKey: string; model: string } {
  const model = process.env.SUMMARY_MODEL || DEFAULT_MODEL;
  if (model.startsWith("deepseek")) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");
    return { url: "https://api.deepseek.com/v1/chat/completions", apiKey, model };
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  return { url: "https://api.openai.com/v1/chat/completions", apiKey, model };
}

export interface SummaryRunResult {
  targetDate: string;
  generated: number;
  passed: number;
  corrected: number;
  failed: number;
  skipped: number;
  errors: string[];
  usage: { inTok: number; outTok: number };
}

export interface RunOptions {
  targetDate: string;
  sports?: Sport[];
  /** Cap on games per sport — used by the smoke test to spend almost nothing. */
  maxGames?: number;
  /** Preview only: run the full pipeline but do not write to ai_completions. */
  dryRun?: boolean;
  /**
   * Writer prompts keyed `${widget_type}:${sport_type}`, used in place of the
   * ai_completion_configs rows. Only for smoke-testing before the migration that
   * seeds those rows has been applied.
   */
  promptOverrides?: Record<string, string>;
  onResult?: (r: {
    gameId: string;
    matchup: string;
    widget: WidgetType;
    headline: string;
    qcStatus: string;
    qcNotes: string | null;
  }) => void;
}

export function mainClient(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export function cfbClient(): SupabaseClient {
  return createClient(process.env.CFB_SUPABASE_URL!, process.env.CFB_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

/** Enabled writer prompts, keyed `${widget_type}:${sport_type}`. */
async function loadPrompts(main: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await main
    .from("ai_completion_configs")
    .select("widget_type, sport_type, system_prompt, enabled")
    .eq("enabled", true);
  if (error) throw new Error(`ai_completion_configs: ${error.message}`);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(`${row.widget_type}:${row.sport_type}`, row.system_prompt as string);
  }
  return map;
}

export async function runDailySummaries(opts: RunOptions): Promise<SummaryRunResult> {
  const provider = resolveProvider();

  const main = mainClient();
  const cfb = cfbClient();
  const prompts = opts.promptOverrides
    ? new Map(Object.entries(opts.promptOverrides))
    : await loadPrompts(main);

  const result: SummaryRunResult = {
    targetDate: opts.targetDate,
    generated: 0,
    passed: 0,
    corrected: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    usage: { inTok: 0, outTok: 0 },
  };

  const sports = opts.sports ?? SUPPORTED_SPORTS;

  for (const sport of sports) {
    let slate: SlateGame[];
    try {
      slate = await loadSlate(sport, cfb, main, opts.targetDate);
    } catch (e) {
      result.errors.push(`${sport}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (opts.maxGames) slate = slate.slice(0, opts.maxGames);

    for (const game of slate) {
      for (const widget of WIDGETS_BY_SPORT[sport]) {
        const systemPrompt = prompts.get(`${widget}:${sport}`);
        // No enabled config => the admin has this widget switched off.
        if (!systemPrompt) {
          result.skipped++;
          continue;
        }

        const payload = buildWidgetPayload(sport, widget, game.raw, game.fg);
        // Nothing to describe — leave the card without a headline rather than
        // inventing one from absent data.
        if (!payload) {
          result.skipped++;
          continue;
        }

        try {
          const out = await generateHeadline(payload, systemPrompt, provider);
          result.generated++;
          result.usage.inTok += out.usage.inTok;
          result.usage.outTok += out.usage.outTok;
          if (out.qcStatus === "pass") result.passed++;
          else if (out.qcStatus === "corrected") result.corrected++;
          else result.failed++;

          opts.onResult?.({
            gameId: game.gameId,
            matchup: `${game.awayTeam} @ ${game.homeTeam}`,
            widget,
            headline: out.headline,
            qcStatus: out.qcStatus,
            qcNotes: out.qcNotes,
          });

          if (opts.dryRun) continue;

          // Failures are persisted too (headline_text stays NULL) so a bad run is
          // auditable and the client's QC filter does the withholding.
          const { error } = await main.from("ai_completions").upsert(
            {
              game_id: game.gameId,
              sport_type: sport,
              widget_type: widget,
              // completion_text is NOT NULL and belongs to the older long-form
              // body. Seed it from the headline on first insert so a headline-only
              // row is still valid; an existing body is left alone by the merge.
              completion_text: out.headline || "(withheld)",
              data_payload: payload.data,
              headline_text: out.qcStatus === "fail" ? null : out.headline,
              headline_generated_at: new Date().toISOString(),
              headline_model: out.writerModel,
              qc_status: out.qcStatus,
              qc_notes: out.qcNotes,
              qc_model: out.judgeModel,
              model_used: out.writerModel,
              generated_at: new Date().toISOString(),
            },
            { onConflict: "game_id,sport_type,widget_type" },
          );
          if (error) result.errors.push(`upsert ${game.gameId}/${widget}: ${error.message}`);
        } catch (e) {
          result.errors.push(
            `${game.gameId}/${widget}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }
  }

  return result;
}
