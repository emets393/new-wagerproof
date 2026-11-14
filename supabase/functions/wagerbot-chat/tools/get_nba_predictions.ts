// get_nba_predictions — Fetch NBA model predictions for a given date.
// Returns the originator model (spread + total from nba_model_preds, with the
// job's disagreement tiers), home win probability, team ratings, L3/L5 trends,
// shooting splits, betting trends, injuries, situational data, and the
// validated signals firing on each game (nba_slate_flags + nba_signal_defs).
// NBA has the richest data of all sports — this tool reflects that.
//
// nba_predictions.model_fair_* is NOT read: it has zero correlation with
// results (model audit 2026-09-22) and the accuracy cache built on it is being
// dropped. nba_predictions.home_win_prob now comes from the originator spread (2026-10-19).

import type { ToolDefinition, ToolContext } from "./registry.ts";
import { getTodayInET } from "../../shared/dateUtils.ts";
import { normalizeNBA } from "./gameCardNormalizer.ts";

export const tool: ToolDefinition = {
  name: "get_nba_predictions",
  description:
    "Get NBA model predictions for today or a specific date. Returns the model's spread and total " +
    "versus the market with a disagreement tier (bet = 8+ points, lean = 6+, pass), home win " +
    "probability, team efficiency ratings (off/def/pace) with L3/L5 trends, shooting splits, " +
    "rebounding, luck, consistency, ATS/O-U percentages, streaks, last-game results, injuries, " +
    "situational data, and the validated betting signals firing on each game with their records. " +
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

    // Fetch model, win prob, flags and enrichment data in parallel
    const gameIds = filtered.map((g: any) => String(g.game_id)).filter(Boolean);
    const numericGameIds = filtered.map((g: any) => g.game_id).filter(Boolean);
    const teams = [...new Set(filtered.flatMap((g: any) => [g.away_team, g.home_team]).filter(Boolean))];

    const [modelMap, winProbMap, injuryData, situationalData, flagsMap] = await Promise.all([
      fetchModel(ctx.cfbSupabase, filtered, targetDate),
      fetchWinProb(ctx.cfbSupabase, numericGameIds),
      fetchInjuries(ctx.cfbSupabase, teams, targetDate),
      fetchSituational(ctx.cfbSupabase, "nba_game_situational_trends_today", gameIds),
      fetchFlags(ctx.cfbSupabase, filtered, targetDate),
    ]);

    const formatted = filtered.map((game: any) => {
      const gid = String(game.game_id || "");
      const awayInjuries = injuryData.get(game.away_team?.toLowerCase()) || [];
      const homeInjuries = injuryData.get(game.home_team?.toLowerCase()) || [];
      const situational = situationalData.get(gid) || null;
      const model = modelMap.get(gid) || null;
      const winProb = winProbMap.get(game.game_id) || null;
      const signals = flagsMap.get(gid) || null;

      // Prefer the explicit away_moneyline column from nba_input_values_view;
      // fall back to the complement formula only if the DB value is missing.
      const homeML = game.home_moneyline as number | null;
      const dbAwayML = game.away_moneyline as number | null;
      const awayML: number | null = dbAwayML
        ?? (homeML != null ? (homeML > 0 ? -(homeML + 100) : 100 - homeML) : null);

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

        model_predictions: formatModel(model, winProb),

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
        // Validated signals firing on this game, each with its trigger, the bet it points at,
        // and the all-time record. Null when nothing fires.
        signals: signals,
      };
    });

    // Build game cards sorted by edge — emit top 5 for inline display.
    // The normalizer wants the old column names; cardPrediction maps the originator rows onto them.
    // Inject injury data into raw_game for widget rendering
    const gameCards = filtered
      .map((g: any) => {
        const gid = String(g.game_id || "");
        const card = normalizeNBA(g, cardPrediction(modelMap.get(gid) || null, winProbMap.get(g.game_id) || null));
        const awayInj = injuryData.get(g.away_team?.toLowerCase()) || [];
        const homeInj = injuryData.get(g.home_team?.toLowerCase()) || [];
        if (awayInj.length > 0) (card.raw_game as any).away_injuries = awayInj;
        if (homeInj.length > 0) (card.raw_game as any).home_injuries = homeInj;
        return card;
      })
      .sort((a, b) => Math.abs(b.spread_edge || 0) - Math.abs(a.spread_edge || 0))
      .slice(0, 5);

    return { games: formatted, date: targetDate, count: formatted.length, game_cards: gameCards };
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

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type ModelRows = { spread?: any; total?: any };

