// get_sport_predictions — unified model-prediction reader across all five
// leagues (NFL, NBA, CFB, NCAAB, MLB). Ported from the WagerBot chat tools
// (get_*_predictions.ts); the chat-only `game_cards` normalization is dropped
// (that's a presentation concern). Returns model ESTIMATES + analytics for
// research — never staking advice.

import {
  readOnly,
  asOptString,
  asSport,
  type SupabaseLikeClient,
  type Tool,
  type ToolContext,
} from "../../types.js";

export const getSportPredictions: Tool = {
  name: "get_sport_predictions",
  title: "Get model predictions",
  scope: "global",
  annotations: readOnly("Get model predictions"),
  description:
    "Get WagerProof's machine-learning model estimates for a league's games on a " +
    "given date (or the current week for NFL/CFB). Returns per-game model " +
    "win-probabilities, fair spread/total, the model's edge vs. the market line, " +
    "and league-specific analytics: NBA team efficiency ratings + L3/L5 form, " +
    "injuries and situational splits; MLB starting pitchers, Statcast signals, " +
    "park/weather and season-to-date model accuracy by day-of-week and team; " +
    "NCAAB ratings/rankings; NFL/CFB weather and public-betting splits. These are " +
    "model estimates for analysis, not betting advice.",
  inputSchema: {
    type: "object",
    properties: {
      sport: {
        type: "string",
        enum: ["nfl", "nba", "cfb", "ncaab", "mlb"],
        description: "The league to fetch model predictions for.",
      },
      date: {
        type: "string",
        description:
          "Date in YYYY-MM-DD (Eastern Time). Defaults to today. Ignored for " +
          "NFL/CFB, which return the current week's loaded slate.",
      },
      team: {
        type: "string",
        description: "Optional team-name filter (e.g. 'Lakers', 'Chiefs', 'Alabama').",
      },
    },
    required: ["sport"],
    additionalProperties: false,
  },
  async execute(input, ctx) {
    const sport = asSport(input.sport);
    if (!sport) {
      throw new Error("Invalid `sport` — must be one of nfl, nba, cfb, ncaab, mlb.");
    }
    const date = asOptString(input.date) ?? ctx.today();
    const team = asOptString(input.team);

    switch (sport) {
      case "nfl":
        return getNflCfb(ctx, "nfl", team);
      case "cfb":
        return getNflCfb(ctx, "cfb", team);
      case "nba":
        return getNba(ctx, date, team);
      case "ncaab":
        return getNcaab(ctx, date, team);
      case "mlb":
        return getMlb(ctx, date, team);
    }
  },
};

// ---- formatting helpers ----------------------------------------------------

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

function teamFilter<T extends Record<string, unknown>>(
  rows: T[],
  team: string | undefined,
  awayKey: string,
  homeKey: string,
): T[] {
  if (!team) return rows;
  const t = team.toLowerCase();
  return rows.filter(
    (g) =>
      String(g[awayKey] ?? "").toLowerCase().includes(t) ||
      String(g[homeKey] ?? "").toLowerCase().includes(t),
  );
}

// ---- NFL / CFB (current-week tables) ---------------------------------------

