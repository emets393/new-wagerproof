// get_my_agents — the signed-in user's own AI agents ("avatars") + records.
// V2 chat: data source for `agent` components. Uses the service-role Main
// client filtered by the authenticated userId (defense in depth).

import type { ToolDefinition, ToolContext } from "./registry.ts";

export const tool: ToolDefinition = {
  name: "get_my_agents",
  description:
    "Get the signed-in user's own WagerProof AI prediction agents and their win-loss " +
    "records, win rate, net units, and streak. Use when the user asks about their agents, " +
    "their agents' performance, or to surface an agent. Returns each agent's id (needed to " +
    "render an `agent` component via present_components).",
  parameters: {
    type: "object",
    properties: {},
  },
  async execute(_input: Record<string, never>, ctx: ToolContext) {
    const { data: agents, error } = await ctx.supabase
      .from("avatar_profiles")
      .select("id, name, avatar_emoji, archetype, preferred_sports, is_active")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`avatar_profiles query failed: ${error.message}`);
    if (!agents || agents.length === 0) {
      return { agents: [], message: "You don't have any agents yet." };
    }

    const ids = agents.map((a: any) => a.id);
    const perfById = new Map<string, any>();
    try {
      const { data: perf } = await ctx.supabase
        .from("avatar_performance_cache")
        .select("avatar_id, wins, losses, pushes, win_rate, net_units, current_streak")
        .in("avatar_id", ids);
      for (const p of perf || []) perfById.set(p.avatar_id, p);
    } catch { /* non-critical */ }

    const formatted = agents.map((a: any) => {
      const p = perfById.get(a.id);
      return {
        agent_id: a.id,
        name: a.name,
        emoji: a.avatar_emoji,
        archetype: a.archetype,
        preferred_sports: a.preferred_sports,
        record: p ? `${p.wins}-${p.losses}-${p.pushes}` : "0-0-0",
        win_rate: p?.win_rate ?? null,
        net_units: p?.net_units ?? 0,
        current_streak: p?.current_streak ?? 0,
      };
    });
    return { agents: formatted, count: formatted.length };
  },
};
