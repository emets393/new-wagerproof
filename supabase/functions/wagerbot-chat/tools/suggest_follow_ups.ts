// suggest_follow_ups — Emits follow-up question suggestions for the user
// to tap into their next turn. Persists nothing — the questions flow through
// the SSE stream as a wagerbot.follow_ups event rendered as tappable pills.
//
// The system prompt instructs the model to call this as the LAST step of
// every response.

import type { ToolDefinition } from "./registry.ts";

export const tool: ToolDefinition = {
  name: "suggest_follow_ups",
  description:
    "Suggest 3 short follow-up questions the user might want to ask next. " +
    "Call this as the LAST step of every response, after any other tools " +
    "and after writing the final text. Each question should be specific, " +
    "actionable, and 4-12 words long. Phrase them from the user's perspective " +
    "(e.g. 'What are the best NBA value bets?' not 'Show NBA value bets').",
  parameters: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: { type: "string" },
        description: "Exactly 3 follow-up questions, each 4-12 words.",
      },
    },
    required: ["questions"],
  },
  async execute(input: { questions: string[] }, ctx) {
    const raw = Array.isArray(input?.questions) ? input.questions : [];
    const cleaned = raw
      .map((q) => String(q).trim())
      .filter((q) => q.length > 0)
      .slice(0, 5);

    ctx.emit("wagerbot.follow_ups", { questions: cleaned });

    return { ok: true, count: cleaned.length };
  },
};