async function getNflCfb(ctx: ToolContext, sport: "nfl" | "cfb", team?: string) {
  const cfb = ctx.cfb;
  let rows: Record<string, unknown>[] = [];

  if (sport === "nfl") {
    const { data: latestRun } = await cfb
      .from("nfl_predictions_epa")
      .select("run_id")
      .order("run_id", { ascending: false })
      .limit(1)
      .single();
    if (!latestRun) return { games: [], message: "No NFL predictions available" };
    const { data, error } = await cfb
      .from("nfl_predictions_epa")
      .select("*")
      .eq("run_id", (latestRun as Record<string, unknown>).run_id);
    if (error) throw new Error(`NFL predictions query failed: ${error.message}`);
    rows = data ?? [];
  } else {
    const { data, error } = await cfb.from("cfb_live_weekly_inputs").select("*");
    if (error) throw new Error(`CFB predictions query failed: ${error.message}`);
    rows = data ?? [];
  }

  if (rows.length === 0) return { games: [], message: `No ${sport.toUpperCase()} games found` };

  const filtered = teamFilter(rows, team, "away_team", "home_team");
  if (team && filtered.length === 0) {
    return { games: [], message: `No ${sport.toUpperCase()} games found matching "${team}"` };
  }

  const games = filtered.map((g) => ({
    game_id: g.training_key || `${g.away_team}_${g.home_team}`,
    matchup: `${g.away_team} @ ${g.home_team}`,
    away_team: g.away_team,
    home_team: g.home_team,
    ...(sport === "cfb" ? { conference: g.conference } : {}),
    game_date: g.game_date,
    game_time: g.game_time,
    vegas_lines: {
      spread: `${g.home_team} ${fmtSpread(g.home_spread)}`,
      moneyline: `${g.away_team} ${g.away_ml ?? "N/A"} / ${g.home_team} ${g.home_ml ?? "N/A"}`,
      total: g.over_line,
    },
    model_predictions: {
      ml_pick: g.ml_pick,
      ml_confidence: g.ml_confidence,
      spread_pick: g.spread_pick,
      spread_confidence: g.spread_confidence,
      ou_pick: g.ou_pick,
      ou_confidence: g.ou_confidence,
      model_fair_spread: g.model_fair_spread,
      model_fair_total: g.model_fair_total,
      ...(sport === "nfl"
        ? {
            predicted_home_score: g.predicted_home_score,
            predicted_away_score: g.predicted_away_score,
          }
        : {}),
    },
    weather: {
      temperature: g.temperature,
      wind_speed: g.wind_speed,
      precipitation: g.precipitation,
    },
    ...(sport === "nfl"
      ? {
          public_betting: {
            spread_split: g.spread_splits_label,
            ml_split: g.ml_splits_label,
            total_split: g.total_splits_label,
          },
        }
      : {}),
  }));

  return { sport, games, count: games.length };
}

// ---- NBA -------------------------------------------------------------------

async function getNba(ctx: ToolContext, date: string, team?: string) {
  const cfb = ctx.cfb;
  const { data: rows, error } = await cfb
    .from("nba_input_values_view")
    .select("*")
    .eq("game_date", date);
  if (error) throw new Error(`NBA predictions query failed: ${error.message}`);
  if (!rows || rows.length === 0) return { games: [], message: `No NBA games found for ${date}` };

  const filtered = teamFilter(rows, team, "away_team", "home_team");
  if (team && filtered.length === 0) {
    return { games: [], message: `No NBA games found matching "${team}" on ${date}` };
  }

  const numericGameIds = filtered.map((g) => g.game_id).filter(Boolean);
  const stringGameIds = filtered.map((g) => String(g.game_id)).filter(Boolean);
  const teams = [
    ...new Set(filtered.flatMap((g) => [g.away_team, g.home_team]).filter(Boolean)),
  ] as string[];

  const [predictionMap, injuryData, situationalData, accuracyData] = await Promise.all([
    fetchNbaPredictions(cfb, numericGameIds),
    fetchNbaInjuries(cfb, teams, date),
    fetchSituational(cfb, "nba_game_situational_trends_today", stringGameIds),
    fetchAccuracy(cfb, "nba_todays_games_predictions_with_accuracy_cache", stringGameIds, date),
  ]);

  const games = filtered.map((game) => {
    const gid = String(game.game_id ?? "");
    const prediction = predictionMap.get(game.game_id as number) ?? null;
    const homeML = (game.home_moneyline as number | null) ?? null;
    const dbAwayML = (game.away_moneyline as number | null) ?? null;
    const awayML =
      dbAwayML ?? (homeML != null ? (homeML > 0 ? -(homeML + 100) : 100 - homeML) : null);
    const homeSpread = (game.home_spread as number | null) ?? null;
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
            spread_edge:
              homeSpread != null && prediction.model_fair_home_spread != null
                ? round2((prediction.model_fair_home_spread as number) - homeSpread)
                : null,
            total_edge:
              game.total_line != null && prediction.model_fair_total != null
                ? round2((prediction.model_fair_total as number) - (game.total_line as number))
                : null,
          }
        : null,
      team_stats: {
        home: {
          overall_rating: game.home_ovr_rtg,
          adj_off_rtg: game.home_adj_off_rtg,
          adj_def_rtg: game.home_adj_def_rtg,
          adj_pace: game.home_adj_pace,
          consistency: game.home_consistency,
          luck: game.home_luck,
          fg2_pct: game.home_adj_fg2_pct,
          fg3_pct: game.home_adj_fg3_pct,
          ft_pct: game.home_ft_pct,
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
        away: injuryData.get(String(game.away_team).toLowerCase()) ?? null,
        home: injuryData.get(String(game.home_team).toLowerCase()) ?? null,
      },
      situational: situationalData.get(gid) ?? null,
      accuracy: accuracyData.get(gid) ?? null,
    };
  });

  return { sport: "nba", games, date, count: games.length };
}

