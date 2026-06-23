// V3 pick schema — V2's GeneratedPickSchema + model-set `units`. Reuses the
// shared base verbatim (do NOT edit shared/pickSchema.ts) so every V2 field
// constraint is identical; V3 only adds units.
//
// The model-facing contract is the submit_picks tool's JSON Schema, where
// `units` is a PER-AGENT enum bounded to the agent's band (built at loop start
// from unitBands) so the model can't emit 1.73 or over-ask outside its band.

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { GeneratedPickSchema } from "../generate-avatar-picks/pickSchema.ts";
import type { UnitBand } from "./unitBands.ts";

// V3 decision_trace is LENIENT (every field optional + passthrough). The base
// V2 schema's decision_trace is strict (min lengths, required metric_key/
// why_it_mattered/personality_trait) — under deepseek "auto" tool-calling the
// model fills it imperfectly, and a strict shape would reject the whole pick
// (schema_invalid). We'd rather CAPTURE an imperfect audit trace than drop the
// pick over it, so V3 overrides it with a permissive shape. `source_tool_call_id`
// is the V3 addition that links a leaned metric back to the tool call that
// produced it (kept here so Zod doesn't strip it).
const V3DecisionTrace = z
  .object({
    leaned_metrics: z
      .array(
        z
          .object({
            metric_key: z.string().optional(),
            metric: z.string().optional(), // accept either name the model emits
            metric_value: z.string().optional(),
            why_it_mattered: z.string().optional(),
            personality_trait: z.string().optional(),
            source_tool_call_id: z.string().optional(),
            weight: z.number().optional(),
          })
          .passthrough(),
      )
      .optional(),
    rationale_summary: z.string().optional(),
    personality_alignment: z.string().optional(),
    other_metrics_considered: z.array(z.string()).optional(),
  })
  .passthrough()
  .optional();

export const GeneratedPickV3Schema = GeneratedPickSchema.extend({
  units: z
    .number()
    .min(0.5)
    .max(5.0)
    .refine((u) => Math.round(u * 2) === u * 2, "units must be in 0.5 increments"),
  decision_trace: V3DecisionTrace, // override the strict base with the lenient one
  // Props are a fourth bet_type (NFL-only, signal-gated). extend() overrides the
  // base enum cleanly, exactly like it overrides decision_trace above. The four
  // prop_* fields are optional at the Zod layer (straights omit them) — the
  // submit tool enforces they're all present when bet_type==='prop'.
  bet_type: z.enum(["spread", "moneyline", "total", "prop"]),
  prop_player: z.string().optional(),
  prop_market: z.string().optional(),
  prop_line: z.number().optional(),
  prop_direction: z.enum(["over", "under"]).optional(),
});

export type GeneratedPickV3 = z.infer<typeof GeneratedPickV3Schema>;

/** Build the submit_picks tool JSON Schema with a per-agent units enum.
 *  Mirrors V2's per-pick object + `units` bounded to [band.min..band.max]. */
