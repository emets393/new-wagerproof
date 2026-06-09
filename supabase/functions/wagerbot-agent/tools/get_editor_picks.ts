// get_editor_picks — Fetch current editor/expert picks with reasoning.

import type { ToolDefinition, ToolContext } from "./registry.ts";

export const tool: ToolDefinition = {
  name: "get_editor_picks",
  description:
    "Get published editor/expert staff picks with reasoning and W-L tracking. " +
    "ONLY call this when the user explicitly asks about editor picks, expert picks, or staff recommendations. " +
    "Do NOT use this for general predictions — use the sport-specific prediction tools instead. " +
    "Call once only — it returns up to 20 recent picks.",
  parameters: {
    type: "object",
    properties: {
      game_type: {
        type: "string",
        enum: ["nfl", "nba", "cfb", "ncaab", "mlb"],
        description: "Optional sport to filter picks.",
      },
      result: {
        type: "string",
        enum: ["won", "lost", "push", "pending"],
        description: "Optional result filter. Defaults to showing all published picks.",
      },
    },
  },
  async execute(input: { game_type?: string; result?: string }, ctx: ToolContext) {
    let query = ctx.supabase
      .from("editors_picks")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(20);

    if (input.game_type) {
      query = query.eq("game_type", input.game_type);
    }
    if (input.result) {
      query = query.eq("result", input.result);
    }

    const { data: picks, error } = await query;

    if (error) throw new Error(`Editor picks query failed: ${error.message}`);
    if (!picks || picks.length === 0) {
      return { picks: [], message: "No editor picks found matching your criteria" };
    }

    const formatted = picks.map((pick: any) => ({
      id: pick.id,
      game_type: pick.game_type,
      game_id: pick.game_id,
      bet_type: pick.selected_bet_type || pick.bet_type,
      pick_value: pick.pick_value,
      best_price: pick.best_price,
      sportsbook: pick.sportsbook,
      units: pick.units,
      editors_notes: pick.editors_notes,
      result: pick.result,
      is_free_pick: pick.is_free_pick,
      created_at: pick.created_at,
      // Include archived game data if available for context
      game_info: pick.archived_game_data
        ? {
            away_team: pick.archived_game_data.awayTeam,
            home_team: pick.archived_game_data.homeTeam,
            game_date: pick.archived_game_data.gameDate,
          }
        : null,
    }));

    return { picks: formatted, count: formatted.length };
  },
};
