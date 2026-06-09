// get_game_detail — deep dive on one matchup: the sport's full input row plus
// any Polymarket markets for that game. Ported from chat get_game_detail.ts.

import { readOnly, asOptString, asString, asSport, type Tool } from "../../types.js";

export const getGameDetail: Tool = {
  name: "get_game_detail",
  title: "Get game detail",
  scope: "global",
  annotations: readOnly("Get game detail"),
  description:
    "Get a detailed breakdown of one specific matchup: the full model + analytics " +
    "row for the game and any matching prediction-market (Polymarket) prices. Use " +
    "this when the user asks about a specific game (e.g. 'Lakers vs Celtics'). " +
    "Returns model estimates and market data for analysis, not betting advice.",
  inputSchema: {
    type: "object",
    properties: {
      sport: {
        type: "string",
        enum: ["nfl", "nba", "cfb", "ncaab", "mlb"],
        description: "The league.",
      },
      away_team: { type: "string", description: "Away team name (e.g. 'Lakers')." },
      home_team: { type: "string", description: "Home team name (e.g. 'Celtics')." },
      date: { type: "string", description: "Date YYYY-MM-DD (ET). Defaults to today." },
    },
    required: ["sport", "away_team", "home_team"],
    additionalProperties: false,
  },
  async execute(input, ctx) {
    const sport = asSport(input.sport);
    if (!sport) throw new Error("Invalid `sport`.");
    const date = asOptString(input.date) ?? ctx.today();
    const away = asString(input.away_team).toLowerCase();
    const home = asString(input.home_team).toLowerCase();
    const cfb = ctx.cfb;

    let games: Record<string, unknown>[] = [];
    switch (sport) {
      case "nba": {
        const { data } = await cfb.from("nba_input_values_view").select("*").eq("game_date", date);
        games = data ?? [];
        break;
      }
      case "nfl": {
        const { data: latestRun } = await cfb
          .from("nfl_predictions_epa")
          .select("run_id")
          .order("run_id", { ascending: false })
          .limit(1)
          .single();
        if (latestRun) {
          const { data } = await cfb
            .from("nfl_predictions_epa")
            .select("*")
            .eq("run_id", (latestRun as Record<string, unknown>).run_id);
          games = data ?? [];
        }
        break;
      }
      case "cfb": {
        const { data } = await cfb.from("cfb_live_weekly_inputs").select("*");
        games = data ?? [];
        break;
      }
      case "ncaab": {
        const { data } = await cfb.from("v_cbb_input_values").select("*").eq("game_date_et", date);
        games = data ?? [];
        break;
      }
      case "mlb": {
        const { data } = await cfb.from("mlb_games_today").select("*").eq("official_date", date);
        games = data ?? [];
        break;
      }
    }

    const teamsOf = (g: Record<string, unknown>) => ({
      gAway: String(g.away_team ?? g.away_team_name ?? "").toLowerCase(),
      gHome: String(g.home_team ?? g.home_team_name ?? "").toLowerCase(),
    });
    const matches = (g: Record<string, unknown>, a: string, h: string) => {
      const { gAway, gHome } = teamsOf(g);
      return (
        (gAway.includes(a) || a.includes(gAway)) && (gHome.includes(h) || h.includes(gHome))
      );
    };

    let match = games.find((g) => matches(g, away, home));
    if (!match) {
      const swapped = games.find((g) => matches(g, home, away));
      if (!swapped) {
        return {
          found: false,
          message: `No ${sport.toUpperCase()} game found matching ${input.away_team} @ ${input.home_team} on ${date}`,
        };
      }
      return { found: true, game: swapped, sport, date };
    }

    // Polymarket markets for this game (best-effort; non-critical).
    let polymarket: unknown = null;
    try {
      const awayName = String(match.away_team ?? match.away_team_name ?? "").toLowerCase();
      const { data } = await ctx.main
        .from("polymarket_markets")
        .select("*")
        .eq("league", sport)
        .ilike("game_key", `%${awayName}%`);
      if (data && data.length > 0) polymarket = data;
    } catch {
      /* non-critical */
    }

    return { found: true, game: match, polymarket, sport, date };
  },
};
