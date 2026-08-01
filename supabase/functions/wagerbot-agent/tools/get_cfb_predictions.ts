// DEPRECATED 2026-08-01 — WagerBot chat is being retired; its UI entry points are
// being hidden. Intentionally NOT migrated to gpt-5.6-luna: this function stays on
// its current model(s) until the surface is removed. Do not build on it.

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
    // CFB reads the new model's weekly table cfb_dryrun_games (lines from The Odds
    // API). The pipeline delete-then-inserts per (season, week), so the latest
    // (season, week) = current week. Resolve that anchor, then filter to it.
    const { data: anchor } = await ctx.cfbSupabase
      .from("cfb_dryrun_games")
      .select("season, week")
      .order("season", { ascending: false })
      .order("week", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!anchor) return { games: [], message: "No CFB games found" };
    const { data: games, error } = await ctx.cfbSupabase
      .from("cfb_dryrun_games")
      .select("*")
      .eq("season", anchor.season)
      .eq("week", anchor.week);

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

    // Remap onto the cfb_dryrun_games columns (fg_* = full-game markets from The
    // Odds API). Fields with no equivalent in the new table are set to null.
    const formatted = filtered.map((game: any) => ({
      game_id: game.game_id || `${game.away_team}_${game.home_team}`,
      matchup: `${game.away_team} @ ${game.home_team}`,
      away_team: game.away_team,
      home_team: game.home_team,
      conference: game.home_conf, // legacy single "conference" has no equal; home_conf is closest
      home_conference: game.home_conf,
      away_conference: game.away_conf,
      game_date: game.kickoff,
      game_time: null, // no separate time column; kickoff is a full timestamp
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
        ou_confidence: null, // no OU confidence column in cfb_dryrun_games
        model_fair_spread: game.fg_pred_spread,
        model_fair_total: game.fg_pred_total,
      },
      weather: {
        temperature: game.wx_temp_f,
        wind_speed: game.wx_wind_mph,
        precipitation: null, // no precipitation column; wx_summary/wx_icon carry conditions
      },
    }));

    // Build compact game cards directly from cfb_dryrun_games (the old
    // normalizeCFB read legacy column names absent from the new table).
    const gameCards = filtered
      .map((g: any) => {
        const homeSpread = g.fg_spread_close ?? null;
        return {
          sport: "cfb",
          game_id: String(g.game_id || ""),
          away_team: g.away_team || "",
          home_team: g.home_team || "",
          away_abbr: g.away_team || "",
          home_abbr: g.home_team || "",
          game_date: g.kickoff || "",
          game_time: "",
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