export function buildSubmitPicksSchema(band: UnitBand): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      slate_note: {
        type: "string",
        description:
          "One sentence on the slate overall, or why you are submitting zero picks.",
      },
      picks: {
        type: "array",
        description:
          "The picks to stake. Submit an empty array if nothing clears your confidence bar.",
        items: {
          type: "object",
          properties: {
            game_id: { type: "string", description: "Must be a game_id from the slate (verbatim)." },
            bet_type: {
              type: "string",
              enum: ["spread", "moneyline", "total", "prop"],
              description: 'The bet type. Use "prop" for a player prop (NFL-only) — only props surfaced as bettable by get_props can be staked, and the four prop_* fields below are REQUIRED.',
            },
            period: { type: "string", enum: ["full", "f5"] },
            selection: { type: "string", description: 'e.g. "Bills -1.5" / "Over 48.5" / "Yankees -120". For a prop, the full human-readable selection, e.g. "Patrick Mahomes Over 275.5 Passing Yards".' },
            odds: { type: "string", description: 'American odds with explicit sign, e.g. "-110" / "+150".' },
            prop_player: { type: "string", description: 'REQUIRED when bet_type="prop". The player name copied VERBATIM from the get_props result, e.g. "Patrick Mahomes".' },
            prop_market: { type: "string", description: 'REQUIRED when bet_type="prop". The prop market copied VERBATIM from the get_props result, e.g. "passing_yards".' },
            prop_line: { type: "number", description: 'REQUIRED when bet_type="prop". The posted line copied VERBATIM from the get_props result, e.g. 275.5.' },
            prop_direction: { type: "string", enum: ["over", "under"], description: 'REQUIRED when bet_type="prop". Which side of the line — "over" or "under".' },
            units: {
              type: "number",
              enum: band.enumValues,
              description: `Stake by conviction. Allowed for this agent: ${band.enumValues.join(", ")}.`,
            },
            confidence: { type: "integer", minimum: 1, maximum: 5 },
            reasoning: { type: "string", description: "50-600 chars, cite specific fetched numbers." },
            key_factors: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 5,
              description: "3-5 short factors, each grounded in data you fetched.",
            },
            decision_trace: {
              type: "object",
              description: "Show your work for this pick — required for auditing.",
              properties: {
                leaned_metrics: {
                  type: "array",
                  minItems: 2,
                  description: "The 2-5 metrics that actually drove this pick.",
                  items: {
                    type: "object",
                    properties: {
                      metric_key: { type: "string", description: 'The metric you leaned on, e.g. "model_total_edge", "park_factor".' },
                      metric_value: { type: "string", description: "Its value at pick time, verbatim from the tool result." },
                      why_it_mattered: { type: "string", description: "How this metric influenced the pick." },
                      personality_trait: { type: "string", description: "Which of your personality traits made this metric matter." },
                      source_tool_call_id: {
                        type: "string",
                        description: "The id of the tool call whose result this metric came from (or 'slate' if from the slate row).",
                      },
                    },
                    required: ["metric_key", "metric_value", "why_it_mattered", "personality_trait"],
                  },
                },
                rationale_summary: { type: "string", description: "Your final rationale in 1-2 sentences." },
                personality_alignment: { type: "string", description: "How this pick fits your personality." },
              },
              required: ["leaned_metrics", "rationale_summary", "personality_alignment"],
            },
          },
          // decision_trace is intentionally NOT required: forcing it bloats the
          // tool-call JSON past max_tokens and truncates the whole submission.
          // The prompt asks for it; when present it's captured (lenient V3 Zod).
          required: ["game_id", "bet_type", "selection", "odds", "units", "confidence", "reasoning", "key_factors"],
        },
      },
    },
    required: ["picks"],
  };
}

/** Build the submit_parlay tool JSON Schema. Each parlay carries legs[] (2..maxLegs,
 *  hard-capped at 4) plus ONE ticket-level stake — a parlay has a single units bet for
 *  the whole ticket, not per-leg. Leg fields mirror submit_picks. Only offered to the
 *  model when the agent's maxParlayLegs > 0. See .claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md. */
export function buildSubmitParlaySchema(band: UnitBand, maxLegs: number): Record<string, unknown> {
  const cap = Math.min(4, Math.max(2, maxLegs));
  return {
    type: "object",
    properties: {
      slate_note: {
        type: "string",
        description: "One sentence on the slate, or why you are submitting zero parlays.",
      },
      parlays: {
        type: "array",
        description:
          "Multi-leg parlay tickets. Submit an empty array if you have no parlay worth staking.",
        items: {
          type: "object",
          properties: {
            legs: {
              type: "array",
              minItems: 2,
              maxItems: cap,
              description: `The legs of this parlay (2-${cap}). Each leg must be a game whose data you fetched first.`,
              items: {
                type: "object",
                properties: {
                  game_id: { type: "string", description: "Must be a game_id from the slate (verbatim)." },
                  bet_type: { type: "string", enum: ["spread", "moneyline", "total"] },
                  period: { type: "string", enum: ["full", "f5"] },
                  selection: { type: "string", description: 'e.g. "Bills -1.5" / "Over 48.5" / "Yankees -120".' },
                  odds: { type: "string", description: 'American odds with explicit sign, e.g. "-110" / "+150".' },
                },
                required: ["game_id", "bet_type", "selection", "odds"],
              },
            },
            units: {
              type: "number",
              enum: band.enumValues,
              description: `ONE stake for the whole ticket. Allowed for this agent: ${band.enumValues.join(", ")}.`,
            },
            confidence: { type: "integer", minimum: 1, maximum: 5 },
            reasoning: { type: "string", description: "50-600 chars: why these legs together, citing fetched numbers." },
            key_factors: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 5,
              description: "2-5 short factors grounding the parlay.",
            },
          },
          required: ["legs", "units", "confidence", "reasoning", "key_factors"],
        },
      },
    },
    required: ["parlays"],
  };
}