// Join key shared with the web feed: the model/signal jobs write balldontlie-style abbreviations
// (GSW, NYK, ...) so they line up with nba_input_values_view without a map.
function abbrKey(date: unknown, home: unknown, away: unknown): string {
  return `${String(date ?? "").slice(0, 10)}|${home ?? ""}|${away ?? ""}`;
}

/** nba_model_preds for the date: one row per game per market, keyed by the view's game_id.
 *  Rows with a null game_id fall back to the (date, home, away) key. */
async function fetchModel(client: any, games: any[], date: string): Promise<Map<string, ModelRows>> {
  const result = new Map<string, ModelRows>();
  try {
    const { data } = await client
      .from("nba_model_preds")
      .select("game_id, game_date, home_abbr, away_abbr, market, model_version, model_home_margin, model_total, market_home_spread, market_total, disagreement, tier, bet_side, as_of")
      .eq("game_date", date);
    const byAbbr = new Map<string, ModelRows>();
    for (const row of data || []) {
      const key = abbrKey(row.game_date, row.home_abbr, row.away_abbr);
      const gid = row.game_id != null ? String(row.game_id) : "";
      const entry: ModelRows = (gid && result.get(gid)) || byAbbr.get(key) || {};
      if (row.market === "spread" || row.market === "total") (entry as any)[row.market] = row;
      if (gid) result.set(gid, entry);
      byAbbr.set(key, entry);
    }
    for (const g of games) {
      const gid = String(g.game_id || "");
      if (!gid || result.has(gid)) continue;
      const entry = byAbbr.get(abbrKey(g.game_date, g.home_abbr, g.away_abbr));
      if (entry) result.set(gid, entry);
    }
  } catch { /* non-critical — tool still returns input data without the model */ }
  return result;
}

/** home_win_prob from nba_predictions (latest run_id) — Phi(originator margin / 14.2), written by nba_model_nightly.py. */
async function fetchWinProb(client: any, gameIds: number[]): Promise<Map<number, any>> {
  const result = new Map<number, any>();
  if (gameIds.length === 0) return result;
  try {
    const { data: latestRun } = await client
      .from("nba_predictions")
      .select("run_id, as_of_ts_utc")
      .order("as_of_ts_utc", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latestRun) return result;
    const { data } = await client
      .from("nba_predictions")
      .select("game_id, home_win_prob, away_win_prob, run_id")
      .eq("run_id", latestRun.run_id)
      .in("game_id", gameIds);
    for (const row of data || []) result.set(row.game_id, row);
  } catch { /* non-critical */ }
  return result;
}

/** The model block. The model predicts the HOME MARGIN; the fair home spread is the negated margin.
 *  `disagreement` is the job's own number (margin + market spread; model total - market total):
 *  positive = model on the home side / the over. Total hidden while the total model is warming up
 *  (< 10 games played) — it loses in that window. */
