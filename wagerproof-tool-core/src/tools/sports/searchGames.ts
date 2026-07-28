// search_games — find games across all five leagues by team name. Ported from
// chat search_games.ts. Useful when the user names a team without a league.

import { readOnly, asOptString, asString, type Tool } from "../../types.js";

export const searchGames: Tool = {
  name: "search_games",
  title: "Search games",
  scope: "global",
  annotations: readOnly("Search games"),
  description:
    "Search for games across all sports leagues (NFL, NBA, CFB, NCAAB, MLB) by team " +
    "name. Use this when the user names a team without specifying the league, or to " +
    "find which league a team plays in. Start here for ambiguous team references.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Team name (e.g. 'Lakers', 'Chiefs', 'Alabama')." },
      date: { type: "string", description: "Date YYYY-MM-DD (ET). Defaults to today." },
    },
    required: ["query"],
    additionalProperties: false,
  },
  async execute(input, ctx) {
    const date = asOptString(input.date) ?? ctx.today();
    const q = asString(input.query).toLowerCase().trim();
    if (!q) return { results: [], message: "Empty query." };
    const cfb = ctx.cfb;
    const results: Array<{ league: string; matchup: string; game_date: unknown }> = [];

    const [nba, nfl, cfbRes, ncaab, mlb] = await Promise.allSettled([
      cfb.from("nba_input_values_view").select("away_team, home_team, game_date").eq("game_date", date),
      (async () => {
        // NFL reads the new model's weekly table nfl_dryrun_games; latest
        // (season, week) = current slate. game_date → gameday.
        const { data: anchor } = await cfb
          .from("nfl_dryrun_games")
          .select("season, week")
          .order("season", { ascending: false })
          .order("week", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!anchor) return { data: null, error: null };
        return cfb
          .from("nfl_dryrun_games")
          .select("home_team, away_team, gameday, kickoff, game_id")
          .eq("season", (anchor as Record<string, unknown>).season)
          .eq("week", (anchor as Record<string, unknown>).week);
      })(),
      (async () => {
        // CFB reads the new model's weekly table cfb_dryrun_games; latest
        // (season, week) = current slate. game_date → kickoff.
        const { data: anchor } = await cfb
          .from("cfb_dryrun_games")
          .select("season, week")
          .order("season", { ascending: false })
          .order("week", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!anchor) return { data: null, error: null };
        return cfb
          .from("cfb_dryrun_games")
          .select("away_team, home_team, kickoff")
          .eq("season", (anchor as Record<string, unknown>).season)
          .eq("week", (anchor as Record<string, unknown>).week);
      })(),
      cfb.from("v_cbb_input_values").select("away_team, home_team, game_date_et").eq("game_date_et", date),
      cfb
        .from("mlb_games_today")
        .select("away_team_name, home_team_name, official_date")
        .eq("official_date", date),
    ]);

    const collect = (
      league: string,
      settled: PromiseSettledResult<{ data: Record<string, unknown>[] | null }>,
      awayKey: string,
      homeKey: string,
      dateKey: string,
    ) => {
      if (settled.status !== "fulfilled" || !settled.value.data) return;
      for (const g of settled.value.data) {
        const away = String(g[awayKey] ?? "").toLowerCase();
        const home = String(g[homeKey] ?? "").toLowerCase();
        if (away.includes(q) || home.includes(q) || q.includes(away) || q.includes(home)) {
          results.push({
            league,
            matchup: `${g[awayKey]} @ ${g[homeKey]}`,
            game_date: g[dateKey],
          });
        }
      }
    };

    collect("NBA", nba as never, "away_team", "home_team", "game_date");
    collect("NFL", nfl as never, "away_team", "home_team", "gameday");
    collect("CFB", cfbRes as never, "away_team", "home_team", "kickoff");
    collect("NCAAB", ncaab as never, "away_team", "home_team", "game_date_et");
    collect("MLB", mlb as never, "away_team_name", "home_team_name", "official_date");

    if (results.length === 0) {
      return { results: [], message: `No games found matching "${input.query}" on ${date}` };
    }
    return { results, count: results.length, search_query: input.query, date };
  },
};
