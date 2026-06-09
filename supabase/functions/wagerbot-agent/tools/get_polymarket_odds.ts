// get_polymarket_odds — Fetch prediction market probabilities from Polymarket.
// Returns real-money market odds for games, cached in polymarket_markets table.

import type { ToolDefinition, ToolContext } from "./registry.ts";

export const tool: ToolDefinition = {
  name: "get_polymarket_odds",
  description:
    "Get Polymarket prediction market odds for sports games. Returns real-money " +
    "market probabilities from Polymarket. Useful for comparing model predictions " +
    "against prediction market consensus. Use this when the user asks about " +
    "Polymarket, prediction markets, or market consensus.",
  parameters: {
    type: "object",
    properties: {
      league: {
        type: "string",
        enum: ["nfl", "nba", "cfb", "ncaab", "mlb"],
        description: "The sports league to get Polymarket odds for.",
      },
      team: {
        type: "string",
        description: "Optional team name to filter results.",
      },
    },
    required: ["league"],
  },
  async execute(input: { league: string; team?: string }, ctx: ToolContext) {
    let query = ctx.supabase
      .from("polymarket_markets")
      .select("*")
      .eq("league", input.league);

    const { data: markets, error } = await query;

    if (error) throw new Error(`Polymarket query failed: ${error.message}`);
    if (!markets || markets.length === 0) {
      return { markets: [], message: `No Polymarket data found for ${input.league}` };
    }

    let filtered = markets;
    if (input.team) {
      const t = input.team.toLowerCase();
      filtered = markets.filter(
        (m: any) =>
          m.game_key?.toLowerCase().includes(t) ||
          m.question?.toLowerCase().includes(t),
      );
    }

    // Group by game_key for cleaner output
    const grouped = new Map<string, any[]>();
    for (const market of filtered) {
      const key = market.game_key || "unknown";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({
        question: market.question,
        market_type: market.market_type,
        outcome_yes: market.current_away_odds,
        outcome_no: market.current_home_odds,
        last_updated: market.last_updated,
      });
    }

    const result = Array.from(grouped.entries()).map(([gameKey, mkts]) => ({
      game_key: gameKey,
      markets: mkts,
    }));

    return { games: result, league: input.league, count: result.length };
  },
};
