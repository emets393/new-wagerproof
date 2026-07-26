// Slate loader for the daily headline generator.
//
// This deliberately does NOT reuse agents-v3's fetchGamesForSport. That path is
// built for the pick-generation agent and reads prediction tables directly, which
// leaves out fields the detail widgets actually render: nfl_predictions_epa has no
// moneylines, no total, and none of the model-vs-market deltas, and it keys CFB on
// a `training_key` column that cfb_live_weekly_inputs does not have.
//
// A headline has to describe what the user is looking at, and it has to be stored
// under the game id the client queries with, so this mirrors the WEB feed adapters
// (src/features/games/api/*Games.ts) instead.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sport } from "./widgetPayloads";

type Row = Record<string, unknown>;

export interface SlateGame {
  /** Must equal the id the web feed uses, or the client never finds the headline. */
  gameId: string;
  sport: Sport;
  awayTeam: string;
  homeTeam: string;
  /** Raw + merged columns, shaped like the formatted game the payload builder expects. */
  fg: Row;
  raw: Row;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Prediction-market odds keyed the way update-polymarket-cache writes them:
 * `{league}_{away_team}_{home_team}`, odds as 0-100 percentages.
 */
async function fetchPolymarket(
  main: SupabaseClient,
  league: string,
): Promise<Map<string, Row>> {
  const byKey = new Map<string, Row>();
  const { data, error } = await main
    .from("polymarket_markets")
    .select("game_key, market_type, current_away_odds, current_home_odds")
    .eq("league", league);
  if (error || !data) return byKey;

  for (const row of data as Row[]) {
    const key = String(row.game_key ?? "");
    if (!key) continue;
    const entry = (byKey.get(key) ?? {}) as Row;
    entry[String(row.market_type)] = {
      away_odds_pct: num(row.current_away_odds),
      home_odds_pct: num(row.current_home_odds),
    };
    byKey.set(key, entry);
  }
  return byKey;
}

/**
 * MLB slate. `mlb_games_today` is self-contained — it already carries the Vegas
 * lines, the model probabilities and edges, the starters and the weather — so
 * unlike the other sports there is no prediction table to merge in.
 */
async function loadMlb(
  cfb: SupabaseClient,
  main: SupabaseClient,
  targetDate: string,
): Promise<SlateGame[]> {
  const { data, error } = await cfb
    .from("mlb_games_today")
    .select("*")
    .eq("official_date", targetDate);
  if (error) throw new Error(`mlb_games_today: ${error.message}`);

  const poly = await fetchPolymarket(main, "mlb");
  const games: SlateGame[] = [];

  for (const raw of (data ?? []) as Row[]) {
    // A postponed game shows a "Postponed" card instead of the widgets.
    if (raw.is_postponed === true) continue;
    // Without a model run there is nothing to summarize on the model cards, and
    // the market card alone isn't worth a generation pass.
    if (raw.prediction_available === false) continue;

    const gamePk = raw.game_pk;
    if (gamePk === null || gamePk === undefined) continue;
    const away = String(raw.away_team_name ?? "");
    const home = String(raw.home_team_name ?? "");

    const pm = poly.get(`mlb_${away}_${home}`) ?? null;

    games.push({
      gameId: String(gamePk),
      sport: "mlb",
      awayTeam: away,
      homeTeam: home,
      raw,
      fg: {
        game_id: String(gamePk),
        matchup: `${away} @ ${home}`,
        away_team: away,
        home_team: home,
        vegas_lines: {
          home_ml: num(raw.home_ml),
          away_ml: num(raw.away_ml),
          total: num(raw.total_line),
          home_spread: num(raw.home_spread),
          away_spread: num(raw.away_spread),
        },
        model_predictions: {
          ml_home_win_prob: num(raw.ml_home_win_prob),
          ml_away_win_prob: num(raw.ml_away_win_prob),
          home_ml_edge_pct: num(raw.home_ml_edge_pct),
          away_ml_edge_pct: num(raw.away_ml_edge_pct),
          ou_direction: raw.ou_direction ?? null,
          ou_edge: num(raw.ou_edge),
          ou_fair_total: num(raw.ou_fair_total),
          f5_home_win_prob: num(raw.f5_home_win_prob),
          f5_away_win_prob: num(raw.f5_away_win_prob),
          f5_home_ml_edge_pct: num(raw.f5_home_ml_edge_pct),
          f5_away_ml_edge_pct: num(raw.f5_away_ml_edge_pct),
          f5_ou_edge: num(raw.f5_ou_edge),
          f5_fair_total: num(raw.f5_fair_total),
        },
        starting_pitchers: {
          away_sp: raw.away_sp_name ?? "TBD",
          away_sp_confirmed: raw.away_sp_confirmed ?? false,
          home_sp: raw.home_sp_name ?? "TBD",
          home_sp_confirmed: raw.home_sp_confirmed ?? false,
        },
        weather: {
          temperature_f: raw.temperature_f ?? null,
          wind_speed_mph: raw.wind_speed_mph ?? null,
          wind_direction: raw.wind_direction ?? null,
          sky: raw.sky ?? null,
        },
        polymarket: pm,
      },
    });
  }
  return games;
}

/**
 * Load the slate for one sport.
 *
 * Only MLB is implemented. The other four are out of season as of this writing
 * (their input views and prediction tables return zero rows), so an
 * implementation could not be verified against real data — and each needs its own
 * merge to reproduce what the web feed shows:
 *   NFL   v_input_values_with_epa + nfl_predictions_epa + nfl_betting_lines + production_weather
 *   CFB   cfb_live_weekly_inputs + cfb_api_predictions (join on id)
 *   NBA   nba_input_values_view + nba_predictions   (edges DERIVED, see nbaGames.ts)
 *   NCAAB v_cbb_input_values + ncaab_predictions    (edges DERIVED)
 * Note that NBA/NCAAB cover probabilities are a client-side heuristic
 * (5%/point), not model output — a headline must not present them as the model's
 * own confidence.
 */
export async function loadSlate(
  sport: Sport,
  cfb: SupabaseClient,
  main: SupabaseClient,
  targetDate: string,
): Promise<SlateGame[]> {
  switch (sport) {
    case "mlb":
      return loadMlb(cfb, main, targetDate);
    default:
      return [];
  }
}

/** Sports the generator can currently produce headlines for. */
export const SUPPORTED_SPORTS: Sport[] = ["mlb"];
