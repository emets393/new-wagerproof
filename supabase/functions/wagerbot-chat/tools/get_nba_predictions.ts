// get_nba_predictions — Fetch NBA model predictions for a given date.
// Returns predictions with team ratings, L3/L5 trends, shooting splits,
// advanced stats, betting trends, injuries, situational data, and accuracy.
// NBA has the richest data of all sports — this tool reflects that.

import type { ToolDefinition, ToolContext } from "./registry.ts";
import { getTodayInET } from "../../shared/dateUtils.ts";

export const tool: ToolDefinition = {
  name: "get_nba_predictions",
  description:
    "Get NBA model predictions for today or a specific date. Returns predicted scores, " +
    "win probabilities, model fair spread/total, team efficiency ratings (off/def/pace) " +
    "with L3/L5 trends, shooting splits, rebounding, luck, consistency, " +
    "ATS/O-U percentages, streaks, last-game results, injuries, and situational data. " +
    "Use this when the user asks about NBA games, predictions, or betting analysis.",
  parameters: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description: "Date in YYYY-MM-DD format. Defaults to today (Eastern Time).",
      },
      team: {
        type: "string",
        description: "Optional team name to filter results (e.g. 'Lakers', 'Celtics').",
      },
    },
  },
  async execute(input: { date?: string; team?: string }, ctx: ToolContext) {
    const targetDate = input.date || getTodayInET();

    // Fetch input values from the NBA view
    const { data: games, error } = await ctx.cfbSupabase
      .from("nba_input_values_view")
      .select("*")
      .eq("game_date", targetDate);

    if (error) throw new Error(`NBA predictions query failed: ${error.message}`);
    if (!games || games.length === 0) {
      return { games: [], message: `No NBA games found for ${targetDate}` };
    }

    // Optional team filter
    let filtered = games;
    if (input.team) {
      const t = input.team.toLowerCase();
      filtered = games.filter(
        (g: any) =>
          g.away_team?.toLowerCase().includes(t) ||
          g.home_team?.toLowerCase().includes(t),
      );
      if (filtered.length === 0) {
        return { games: [], message: `No NBA games found matching "${input.team}" on ${targetDate}` };
      }
    }

    // Fetch predictions and enrichment data in parallel
    const gameIds = filtered.map((g: any) => String(g.game_id)).filter(Boolean);
    const numericGameIds = filtered.map((g: any) => g.game_id).filter(Boolean);
    const teams = [...new Set(filtered.flatMap((g: any) => [g.away_team, g.home_team]).filter(Boolean))];

    const [predictionMap, injuryData, situationalData, accuracyData] = await Promise.all([
      fetchPredictions(ctx.cfbSupabase, numericGameIds),
      fetchInjuries(ctx.cfbSupabase, teams, targetDate),
      fetchSituational(ctx.cfbSupabase, "nba_game_situational_trends_today", gameIds),
      fetchAccuracy(ctx.cfbSupabase, "nba_todays_games_predictions_with_accuracy_cache", gameIds, targetDate),
    ]);

    const formatted = filtered.map((game: any) => {
      const gid = String(game.game_id || "");
      const awayInjuries = injuryData.get(game.away_team?.toLowerCase()) || [];
      const homeInjuries = injuryData.get(game.home_team?.toLowerCase()) || [];
      const situational = situationalData.get(gid) || null;
      const accuracy = accuracyData.get(gid) || null;
      const prediction = predictionMap.get(game.game_id) || null;

      // Compute away ML from home ML (no away_moneyline column in the view)
      const homeML = game.home_moneyline as number | null;
      let awayML: number | null = null;
      if (homeML != null) {
        awayML = homeML > 0 ? -(homeML + 100) : 100 - homeML;
      }

      const homeSpread = game.home_spread as number | null;
      const awaySpread = homeSpread != null ? -homeSpread : null;

      return {
        game_id: game.game_id,
        matchup: `${game.away_team} @ ${game.home_team}`,
        away_team: game.away_team,
        home_team: game.home_team,
        away_abbr: game.away_abbr,
        home_abbr: game.home_abbr,
        game_date: game.game_date,
        tipoff_time_et: game.tipoff_time_et,
        season: game.season,
        game_type: game.game_type,

        vegas_lines: {
          spread: `${game.home_team} ${fmtSpread(homeSpread)}`,
          home_spread: homeSpread,
          away_spread: awaySpread,
          moneyline: `${game.away_team} ${fmtML(awayML)} / ${game.home_team} ${fmtML(homeML)}`,
          home_ml: homeML,
          away_ml: awayML,
          total: game.total_line,
        },

        model_predictions: prediction
          ? {
              home_win_prob: prediction.home_win_prob,
              away_win_prob: prediction.away_win_prob,
              home_score_pred: prediction.home_score_pred,
              away_score_pred: prediction.away_score_pred,
              model_fair_home_spread: prediction.model_fair_home_spread,
              model_fair_total: prediction.model_fair_total,
              // Derived: does the model see value vs Vegas?
              spread_edge: homeSpread != null && prediction.model_fair_home_spread != null
                ? round2(prediction.model_fair_home_spread - homeSpread)
                : null,
              total_edge: game.total_line != null && prediction.model_fair_total != null
                ? round2(prediction.model_fair_total - game.total_line)
                : null,
            }
          : null,

        // Full team efficiency ratings — season-long
        team_stats: {
          home: {
            overall_rating: game.home_ovr_rtg,
            adj_off_rtg: game.home_adj_off_rtg,
            adj_def_rtg: game.home_adj_def_rtg,
            adj_pace: game.home_adj_pace,
            consistency: game.home_consistency,
            luck: game.home_luck,
            // Shooting splits
            fg2_pct: game.home_adj_fg2_pct,
            fg3_pct: game.home_adj_fg3_pct,
            ft_pct: game.home_ft_pct,
            // Rebounding
            oreb_pct: game.home_adj_oreb_pct,
            dreb_pct: game.home_adj_dreb_pct,
          },
          away: {
            overall_rating: game.away_ovr_rtg,
            adj_off_rtg: game.away_adj_off_rtg,
            adj_def_rtg: game.away_adj_def_rtg,
            adj_pace: game.away_adj_pace,
            consistency: game.away_consistency,
            luck: game.away_luck,
            fg2_pct: game.away_adj_fg2_pct,
            fg3_pct: game.away_adj_fg3_pct,
            ft_pct: game.away_ft_pct,
            oreb_pct: game.away_adj_oreb_pct,
            dreb_pct: game.away_adj_dreb_pct,
          },
        },

        // L3/L5 recent form — critical for detecting hot/cold stretches
        recent_form: {
          home: {
            adj_off_rtg_l3: game.home_adj_off_rtg_l3,
            adj_def_rtg_l3: game.home_adj_def_rtg_l3,
            adj_pace_l3: game.home_adj_pace_l3,
            adj_off_rtg_l5: game.home_adj_off_rtg_l5,
            adj_def_rtg_l5: game.home_adj_def_rtg_l5,
            adj_pace_l5: game.home_adj_pace_l5,
            off_trend_l3: game.home_off_trend_l3,
            def_trend_l3: game.home_def_trend_l3,
            pace_trend_l3: game.home_pace_trend_l3,
          },
          away: {
            adj_off_rtg_l3: game.away_adj_off_rtg_l3,
            adj_def_rtg_l3: game.away_adj_def_rtg_l3,
            adj_pace_l3: game.away_adj_pace_l3,
            adj_off_rtg_l5: game.away_adj_off_rtg_l5,
            adj_def_rtg_l5: game.away_adj_def_rtg_l5,
            adj_pace_l5: game.away_adj_pace_l5,
            off_trend_l3: game.away_off_trend_l3,
            def_trend_l3: game.away_def_trend_l3,
            pace_trend_l3: game.away_pace_trend_l3,
          },
        },

        // ATS, O/U, streaks, and last-game results
        betting_trends: {
          home: {
            ats_pct: game.home_ats_pct,
            over_pct: game.home_over_pct,
            win_streak: game.home_win_streak,
            ats_streak: game.home_ats_streak,
            last_ml: game.home_last_ml,
            last_ats: game.home_last_ats,
            last_ou: game.home_last_ou,
            last_margin: game.home_last_margin,
          },
          away: {
            ats_pct: game.away_ats_pct,
            over_pct: game.away_over_pct,
            win_streak: game.away_win_streak,
            ats_streak: game.away_ats_streak,
            last_ml: game.away_last_ml,
            last_ats: game.away_last_ats,
            last_ou: game.away_last_ou,
            last_margin: game.away_last_margin,
          },
        },

        injuries: {
          away: awayInjuries.length > 0 ? awayInjuries : null,
          home: homeInjuries.length > 0 ? homeInjuries : null,
        },
        situational: situational,
        accuracy: accuracy,
      };
    });

    return { games: formatted, date: targetDate, count: formatted.length };
  },
};

