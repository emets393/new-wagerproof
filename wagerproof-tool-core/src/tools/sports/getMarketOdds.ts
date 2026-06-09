// get_market_odds — Polymarket (real-money prediction market) prices for a
// league, grouped by game. Ported from chat get_polymarket_odds.ts. Useful for
// comparing WagerProof's model estimates against market consensus.

import { readOnly, asOptString, asSport, type Tool } from "../../types.js";

export const getMarketOdds: Tool = {
  name: "get_market_odds",
  title: "Get prediction-market odds",
  scope: "global",
  annotations: readOnly("Get prediction-market odds"),
  description:
    "Get Polymarket prediction-market prices for a league's games, grouped by game. " +
    "These are real-money market-implied probabilities — useful for comparing the " +
    "WagerProof model's estimate against market consensus. Reports market data; not advice.",
  inputSchema: {
    type: "object",
    properties: {
      sport: {
        type: "string",
        enum: ["nfl", "nba", "cfb", "ncaab", "mlb"],
        description: "The league to get market odds for.",
      },
      team: { type: "string", description: "Optional team-name filter." },
    },
    required: ["sport"],
    additionalProperties: false,
  },
  async execute(input, ctx) {
    const sport = asSport(input.sport);
    if (!sport) throw new Error("Invalid `sport`.");
    const team = asOptString(input.team);

    const { data: markets, error } = await ctx.main
      .from("polymarket_markets")
      .select("*")
      .eq("league", sport);
    if (error) throw new Error(`Polymarket query failed: ${error.message}`);
    if (!markets || markets.length === 0) {
      return { games: [], message: `No Polymarket data found for ${sport}` };
    }

    let filtered = markets;
    if (team) {
      const t = team.toLowerCase();
      filtered = markets.filter(
        (m) =>
          String(m.game_key ?? "").toLowerCase().includes(t) ||
          String(m.question ?? "").toLowerCase().includes(t),
      );
    }

    const grouped = new Map<string, unknown[]>();
    for (const m of filtered) {
      const key = String(m.game_key ?? "unknown");
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({
        question: m.question,
        market_type: m.market_type,
        outcome_yes: m.current_away_odds,
        outcome_no: m.current_home_odds,
        last_updated: m.last_updated,
      });
    }

    const games = Array.from(grouped.entries()).map(([game_key, markets]) => ({
      game_key,
      markets,
    }));
    return { games, sport, count: games.length };
  },
};
