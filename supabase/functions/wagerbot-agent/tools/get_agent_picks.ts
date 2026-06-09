// get_agent_picks — recent picks from the signed-in user's agents. V2 chat:
// data source for `agent_pick` components. Scoped to the user's own avatars
// (resolve the user's avatar ids first, then query their picks).

import type { ToolDefinition, ToolContext } from "./registry.ts";

export const tool: ToolDefinition = {
  name: "get_agent_picks",
  description:
    "Get recent picks made by the signed-in user's agents, with each pick's reasoning, " +
    "confidence, and graded result. Optionally filter to one agent_id. Use when the user asks " +
    "what their agents picked. Returns picks suitable for `agent_pick` components.",
  parameters: {
    type: "object",
    properties: {
      agent_id: { type: "string", description: "Optional avatar id to filter to one agent." },
      limit: { type: "number", description: "Max picks (default 10, max 30)." },
    },
  },
  async execute(input: { agent_id?: string; limit?: number }, ctx: ToolContext) {
    // Resolve the user's own agents first (RLS/ownership guard).
    const { data: agents, error: aErr } = await ctx.supabase
      .from("avatar_profiles")
      .select("id, name")
      .eq("user_id", ctx.userId);
    if (aErr) throw new Error(`avatar_profiles query failed: ${aErr.message}`);
    let owned = agents || [];
    if (input.agent_id) owned = owned.filter((a: any) => a.id === input.agent_id);
    if (owned.length === 0) return { picks: [], message: "No matching agents." };

    const nameById = new Map(owned.map((a: any) => [a.id, a.name]));
    const ids = owned.map((a: any) => a.id);
    const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 30);

    const { data: picks, error } = await ctx.supabase
      .from("avatar_picks")
      .select("id, avatar_id, sport, matchup, game_date, bet_type, pick_selection, odds, confidence, reasoning_text, result")
      .in("avatar_id", ids)
      .order("game_date", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`avatar_picks query failed: ${error.message}`);

    const formatted = (picks || []).map((p: any) => ({
      pick_id: p.id,
      agent_id: p.avatar_id,
      agent_name: nameById.get(p.avatar_id),
      sport: p.sport,
      matchup: p.matchup,
      game_date: p.game_date,
      bet_type: p.bet_type,
      selection: p.pick_selection,
      odds: p.odds,
      confidence: p.confidence,
      reasoning: p.reasoning_text,
      result: p.result,
    }));
    return { picks: formatted, count: formatted.length };
  },
};
