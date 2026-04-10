// get_ncaab_predictions — Fetch NCAAB model predictions for a given date.
// Returns predictions with team ratings, rankings, and context flags.

import type { ToolDefinition, ToolContext } from "./registry.ts";
import { getTodayInET } from "../../shared/dateUtils.ts";

export const tool: ToolDefinition = {
  name: "get_ncaab_predictions",
  description:
    "Get college basketball (NCAAB) model predictions for today or a specific date. " +
    "Returns predicted scores, spread/moneyline/total picks with confidence, team " +
    "ratings, rankings, and context flags. Use this when the user asks about college " +
    "basketball games or predictions.",
  parameters: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description: "Date in YYYY-MM-DD format. Defaults to today (Eastern Time).",
      },
      team: {
        type: "string",
        description: "Optional team name to filter (e.g. 'Duke', 'UConn').",
      },
    },
  },
  async execute(input: { date?: string; team?: string }, ctx: ToolContext) {
    const targetDate = input.date || getTodayInET();

    const { data: games, error } = await ctx.cfbSupabase
      .from("v_cbb_input_values")
      .select("*")
      .eq("game_date_et", targetDate);

    if (error) throw new Error(`NCAAB input values query failed: ${error.message}`);
    if (!games || games.length === 0) {
      return { games: [], message: `No NCAAB games found for ${targetDate}` };
    }

    let filtered = games;
    if (input.team) {
      const t = input.team.toLowerCase();
      filtered = games.filter(
        (g: any) =>
          g.away_team?.toLowerCase().includes(t) ||
          g.home_team?.toLowerCase().includes(t),
      );
      if (filtered.length === 0) {
        return { games: [], message: `No NCAAB games found matching "${input.team}" on ${targetDate}` };
      }
    }

    // Fetch predictions from ncaab_predictions (latest run_id, same pattern as NBA)
    const gameIds = filtered.map((g: any) => g.game_id).filter(Boolean);
    const predictionsMap = await fetchPredictions(ctx.cfbSupabase, gameIds);

    const formatted = filtered.map((game: any) => {
      const gid = game.game_id;
      const preds = predictionsMap.get(gid) || null;

      return {
        game_id: gid,
        matchup: `${game.away_team} @ ${game.home_team}`,
        away_team: game.away_team,
        home_team: game.home_team,
        game_date: game.game_date_et,
        game_time: game.tipoff_time_et,
        team_stats: {
          away: {
            adj_offense: game.away_adj_offense,
            adj_defense: game.away_adj_defense,
            adj_pace: game.away_adj_pace,
            adj_offense_trend_l3: game.away_adj_offense_trend_l3 ?? null,
            adj_defense_trend_l3: game.away_adj_defense_trend_l3 ?? null,
          },
          home: {
            adj_offense: game.home_adj_offense,
            adj_defense: game.home_adj_defense,
            adj_pace: game.home_adj_pace,
            adj_offense_trend_l3: game.home_adj_offense_trend_l3 ?? null,
            adj_defense_trend_l3: game.home_adj_defense_trend_l3 ?? null,
          },
        },
        rankings: {
          away_ranking: game.away_ranking,
          home_ranking: game.home_ranking,
          away_seed: game.away_seed,
          home_seed: game.home_seed,
        },
        context: {
          conference_game: game.conference_game,
          neutral_site: game.neutral_site,
        },
        vegas_lines: {
          spread: `${game.home_team} ${fmtSpread(game.home_spread)}`,
          moneyline: `${game.away_team} ${fmtML(game.away_moneyline)} / ${game.home_team} ${fmtML(game.home_moneyline)}`,
          total: game.total_line,
        },
        betting_trends: {
          home_ats_pct: game.home_ats_pct,
          away_ats_pct: game.away_ats_pct,
          home_over_pct: game.home_over_pct,
          away_over_pct: game.away_over_pct,
        },
        model_predictions: preds
          ? {
              home_win_prob: preds.home_win_prob,
              away_win_prob: preds.away_win_prob,
              home_score_pred: preds.home_score_pred,
              away_score_pred: preds.away_score_pred,
              model_fair_home_spread: preds.model_fair_home_spread,
              model_fair_total: preds.model_fair_total,
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

/** Fetch latest-run predictions from ncaab_predictions, keyed by game_id. */
async function fetchPredictions(
  client: any,
  gameIds: (string | number)[],
): Promise<Map<any, any>> {
  const result = new Map<any, any>();
  if (gameIds.length === 0) return result;

  try {
    // Get the latest run_id
    const { data: latestRun } = await client
      .from("ncaab_predictions")
      .select("run_id")
      .order("run_id", { ascending: false })
      .limit(1);

    if (!latestRun || latestRun.length === 0) return result;
    const runId = latestRun[0].run_id;

    const { data: preds } = await client
      .from("ncaab_predictions")
      .select("game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread")
      .eq("run_id", runId)
      .in("game_id", gameIds);

    for (const row of preds || []) {
      result.set(row.game_id, row);
    }
  } catch {
    /* non-critical — tool still returns input data without predictions */
  }

  return result;
}
