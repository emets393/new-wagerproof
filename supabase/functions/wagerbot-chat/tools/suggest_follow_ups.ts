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
    "MANDATORY: Call this as the absolute LAST step of EVERY response, after writing your final text. " +
    "Provide 3 specific follow-up questions the user might ask next. " +
    "Questions should be actionable, 4-12 words, phrased from the user's perspective. " +
    "Example: 'What are the best NBA value bets tonight?' — NOT 'Show NBA value bets'. " +
    "You MUST call this tool on every single response without exception.",
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
