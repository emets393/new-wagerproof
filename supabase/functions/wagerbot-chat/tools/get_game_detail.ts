// get_game_detail — Deep dive on a specific matchup. Combines predictions,
// Polymarket odds, and all available enrichment data for a single game.

import type { ToolDefinition, ToolContext } from "./registry.ts";
import { getTodayInET } from "../../shared/dateUtils.ts";

export const tool: ToolDefinition = {
  name: "get_game_detail",
  description:
    "Get a detailed breakdown of a specific game matchup. Combines model predictions, " +
    "Polymarket odds, and all available data for one game. Use this when the user " +
    "asks about a specific matchup (e.g. 'Tell me about Lakers vs Celtics').",
  parameters: {
    type: "object",
    properties: {
      league: {
        type: "string",
        enum: ["nfl", "nba", "cfb", "ncaab", "mlb"],
        description: "The sports league.",
      },
      away_team: {
        type: "string",
        description: "The away team name (e.g. 'Lakers', 'Chiefs').",
      },
      home_team: {
        type: "string",
        description: "The home team name (e.g. 'Celtics', 'Bills').",
      },
      date: {
        type: "string",
        description: "Date in YYYY-MM-DD format. Defaults to today.",
      },
    },
    required: ["league", "away_team", "home_team"],
  },
  async execute(
    input: { league: string; away_team: string; home_team: string; date?: string },
    ctx: ToolContext,
  ) {
    const targetDate = input.date || getTodayInET();
    const away = input.away_team.toLowerCase();
    const home = input.home_team.toLowerCase();

    // Route to sport-specific table
    let games: any[] = [];
    switch (input.league) {
      case "nba": {
        const { data } = await ctx.cfbSupabase
          .from("nba_input_values_view")
          .select("*")
          .eq("game_date", targetDate);
        games = data || [];
        break;
      }
      case "nfl": {
        const { data: latestRun } = await ctx.cfbSupabase
          .from("nfl_predictions_epa")
          .select("run_id")
          .order("run_id", { ascending: false })
          .limit(1)
          .single();
        if (latestRun) {
          const { data } = await ctx.cfbSupabase
            .from("nfl_predictions_epa")
            .select("*")
            .eq("run_id", latestRun.run_id);
          games = data || [];
        }
        break;
      }
      case "cfb": {
        const { data } = await ctx.cfbSupabase
          .from("cfb_live_weekly_inputs")
          .select("*");
        games = data || [];
        break;
      }
      case "ncaab": {
        const { data } = await ctx.cfbSupabase
          .from("v_cbb_input_values")
          .select("*")
          .eq("game_date_et", targetDate);
        games = data || [];
        break;
      }
      case "mlb": {
        const { data } = await ctx.cfbSupabase
          .from("mlb_games_today")
          .select("*")
          .eq("official_date", targetDate);
        games = data || [];
        break;
      }
    }

    // Find the matching game (fuzzy match on team names)
    const match = games.find((g: any) => {
      const gAway = (g.away_team || g.away_team_name || "").toLowerCase();
      const gHome = (g.home_team || g.home_team_name || "").toLowerCase();
      return (gAway.includes(away) || away.includes(gAway)) &&
             (gHome.includes(home) || home.includes(gHome));
    });

    if (!match) {
      // Try swapped order
      const swapped = games.find((g: any) => {
        const gAway = (g.away_team || g.away_team_name || "").toLowerCase();
        const gHome = (g.home_team || g.home_team_name || "").toLowerCase();
        return (gAway.includes(home) || home.includes(gAway)) &&
               (gHome.includes(away) || away.includes(gHome));
      });
      if (!swapped) {
        return {
          found: false,
          message: `No ${input.league.toUpperCase()} game found matching ${input.away_team} @ ${input.home_team} on ${targetDate}`,
        };
      }
      // Return the swapped match with all raw data
      return { found: true, game: swapped, league: input.league, date: targetDate };
    }

    // Fetch Polymarket data for this specific game
    const gameKey = `${input.league}_${(match.away_team || match.away_team_name || "").toLowerCase()}_${(match.home_team || match.home_team_name || "").toLowerCase()}`;
    let polymarket = null;
    try {
      const { data } = await ctx.supabase
        .from("polymarket_markets")
        .select("*")
        .eq("league", input.league)
        .ilike("game_key", `%${(match.away_team || match.away_team_name || "").toLowerCase()}%`);
      if (data && data.length > 0) polymarket = data;
    } catch { /* non-critical */ }

    return {
      found: true,
      game: match,
      polymarket,
      league: input.league,
      date: targetDate,
    };
  },
};
