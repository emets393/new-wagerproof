// get_nfl_predictions — Fetch NFL model predictions for the current week.
// Returns predictions with weather, public betting splits, and line movement.

import type { ToolDefinition, ToolContext } from "./registry.ts";
import { normalizeNFL } from "./gameCardNormalizer.ts";

export const tool: ToolDefinition = {
  name: "get_nfl_predictions",
  description:
    "Get NFL model predictions for the current week. Returns spread, moneyline, " +
    "and over/under picks with confidence, weather data, public betting splits, " +
    "and line movement. Use this when the user asks about NFL games or predictions.",
  parameters: {
    type: "object",
    properties: {
      team: {
        type: "string",
        description: "Optional team name to filter (e.g. 'Chiefs', 'Bills').",
      },
    },
  },
  async execute(input: { team?: string }, ctx: ToolContext) {
    // Get latest run_id
    const { data: latestRun } = await ctx.cfbSupabase
      .from("nfl_predictions_epa")
      .select("run_id")
      .order("run_id", { ascending: false })
      .limit(1)
      .single();

    if (!latestRun) return { games: [], message: "No NFL predictions available" };

    const { data: games, error } = await ctx.cfbSupabase
      .from("nfl_predictions_epa")
      .select("*")
      .eq("run_id", latestRun.run_id);

    if (error) throw new Error(`NFL predictions query failed: ${error.message}`);
    if (!games || games.length === 0) return { games: [], message: "No NFL games found" };

    let filtered = games;
    if (input.team) {
      const t = input.team.toLowerCase();
      filtered = games.filter(
        (g: any) =>
          g.away_team?.toLowerCase().includes(t) ||
          g.home_team?.toLowerCase().includes(t),
      );
      if (filtered.length === 0) {
        return { games: [], message: `No NFL games found matching "${input.team}"` };
      }
    }

    const formatted = filtered.map((game: any) => ({
      game_id: game.training_key || `${game.away_team}_${game.home_team}`,
      matchup: `${game.away_team} @ ${game.home_team}`,
      away_team: game.away_team,
      home_team: game.home_team,
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
        predicted_home_score: game.predicted_home_score,
        predicted_away_score: game.predicted_away_score,
      },
      weather: {
        temperature: game.temperature,
        wind_speed: game.wind_speed,
        precipitation: game.precipitation,
      },
      public_betting: {
        spread_split: game.spread_splits_label,
        ml_split: game.ml_splits_label,
        total_split: game.total_splits_label,
      },
    }));

    const gameCards = filtered
      .map((g: any) => normalizeNFL(g))
      .sort((a, b) => Math.abs(b.spread_edge || 0) - Math.abs(a.spread_edge || 0))
      .slice(0, 5);

    return { games: formatted, count: formatted.length, game_cards: gameCards };
  },
};

function fmtSpread(v: unknown): string {
  if (v == null) return "N/A";
  const n = Number(v);
  return n > 0 ? `+${n}` : String(n);
}