async function fetchNbaPredictions(
  client: SupabaseLikeClient,
  gameIds: unknown[],
): Promise<Map<unknown, Record<string, unknown>>> {
  const result = new Map<unknown, Record<string, unknown>>();
  if (gameIds.length === 0) return result;
  try {
    const { data: latestRun } = await client
      .from("nba_predictions")
      .select("run_id, as_of_ts_utc")
      .order("as_of_ts_utc", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latestRun) return result;
    const { data: preds } = await client
      .from("nba_predictions")
      .select(
        "game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread, run_id",
      )
      .eq("run_id", (latestRun as Record<string, unknown>).run_id)
      .in("game_id", gameIds);
    for (const pred of preds ?? []) result.set(pred.game_id, pred);
  } catch {
    /* non-critical */
  }
  return result;
}

async function fetchNbaInjuries(
  client: SupabaseLikeClient,
  teams: string[],
  date: string,
): Promise<Map<string, unknown[]>> {
  const result = new Map<string, unknown[]>();
  if (teams.length === 0) return result;
  try {
    const { data } = await client
      .from("nba_injury_report")
      .select("player_name, avg_pie_season, status, team_name, game_date_et, bucket")
      .in("team_name", teams)
      .eq("game_date_et", date)
      .eq("bucket", "current");
    for (const row of data ?? []) {
      const key = String(row.team_name ?? "").toLowerCase();
      if (!result.has(key)) result.set(key, []);
      result.get(key)!.push({
        player: row.player_name,
        status: row.status,
        impact: row.avg_pie_season,
      });
    }
  } catch {
    /* non-critical */
  }
  return result;
}

async function fetchSituational(
  client: SupabaseLikeClient,
  table: string,
  gameIds: string[],
): Promise<Map<string, unknown>> {
  const result = new Map<string, { away: unknown; home: unknown }>();
  if (gameIds.length === 0) return result;
  try {
    const { data } = await client.from(table).select("*").in("game_id", gameIds);
    for (const row of data ?? []) {
      const gid = String(row.game_id ?? "");
      if (!result.has(gid)) result.set(gid, { away: null, home: null });
      const entry = result.get(gid)!;
      if (row.team_side === "away") entry.away = row;
      else if (row.team_side === "home") entry.home = row;
    }
  } catch {
    /* non-critical */
  }
  return result;
}

async function fetchAccuracy(
  client: SupabaseLikeClient,
  table: string,
  gameIds: string[],
  date: string,
): Promise<Map<string, unknown>> {
  const result = new Map<string, unknown>();
  if (gameIds.length === 0) return result;
  try {
    const { data } = await client
      .from(table)
      .select("*")
      .in("game_id", gameIds)
      .eq("game_date", date);
    for (const row of data ?? []) result.set(String(row.game_id ?? ""), row);
  } catch {
    /* non-critical */
  }
  return result;
}