function formatModel(model: ModelRows | null, winProb: any): Record<string, unknown> | null {
  const spread = model?.spread ?? null;
  const total = model?.total ?? null;
  const homeWinProb = num(winProb?.home_win_prob);
  if (!spread && !total && homeWinProb === null) return null;
  const margin = num(spread?.model_home_margin);
  const totalLive = total != null && total.tier !== "warmup";
  return {
    source: "nba_model_preds",
    model_version: spread?.model_version ?? total?.model_version ?? null,
    as_of: spread?.as_of ?? total?.as_of ?? null,
    home_win_prob: homeWinProb,
    away_win_prob: num(winProb?.away_win_prob),
    spread: spread
      ? {
          model_home_margin: margin,
          model_fair_home_spread: margin === null ? null : -margin,
          market_home_spread: num(spread.market_home_spread),
          disagreement: num(spread.disagreement),
          pick: spread.bet_side ?? null,
          tier: spread.tier ?? null,
        }
      : null,
    total: total
      ? {
          model_total: totalLive ? num(total.model_total) : null,
          market_total: num(total.market_total),
          disagreement: totalLive ? num(total.disagreement) : null,
          pick: totalLive ? (total.bet_side ?? null) : null,
          tier: total.tier ?? null,
        }
      : null,
    tiers: "bet = 8+ points of disagreement (54-56% at the closing line over six seasons); lean = 6+ or a bet downgraded because a signal opposes it; pass / warmup / no_line = no model bet.",
  };
}

/** Map the originator rows onto the column names normalizeNBA expects for the inline card. */
function cardPrediction(model: ModelRows | null, winProb: any): any | null {
  if (!model && !winProb) return null;
  const margin = num(model?.spread?.model_home_margin);
  const total = model?.total;
  return {
    home_win_prob: winProb?.home_win_prob ?? null,
    away_win_prob: winProb?.away_win_prob ?? null,
    model_fair_home_spread: margin === null ? null : -margin,
    model_fair_total: total && total.tier !== "warmup" ? num(total.model_total) : null,
  };
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

/** nba_slate_flags for the date joined to nba_signal_defs, projected to a compact shape:
 *  what fired, what it says to bet, and the validated record. Keyed like the model rows. */
async function fetchFlags(client: any, games: any[], date: string): Promise<Map<string, any[]>> {
  const result = new Map<string, any[]>();
  try {
    const [{ data: flags }, { data: defs }] = await Promise.all([
      client
        .from("nba_slate_flags")
        .select("game_id, game_date, game, signal_key, market, side, tier, conviction, line, bet_team, bet_direction, bet_line, grade_line, trigger_text, record_text")
        .eq("game_date", date),
      client.from("nba_signal_defs").select("signal_key, display_name, one_liner, bet_direction, record_text, tier"),
    ]);
    const defMap = new Map<string, any>();
    for (const d of defs || []) defMap.set(d.signal_key, d);
    const byAbbr = new Map<string, any[]>();
    for (const f of flags || []) {
      const def = defMap.get(f.signal_key);
      const item = {
        signal_key: f.signal_key,
        name: def?.display_name ?? f.signal_key,
        market: f.market,
        side: f.side,
        line: f.line,
        grade_line: f.grade_line,
        conviction: f.conviction,
        tier: f.tier,
        trigger: f.trigger_text ?? def?.one_liner ?? null,
        bet_direction: def?.bet_direction ?? f.bet_direction ?? null,
        record: f.record_text ?? def?.record_text ?? null,
      };
      const gid = f.game_id != null ? String(f.game_id) : "";
      const parts = String(f.game ?? "").split("@");
      const key = parts.length === 2 ? abbrKey(f.game_date, parts[1].trim(), parts[0].trim()) : "";
      const list = (gid && result.get(gid)) || (key && byAbbr.get(key)) || [];
      list.push(item);
      if (gid) result.set(gid, list);
      if (key) byAbbr.set(key, list);
    }
    for (const g of games) {
      const gid = String(g.game_id || "");
      if (!gid || result.has(gid)) continue;
      const list = byAbbr.get(abbrKey(g.game_date, g.home_abbr, g.away_abbr));
      if (list) result.set(gid, list);
    }
  } catch { /* non-critical */ }
  return result;
}
