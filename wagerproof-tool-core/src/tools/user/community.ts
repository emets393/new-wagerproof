// User-data tools for the signed-in user's community activity and self-logged
// record. RLS-scoped (user JWT) + explicit user_id filter as defense in depth.

import { readOnly, asOptNumber, type Tool, type ToolContext } from "../../types.js";

function requireUser(ctx: ToolContext): string {
  if (!ctx.userId) throw new Error("This tool requires an authenticated user.");
  return ctx.userId;
}

export const getMyCommunityActivity: Tool = {
  name: "get_my_community_activity",
  title: "Get my community activity",
  scope: "user",
  description:
    "List the community picks the signed-in user has posted, with each pick's " +
    "reasoning, graded outcome, and net up/down votes from the community.",
  annotations: readOnly("Get my community activity"),
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max picks to return (default 25, max 100)." },
    },
    additionalProperties: false,
  },
  async execute(input, ctx) {
    const userId = requireUser(ctx);
    const limit = Math.min(Math.max(asOptNumber(input.limit) ?? 25, 1), 100);
    const { data, error } = await ctx.main
      .from("community_picks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`community_picks query failed: ${error.message}`);

    const picks = (data ?? []).map((p) => ({
      id: p.id,
      sport: p.sport,
      team: p.team_name,
      opponent: p.opponent_team,
      pick_type: p.pick_type,
      selection: p.pick_details,
      reasoning: p.reasoning,
      game_date: p.game_date,
      outcome: p.outcome,
      upvotes: p.upvotes,
      downvotes: p.downvotes,
      created_at: p.created_at,
    }));
    return { count: picks.length, picks };
  },
};

export const getMyRecord: Tool = {
  name: "get_my_record",
  title: "Get my betting record",
  scope: "user",
  description:
    "Summarize the signed-in user's self-logged community-pick record: total picks, " +
    "wins/losses/pushes, win rate, a per-sport breakdown, and how many wins they've " +
    "shared. Informational tracking only.",
  annotations: readOnly("Get my betting record"),
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  async execute(_input, ctx) {
    const userId = requireUser(ctx);

    const { data: picks, error } = await ctx.main
      .from("community_picks")
      .select("sport, outcome")
      .eq("user_id", userId);
    if (error) throw new Error(`community_picks query failed: ${error.message}`);

    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let pending = 0;
    const bySport: Record<string, { wins: number; losses: number; pushes: number; pending: number }> = {};
    for (const p of picks ?? []) {
      const sport = String(p.sport ?? "unknown");
      bySport[sport] ??= { wins: 0, losses: 0, pushes: 0, pending: 0 };
      const o = p.outcome;
      if (o === "win") {
        wins++;
        bySport[sport].wins++;
      } else if (o === "loss") {
        losses++;
        bySport[sport].losses++;
      } else if (o === "push") {
        pushes++;
        bySport[sport].pushes++;
      } else {
        pending++;
        bySport[sport].pending++;
      }
    }
    const decided = wins + losses;
    const winRate = decided > 0 ? Math.round((wins / decided) * 1000) / 1000 : null;

    // Shared wins are best-effort (separate feature; non-critical).
    let sharedWins = 0;
    try {
      const { data: shared } = await ctx.main
        .from("user_wins")
        .select("id")
        .eq("user_id", userId);
      sharedWins = (shared ?? []).length;
    } catch {
      /* non-critical */
    }

    return {
      total_picks: (picks ?? []).length,
      record: `${wins}-${losses}-${pushes}`,
      wins,
      losses,
      pushes,
      pending,
      win_rate: winRate,
      by_sport: bySport,
      shared_wins: sharedWins,
    };
  },
};

export const communityTools: Tool[] = [getMyCommunityActivity, getMyRecord];