// ---- NCAAB -----------------------------------------------------------------

async function getNcaab(ctx: ToolContext, date: string, team?: string) {
  const cfb = ctx.cfb;
  const { data: rows, error } = await cfb
    .from("v_cbb_input_values")
    .select("*")
    .eq("game_date_et", date);
  if (error) throw new Error(`NCAAB input values query failed: ${error.message}`);
  if (!rows || rows.length === 0) return { games: [], message: `No NCAAB games found for ${date}` };

  const filtered = teamFilter(rows, team, "away_team", "home_team");
  if (team && filtered.length === 0) {
    return { games: [], message: `No NCAAB games found matching "${team}" on ${date}` };
  }

  const gameIds = filtered.map((g) => g.game_id).filter(Boolean);
  const predictionsMap = await fetchNcaabPredictions(cfb, gameIds);

  const games = filtered.map((game) => {
    const preds = predictionsMap.get(game.game_id) ?? null;
    return {
      game_id: game.game_id,
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

  return { sport: "ncaab", games, date, count: games.length };
}

async function fetchNcaabPredictions(
  client: SupabaseLikeClient,
  gameIds: unknown[],
): Promise<Map<unknown, Record<string, unknown>>> {
  const result = new Map<unknown, Record<string, unknown>>();
  if (gameIds.length === 0) return result;
  try {
    const { data: latestRun } = await client
      .from("ncaab_predictions")
      .select("run_id")
      .order("run_id", { ascending: false })
      .limit(1);
    if (!latestRun || latestRun.length === 0) return result;
    const runId = (latestRun[0] as Record<string, unknown>).run_id;
    const { data: preds } = await client
      .from("ncaab_predictions")
      .select(
        "game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread",
      )
      .eq("run_id", runId)
      .in("game_id", gameIds);
    for (const row of preds ?? []) result.set(row.game_id, row);
  } catch {
    /* non-critical */
  }
  return result;
}

// ---- MLB -------------------------------------------------------------------

interface BreakdownRow {
  bet_type: string;
  breakdown_type: string;
  breakdown_value: string;
  games: number;
  wins: number;
  losses: number;
  win_pct: number;
  roi_pct: number;
}

async function getMlb(ctx: ToolContext, date: string, team?: string) {
  const cfb = ctx.cfb;

  let games: Record<string, unknown>[] = [];
  const { data: strictGames } = await cfb
    .from("mlb_games_today")
    .select("*")
    .eq("official_date", date)
    .or("is_active.eq.true,is_active.is.null")
    .or("is_completed.eq.false,is_completed.is.null")
    .order("game_time_et", { ascending: true });
  games = strictGames ?? [];
  if (games.length === 0) {
    const { data: relaxed } = await cfb
      .from("mlb_games_today")
      .select("*")
      .eq("official_date", date)
      .order("game_time_et", { ascending: true });
    games = (relaxed ?? []).filter(
      (g) => g.is_postponed !== true && g.is_completed !== true,
    );
  }
  if (games.length === 0) return { games: [], message: `No MLB games found for ${date}` };

  if (team) {
    const t = team.toLowerCase();
    games = games.filter(
      (g) =>
        String(g.away_team_name ?? "").toLowerCase().includes(t) ||
        String(g.home_team_name ?? "").toLowerCase().includes(t),
    );
    if (games.length === 0) {
      return { games: [], message: `No MLB games found matching "${team}" on ${date}` };
    }
  }

  // Game signals, keyed by integer game_pk.
  const gamePks = games.map((g) => g.game_pk).filter(Boolean);
  const signalsByPk = new Map<string, Record<string, unknown>>();
  if (gamePks.length > 0) {
    try {
      const { data } = await cfb
        .from("mlb_game_signals")
        .select("game_pk, home_signals, away_signals, game_signals")
        .in("game_pk", gamePks);
      for (const row of data ?? []) {
        signalsByPk.set(String(Math.trunc(Number(row.game_pk))), row);
      }
    } catch {
      /* non-critical */
    }
  }

  // Full breakdown-accuracy pull (~76 rows): DOW + team model accuracy per bet type.
  const bdMap = new Map<string, BreakdownRow>();
  try {
    const { data: bdRows } = await cfb
      .from("mlb_model_breakdown_accuracy")
      .select("bet_type, breakdown_type, breakdown_value, games, wins, losses, win_pct, roi_pct");
    for (const r of (bdRows ?? []) as unknown as BreakdownRow[]) {
      bdMap.set(`${r.bet_type}|${r.breakdown_type}|${r.breakdown_value}`, r);
    }
  } catch {
    /* non-critical */
  }

  // team_id → abbr (ARI→AZ, OAK→ATH to match mlb_game_log).
  const teamAbbrById = new Map<number, string>();
  try {
    const { data: teamRows } = await cfb.from("mlb_team_mapping").select("mlb_api_id, team");
    for (const t of (teamRows ?? []) as { mlb_api_id: number; team: string }[]) {
      const abbr = t.team === "ARI" ? "AZ" : t.team === "OAK" ? "ATH" : t.team;
      teamAbbrById.set(t.mlb_api_id, abbr);
    }
  } catch {
    /* non-critical */
  }

  const dowFromDate = (d: unknown): string | null => {
    if (!d) return null;
    const date = new Date(`${d}T12:00:00Z`);
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getUTCDay()];
  };
  const lookupBD = (bet: string, type: string, val: string | null) => {
    if (!val) return null;
    const r = bdMap.get(`${bet}|${type}|${val}`);
    return r
      ? { games: r.games, record: `${r.wins}-${r.losses}`, win_pct: r.win_pct, roi_pct: r.roi_pct }
      : null;
  };

  const formatted = games.map((game) => {
    const pk = String(Math.trunc(Number(game.game_pk)));
    const signals = signalsByPk.get(pk);
    const dow = dowFromDate(game.official_date);
    const homeAbbr = teamAbbrById.get(game.home_team_id as number) ?? null;
    const awayAbbr = teamAbbrById.get(game.away_team_id as number) ?? null;

    const homeEdge = (game.home_ml_edge_pct as number) ?? -1;
    const awayEdge = (game.away_ml_edge_pct as number) ?? -1;
    const mlPickAbbr =
      homeEdge >= awayEdge && ((game.home_ml_edge_pct as number) ?? 0) > 0
        ? homeAbbr
        : ((game.away_ml_edge_pct as number) ?? 0) > 0
          ? awayAbbr
          : null;
    const f5HomeEdge = (game.f5_home_ml_edge_pct as number) ?? -1;
    const f5AwayEdge = (game.f5_away_ml_edge_pct as number) ?? -1;
    const f5MlPickAbbr =
      f5HomeEdge >= f5AwayEdge && ((game.f5_home_ml_edge_pct as number) ?? 0) > 0
        ? homeAbbr
        : ((game.f5_away_ml_edge_pct as number) ?? 0) > 0
          ? awayAbbr
          : null;

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
      breakdown_context: {
        day_of_week: dow,
        dow_accuracy: {
          full_ml: lookupBD("full_ml", "dow", dow),
          full_ou: lookupBD("full_ou", "dow", dow),
          f5_ml: lookupBD("f5_ml", "dow", dow),
          f5_ou: lookupBD("f5_ou", "dow", dow),
        },
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
      },
    };
  });

  return { sport: "mlb", games: formatted, date, count: formatted.length };
}

// ---- signal parsing --------------------------------------------------------

function parseSignals(raw: unknown): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((s: unknown) => {
      if (typeof s === "string") {
        try {
          return (JSON.parse(s) as { message?: string }).message || s;
        } catch {
          return s;
        }
      }
      if (s && typeof s === "object") return (s as { message?: string }).message || "";
      return "";
    })
    .filter(Boolean) as string[];
}
