// get_mlb_predictions — Fetch MLB model predictions and Statcast data.
// Returns starting pitchers, model predictions (ML, O/U, F5), game signals,
// park factors, and weather.

import type { ToolDefinition, ToolContext } from "./registry.ts";
import { getTodayInET } from "../../shared/dateUtils.ts";
import { normalizeMLB } from "./gameCardNormalizer.ts";

export const tool: ToolDefinition = {
  name: "get_mlb_predictions",
  description:
    "Get MLB model predictions for today or a specific date. Returns starting " +
    "pitchers, moneyline/spread/total predictions, Statcast-based signals, park " +
    "factors, weather, AND a `breakdown_context` per game with the model's " +
    "season-to-date win% and ROI sliced by (a) the game's day-of-week and (b) " +
    "the teams involved, for each bet type. When recommending picks, cross-check " +
    "the model's pick against breakdown_context: if both the day-of-week and the " +
    "relevant team show high win%/ROI on that bet type, that's a strong signal. " +
    "Use this when the user asks about MLB/baseball games.",
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

    // Fetch all breakdown stats once. Tiny table (~76 rows) so a full pull is cheaper
    // than per-game lookups. Used to attach DOW + team accuracy to each game so the
    // LLM can reason about model alignment ("Tuesday is +30% ROI on O/U, Astros are
    // +33% O/U, model picked OVER → strong signal").
    type BD = { bet_type: string; breakdown_type: string; breakdown_value: string;
                games: number; wins: number; losses: number;
                win_pct: number; roi_pct: number };
    const bdMap = new Map<string, BD>();   // key = `${bet_type}|${breakdown_type}|${value}`
    try {
      const { data: bdRows } = await ctx.cfbSupabase
        .from("mlb_model_breakdown_accuracy")
        .select("bet_type, breakdown_type, breakdown_value, games, wins, losses, win_pct, roi_pct");
      for (const r of (bdRows || []) as BD[]) {
        bdMap.set(`${r.bet_type}|${r.breakdown_type}|${r.breakdown_value}`, r);
      }
    } catch { /* non-critical */ }

    // team_id → team_abbr (matching mlb_game_log convention: ARI→AZ, OAK→ATH).
    const teamAbbrById = new Map<number, string>();
    try {
      const { data: teamRows } = await ctx.cfbSupabase
        .from("mlb_team_mapping")
        .select("mlb_api_id, team");
      for (const t of (teamRows || []) as { mlb_api_id: number; team: string }[]) {
        const abbr = t.team === "ARI" ? "AZ" : t.team === "OAK" ? "ATH" : t.team;
        teamAbbrById.set(t.mlb_api_id, abbr);
      }
    } catch { /* non-critical */ }

    const dowFromDate = (d: string | null | undefined): string | null => {
      if (!d) return null;
      const date = new Date(`${d}T12:00:00Z`);
      const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      return days[date.getUTCDay()];
    };
    const lookupBD = (bet: string, type: string, val: string | null) => {
      if (!val) return null;
      const r = bdMap.get(`${bet}|${type}|${val}`);
      return r ? { games: r.games, record: `${r.wins}-${r.losses}`, win_pct: r.win_pct, roi_pct: r.roi_pct } : null;
    };

    const formatted = games.map((game: any) => {
      const pk = String(Math.trunc(Number(game.game_pk)));
      const signals = signalsByPk.get(pk);

      // Build breakdown context: which DOW/team rows from mlb_model_breakdown_accuracy
      // are relevant to this specific game. The LLM can use these to reason about
      // model alignment per bet type.
      const dow = dowFromDate(game.official_date);
      const homeAbbr = teamAbbrById.get(game.home_team_id) ?? null;
      const awayAbbr = teamAbbrById.get(game.away_team_id) ?? null;
      // ML pick = side with positive edge (matches refresh_mlb_model_breakdown_accuracy logic).
      const mlPickAbbr =
        (game.home_ml_edge_pct ?? -1) >= (game.away_ml_edge_pct ?? -1) && (game.home_ml_edge_pct ?? 0) > 0
          ? homeAbbr
          : (game.away_ml_edge_pct ?? 0) > 0 ? awayAbbr : null;
      const f5MlPickAbbr =
        (game.f5_home_ml_edge_pct ?? -1) >= (game.f5_away_ml_edge_pct ?? -1) && (game.f5_home_ml_edge_pct ?? 0) > 0
          ? homeAbbr
          : (game.f5_away_ml_edge_pct ?? 0) > 0 ? awayAbbr : null;

      const breakdownContext = {
        day_of_week: dow,
        // DOW accuracy by bet type
        dow_accuracy: {
          full_ml: lookupBD("full_ml", "dow", dow),
          full_ou: lookupBD("full_ou", "dow", dow),
          f5_ml:   lookupBD("f5_ml",   "dow", dow),
          f5_ou:   lookupBD("f5_ou",   "dow", dow),
        },
        // Team accuracy by bet type. For ML it's the model-picked team; for O/U
        // both teams are credited (so we surface both).
        team_accuracy: {
          full_ml_pick_team: mlPickAbbr,
          full_ml: lookupBD("full_ml", "team", mlPickAbbr),
          full_ou_home: lookupBD("full_ou", "team", homeAbbr),
          full_ou_away: lookupBD("full_ou", "team", awayAbbr),
          f5_ml_pick_team: f5MlPickAbbr,
          f5_ml: lookupBD("f5_ml", "team", f5MlPickAbbr),
          f5_ou_home: lookupBD("f5_ou", "team", homeAbbr),
          f5_ou_away: lookupBD("f5_ou", "team", awayAbbr),
        },
      };

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
        breakdown_context: breakdownContext,
      };
    });

    // Top 5 games by ML edge for inline display
    const gameCards = games
      .map((g: any) => normalizeMLB(g))
      .sort((a, b) => Math.abs(b.ou_edge || 0) + Math.abs(b.ml_prob ? b.ml_prob - 50 : 0)
                     - Math.abs(a.ou_edge || 0) - Math.abs(a.ml_prob ? a.ml_prob - 50 : 0))
      .slice(0, 5);

    return { games: formatted, date: targetDate, count: formatted.length, game_cards: gameCards };
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
