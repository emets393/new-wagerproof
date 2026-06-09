// search_games — Search for games across all leagues by team name.
// Useful when the user mentions a team without specifying the league.

import type { ToolDefinition, ToolContext } from "./registry.ts";
import { getTodayInET } from "../../shared/dateUtils.ts";

export const tool: ToolDefinition = {
  name: "search_games",
  description:
    "Search for games across all sports leagues by team name. Use this when the " +
    "user mentions a team without specifying the league, or when you need to find " +
    "which league a team plays in. Searches NFL, NBA, CFB, NCAAB, and MLB.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Team name to search for (e.g. 'Lakers', 'Chiefs', 'Alabama').",
      },
      date: {
        type: "string",
        description: "Date in YYYY-MM-DD format. Defaults to today.",
      },
    },
    required: ["query"],
  },
  async execute(input: { query: string; date?: string }, ctx: ToolContext) {
    const targetDate = input.date || getTodayInET();
    const q = input.query.toLowerCase();
    const results: Array<{ league: string; matchup: string; game_date: string }> = [];

    // Search all leagues in parallel
    const [nba, nfl, cfb, ncaab, mlb] = await Promise.allSettled([
      ctx.cfbSupabase.from("nba_input_values_view").select("away_team, home_team, game_date").eq("game_date", targetDate),
      (async () => {
        const { data: run } = await ctx.cfbSupabase.from("nfl_predictions_epa").select("run_id").order("run_id", { ascending: false }).limit(1).single();
        if (!run) return { data: null };
        return ctx.cfbSupabase.from("nfl_predictions_epa").select("away_team, home_team, game_date").eq("run_id", run.run_id);
      })(),
      ctx.cfbSupabase.from("cfb_live_weekly_inputs").select("away_team, home_team, game_date"),
      ctx.cfbSupabase.from("v_cbb_input_values").select("away_team, home_team, game_date_et").eq("game_date_et", targetDate),
      ctx.cfbSupabase.from("mlb_games_today").select("away_team_name, home_team_name, official_date").eq("official_date", targetDate),
    ]);

    const searchLeague = (
      leagueName: string,
      result: PromiseSettledResult<any>,
      awayKey: string,
      homeKey: string,
      dateKey: string,
    ) => {
      if (result.status !== "fulfilled" || !result.value.data) return;
      for (const g of result.value.data) {
        const away = (g[awayKey] || "").toLowerCase();
        const home = (g[homeKey] || "").toLowerCase();
        if (away.includes(q) || home.includes(q) || q.includes(away) || q.includes(home)) {
          results.push({
            league: leagueName,
            matchup: `${g[awayKey]} @ ${g[homeKey]}`,
            game_date: g[dateKey],
          });
        }
      }
    };

    searchLeague("NBA", nba, "away_team", "home_team", "game_date");
    searchLeague("NFL", nfl, "away_team", "home_team", "game_date");
    searchLeague("CFB", cfb, "away_team", "home_team", "game_date");
    searchLeague("NCAAB", ncaab, "away_team", "home_team", "game_date_et");
    searchLeague("MLB", mlb, "away_team_name", "home_team_name", "official_date");

    if (results.length === 0) {
      return { results: [], message: `No games found matching "${input.query}" on ${targetDate}` };
    }

    return { results, count: results.length, search_query: input.query, date: targetDate };
  },
};
