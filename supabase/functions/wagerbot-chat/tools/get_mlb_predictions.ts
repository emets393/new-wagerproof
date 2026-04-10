// get_mlb_predictions — Fetch MLB model predictions and Statcast data.
// Returns starting pitchers, model predictions (ML, O/U, F5), game signals,
// park factors, and weather.

import type { ToolDefinition, ToolContext } from "./registry.ts";
import { getTodayInET } from "../../shared/dateUtils.ts";

export const tool: ToolDefinition = {
  name: "get_mlb_predictions",
  description:
    "Get MLB model predictions for today or a specific date. Returns starting " +
    "pitchers, moneyline/spread/total predictions, Statcast-based signals, park " +
    "factors, and weather. Use this when the user asks about MLB/baseball games.",
  parameters: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description: "Date in YYYY-MM-DD format. Defaults to today (Eastern Time).",
      },
      team: {
        type: "string",
        description: "Optional team name to filter (e.g. 'Yankees', 'Dodgers').",
      },
    },
  },
  async execute(input: { date?: string; team?: string }, ctx: ToolContext) {
    const targetDate = input.date || getTodayInET();

    // Fetch games with relaxed fallback (same pattern as agentGameHelpers)
    let games: any[] = [];
    const { data: strictGames } = await ctx.cfbSupabase
      .from("mlb_games_today")
      .select("*")
      .eq("official_date", targetDate)
      .or("is_active.eq.true,is_active.is.null")
      .or("is_completed.eq.false,is_completed.is.null")
      .order("game_time_et", { ascending: true });

    games = strictGames || [];
    if (games.length === 0) {
      const { data: relaxedGames } = await ctx.cfbSupabase
        .from("mlb_games_today")
        .select("*")
        .eq("official_date", targetDate)
        .order("game_time_et", { ascending: true });
      games = (relaxedGames || []).filter(
        (g: any) => g.is_postponed !== true && g.is_completed !== true,
      );
    }

    if (games.length === 0) {
      return { games: [], message: `No MLB games found for ${targetDate}` };
    }

    // Optional team filter
    if (input.team) {
      const t = input.team.toLowerCase();
      games = games.filter(
        (g: any) =>
          g.away_team_name?.toLowerCase().includes(t) ||
          g.home_team_name?.toLowerCase().includes(t),
      );
      if (games.length === 0) {
        return { games: [], message: `No MLB games found matching "${input.team}" on ${targetDate}` };
      }
    }

    // Fetch game signals — filter by game_pk to avoid pulling entire table
    const gamePks = games.map((g: any) => g.game_pk).filter(Boolean);
    let signalsByPk = new Map<string, any>();
    if (gamePks.length > 0) {
      try {
        const { data: signalRows } = await ctx.cfbSupabase
          .from("mlb_game_signals")
          .select("game_pk, home_signals, away_signals, game_signals")
          .in("game_pk", gamePks);
        for (const row of signalRows || []) {
          signalsByPk.set(String(Math.trunc(Number(row.game_pk))), row);
        }
      } catch { /* non-critical */ }
    }

    const formatted = games.map((game: any) => {
      const pk = String(Math.trunc(Number(game.game_pk)));
      const signals = signalsByPk.get(pk);

      return {
        game_id: pk,
        matchup: `${game.away_team_name} @ ${game.home_team_name}`,
        away_team: game.away_team_name,
        home_team: game.home_team_name,
        game_date: game.official_date,
        game_time: game.game_time_et,
        status: game.status,
        starting_pitchers: {
          away: { name: game.away_sp_name || "TBD", confirmed: game.away_sp_confirmed ?? false },
          home: { name: game.home_sp_name || "TBD", confirmed: game.home_sp_confirmed ?? false },
        },
        vegas_lines: {
          spread: `${game.away_team_name} ${fmtSpread(game.away_spread)} / ${game.home_team_name} ${fmtSpread(game.home_spread)}`,
          moneyline: `${game.away_team_name} ${fmtML(game.away_ml)} / ${game.home_team_name} ${fmtML(game.home_ml)}`,
          total: game.total_line,
        },
        model_predictions: {
          ml_home_win_prob: game.ml_home_win_prob,
          ml_away_win_prob: game.ml_away_win_prob,
          home_ml_edge_pct: game.home_ml_edge_pct,
          away_ml_edge_pct: game.away_ml_edge_pct,
          ou_direction: game.ou_direction,
          ou_edge: game.ou_edge,
          ou_fair_total: game.ou_fair_total,
          is_final_prediction: game.is_final_prediction,
        },
        weather: {
          temperature_f: game.temperature_f,
          wind_speed_mph: game.wind_speed_mph,
          wind_direction: game.wind_direction,
          sky: game.sky,
        },
        signal_strength: {
          home_ml_strong_signal: game.home_ml_strong_signal ?? false,
          away_ml_strong_signal: game.away_ml_strong_signal ?? false,
          ou_strong_signal: game.ou_strong_signal ?? false,
          ou_moderate_signal: game.ou_moderate_signal ?? false,
          weather_confirmed: game.weather_confirmed ?? false,
        },
        signals: signals
          ? {
              game: parseSignals(signals.game_signals),
              home: parseSignals(signals.home_signals),
              away: parseSignals(signals.away_signals),
            }
          : null,
      };
    });

    return { games: formatted, date: targetDate, count: formatted.length };
  },
};

function fmtSpread(v: unknown): string {
  if (v == null) return "N/A";
  const n = Number(v);
  return n > 0 ? `+${n}` : String(n);
}

function fmtML(v: unknown): string {
  if (v == null) return "N/A";
  const n = Number(v);
  return n > 0 ? `+${n}` : String(n);
}

function parseSignals(raw: unknown): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((s: unknown) => {
      if (typeof s === "string") {
        try { const p = JSON.parse(s); return p.message || s; } catch { return s; }
      }
      if (s && typeof s === "object") return (s as any).message || "";
      return "";
    })
    .filter(Boolean);
}