// ---- Helpers ----------------------------------------------------------------

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Fetch predictions from nba_predictions using the latest run_id.
 *  Mirrors the approach in basketballDataService.ts. */
async function fetchPredictions(
  client: any,
  gameIds: number[],
): Promise<Map<number, any>> {
  const result = new Map<number, any>();
  if (gameIds.length === 0) return result;
  try {
    // Get the latest run_id
    const { data: latestRun } = await client
      .from("nba_predictions")
      .select("run_id, as_of_ts_utc")
      .order("as_of_ts_utc", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestRun) return result;

    const { data: predictions } = await client
      .from("nba_predictions")
      .select("game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread, run_id")
      .eq("run_id", latestRun.run_id)
      .in("game_id", gameIds);

    for (const pred of predictions || []) {
      result.set(pred.game_id, pred);
    }
  } catch { /* non-critical — tool still returns input data without predictions */ }
  return result;
}

async function fetchInjuries(
  client: any,
  teams: string[],
  date: string,
): Promise<Map<string, any[]>> {
  const result = new Map<string, any[]>();
  if (teams.length === 0) return result;
  try {
    const { data } = await client
      .from("nba_injury_report")
      .select("player_name, avg_pie_season, status, team_name, game_date_et, bucket")
      .in("team_name", teams)
      .eq("game_date_et", date)
      .eq("bucket", "current");

    for (const row of data || []) {
      const key = row.team_name?.toLowerCase();
      if (!result.has(key)) result.set(key, []);
      result.get(key)!.push({
        player: row.player_name,
        status: row.status,
        impact: row.avg_pie_season,
      });
    }
  } catch { /* non-critical */ }
  return result;
}

async function fetchSituational(
  client: any,
  table: string,
  gameIds: string[],
): Promise<Map<string, any>> {
  const result = new Map<string, any>();
  if (gameIds.length === 0) return result;
  try {
    const { data } = await client.from(table).select("*").in("game_id", gameIds);
    for (const row of data || []) {
      const gid = String(row.game_id || "");
      if (!result.has(gid)) result.set(gid, { away: null, home: null });
      const entry = result.get(gid);
      if (row.team_side === "away") entry.away = row;
      else if (row.team_side === "home") entry.home = row;
    }
  } catch { /* non-critical */ }
  return result;
}

async function fetchAccuracy(
  client: any,
  table: string,
  gameIds: string[],
  date: string,
): Promise<Map<string, any>> {
  const result = new Map<string, any>();
  if (gameIds.length === 0) return result;
  try {
    const { data } = await client
      .from(table)
      .select("*")
      .in("game_id", gameIds)
      .eq("game_date", date);
    for (const row of data || []) {
      result.set(String(row.game_id || ""), row);
    }
  } catch { /* non-critical */ }
  return result;
}
