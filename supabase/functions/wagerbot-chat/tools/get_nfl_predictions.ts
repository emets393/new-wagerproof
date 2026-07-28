// get_nfl_predictions — Fetch NFL model predictions for the current week.
// Reads the new model's weekly table nfl_dryrun_games (lines from The Odds API).

import type { ToolDefinition, ToolContext } from "./registry.ts";

export const tool: ToolDefinition = {
  name: "get_nfl_predictions",
  description:
    "Get NFL model predictions for the current week. Returns spread, moneyline, " +
    "and over/under picks with confidence and weather data. Use this when the user " +
    "asks about NFL games or predictions.",
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
    // NFL reads the new model's weekly table nfl_dryrun_games (lines from The Odds
    // API; predictions + lines in one row — no join to nfl_betting_lines and no
    // nfl_predictions_epa run_id logic). The pipeline delete-then-inserts per
    // (season, week), so the latest (season, week) = current week. Resolve that
    // anchor, then filter to it.
    const { data: anchor } = await ctx.cfbSupabase
      .from("nfl_dryrun_games")
      .select("season, week")
      .order("season", { ascending: false })
      .order("week", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!anchor) return { games: [], message: "No NFL predictions available" };

    const { data: games, error } = await ctx.cfbSupabase
      .from("nfl_dryrun_games")
      .select("*")
      .eq("season", anchor.season)
      .eq("week", anchor.week);

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

    // Remap onto the nfl_dryrun_games columns (fg_* = full-game markets from The
    // Odds API). Fields with no equivalent in the new table are set to null.
    const formatted = filtered.map((game: any) => ({
      game_id: game.game_id || `${game.away_team}_${game.home_team}`,
      matchup: `${game.away_team} @ ${game.home_team}`,
      away_team: game.away_team,
      home_team: game.home_team,
      game_date: game.gameday,
      game_time: game.kickoff,
      vegas_lines: {
        spread: `${game.home_team} ${fmtSpread(game.fg_spread_close)}`,
        moneyline: `${game.away_team} ${game.fg_ml_away_close || "N/A"} / ${game.home_team} ${game.fg_ml_home_close || "N/A"}`,
        total: game.fg_total_close,
      },
      model_predictions: {
        ml_pick: null, // no ml_pick column; use fg_home_win_prob for ML lean
        ml_confidence: game.fg_home_win_prob,
        spread_pick: game.fg_spread_pick,
        spread_confidence: game.fg_home_cover_prob,
        ou_pick: game.fg_total_pick,
        ou_confidence: null, // no OU confidence column in nfl_dryrun_games
        model_fair_spread: game.fg_pred_spread,
        model_fair_total: game.fg_pred_total,
        predicted_home_score: game.fg_pred_home_pts,
        predicted_away_score: game.fg_pred_away_pts,
      },
      weather: {
        temperature: game.wx_temp_f,
        wind_speed: game.wx_wind_mph,
        precipitation: null, // no precipitation column; wx_icon carries conditions
      },
      public_betting: {
        spread_split: null, // no public-betting splits in nfl_dryrun_games
        ml_split: null,
        total_split: null,
      },
    }));

    // Build compact game cards directly from nfl_dryrun_games (the old
    // normalizeNFL read legacy column names absent from the new table).
    const gameCards = filtered
      .map((g: any) => {
        const homeSpread = g.fg_spread_close ?? null;
        return {
          sport: "nfl",
          game_id: String(g.game_id || ""),
          away_team: g.away_team || "",
          home_team: g.home_team || "",
          away_abbr: g.away_team || "",
          home_abbr: g.home_team || "",
          game_date: g.gameday || "",
          game_time: g.kickoff || "",
          home_spread: homeSpread,
          away_spread: homeSpread != null ? -homeSpread : null,
          home_ml: g.fg_ml_home_close ?? null,
          away_ml: g.fg_ml_away_close ?? null,
          over_under: g.fg_total_close ?? null,
          spread_pick: g.fg_spread_pick ?? null,
          spread_confidence: g.fg_home_cover_prob ?? null,
          spread_edge: g.fg_spread_edge ?? null,
          ou_pick:
            g.fg_total_pick != null
              ? String(g.fg_total_pick).toLowerCase().includes("over")
                ? "over"
                : "under"
              : null,
          ou_edge: g.fg_total_edge ?? null,
          ml_pick_team: null, // no ml pick column
          ml_prob: g.fg_home_win_prob ?? null,
          raw_game: { ...g },
        };
      })
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
