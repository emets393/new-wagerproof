// get_cfb_predictions — Fetch college football predictions for the current week.

import type { ToolDefinition, ToolContext } from "./registry.ts";

export const tool: ToolDefinition = {
  name: "get_cfb_predictions",
  description:
    "Get college football (CFB) model predictions for the current week. Returns " +
    "spread, moneyline, and over/under picks with confidence. Use this when the " +
    "user asks about college football games or predictions.",
  parameters: {
    type: "object",
    properties: {
      team: {
        type: "string",
        description: "Optional team name to filter (e.g. 'Alabama', 'Ohio State').",
      },
    },
  },
  async execute(input: { team?: string }, ctx: ToolContext) {
    const { data: games, error } = await ctx.cfbSupabase
      .from("cfb_live_weekly_inputs")
      .select("*");

    if (error) throw new Error(`CFB predictions query failed: ${error.message}`);
    if (!games || games.length === 0) return { games: [], message: "No CFB games found" };

    let filtered = games;
    if (input.team) {
      const t = input.team.toLowerCase();
      filtered = games.filter(
        (g: any) =>
          g.away_team?.toLowerCase().includes(t) ||
          g.home_team?.toLowerCase().includes(t),
      );
      if (filtered.length === 0) {
        return { games: [], message: `No CFB games found matching "${input.team}"` };
      }
    }

    const formatted = filtered.map((game: any) => ({
      game_id: game.training_key || `${game.away_team}_${game.home_team}`,
      matchup: `${game.away_team} @ ${game.home_team}`,
      away_team: game.away_team,
      home_team: game.home_team,
      conference: game.conference,
      game_date: game.game_date,
      game_time: game.game_time,
      vegas_lines: {
        spread: `${game.home_team} ${fmtSpread(game.home_spread)}`,
        moneyline: `${game.away_team} ${game.away_ml || "N/A"} / ${game.home_team} ${game.home_ml || "N/A"}`,
        total: game.over_line,
      },
      model_predictions: {
        ml_pick: game.ml_pick,
        ml_confidence: game.ml_confidence,
        spread_pick: game.spread_pick,
        spread_confidence: game.spread_confidence,
        ou_pick: game.ou_pick,
        ou_confidence: game.ou_confidence,
        model_fair_spread: game.model_fair_spread,
        model_fair_total: game.model_fair_total,
      },
      weather: {
        temperature: game.temperature,
        wind_speed: game.wind_speed,
        precipitation: game.precipitation,
      },
    }));

    return { games: formatted, count: formatted.length };
  },
};

function fmtSpread(v: unknown): string {
  if (v == null) return "N/A";
  const n = Number(v);
  return n > 0 ? `+${n}` : String(n);
}
