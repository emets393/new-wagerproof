// Per-widget data payloads for the daily headline generator.
//
// Each widget gets its OWN payload rather than the whole formatted game, for two
// reasons: the model can't cite a number it was never shown (which is most of how
// a headline goes wrong), and the QC pass can then check the headline against a
// small, closed set of facts instead of a 4KB blob.
//
// Widget types are keyed to the BETTING QUESTION, not to a UI component — web and
// the native apps render different component trees for the same question, so one
// generated row has to serve all of them.
// See supabase/migrations/20260726120000_widget_headline_summaries.sql

export type Sport = "nfl" | "cfb" | "nba" | "ncaab" | "mlb";

export type WidgetType =
  | "market_odds"
  | "spread_prediction"
  | "ou_prediction"
  | "moneyline_prediction";

/**
 * Which widgets each sport actually renders. Generating a headline for a widget
 * the app never shows is pure spend, so this table is the spend control.
 *
 * MLB has no spread widget (it shows Moneyline + Total + First-5), and only MLB
 * has a dedicated moneyline card today.
 */
export const WIDGETS_BY_SPORT: Record<Sport, WidgetType[]> = {
  nfl: ["market_odds", "spread_prediction", "ou_prediction"],
  cfb: ["market_odds", "spread_prediction", "ou_prediction"],
  nba: ["market_odds", "spread_prediction", "ou_prediction"],
  ncaab: ["market_odds", "spread_prediction", "ou_prediction"],
  mlb: ["market_odds", "ou_prediction", "moneyline_prediction"],
};

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Probability (0-1) -> one-decimal percentage. Leaves already-percent values alone. */
const probPct = (v: unknown): number | null => {
  const n = num(v);
  if (n === null) return null;
  const p = Math.abs(n) <= 1 ? n * 100 : n;
  return Math.round(p * 10) / 10;
};

/** First non-null of the named keys, searched across several source objects. */
const pick = (sources: (Row | null | undefined)[], ...keys: string[]): unknown => {
  for (const key of keys) {
    for (const src of sources) {
      if (!src) continue;
      const v = src[key];
      if (v !== undefined && v !== null && v !== "") return v;
    }
  }
  return null;
};

/**
 * The web feed keys games differently per sport, and `ai_completions.game_id` has
 * to match what the client queries with or the headline silently never renders.
 * These expressions mirror src/features/games/api/*Games.ts — in particular CFB,
 * where the web feed keys on `cfb_live_weekly_inputs.id` while the agent
 * formatter keys on `training_key`. Derive from the RAW row, not the formatted
 * game, because the formatted `game_id` diverges for CFB.
 */
export function resolveGameId(sport: Sport, raw: Row, formatted: Row): string | null {
  const asStr = (v: unknown) => (v === undefined || v === null || v === "" ? null : String(v));
  switch (sport) {
    // nflGames.ts: id = home_away_unique. The adapter documents
    // "home_away_unique = training_key everywhere", so either resolves the same row.
    case "nfl":
      return asStr(raw.home_away_unique) ?? asStr(raw.training_key) ?? asStr(formatted.game_id);
    // cfbGames.ts: id = String(row.id) off cfb_live_weekly_inputs — NOT training_key.
    case "cfb":
      return asStr(raw.id) ?? asStr(formatted.game_id);
    // nbaGames.ts / ncaabGames.ts: id = String(game.game_id)
    case "nba":
    case "ncaab":
      return asStr(raw.game_id) ?? asStr(formatted.game_id);
    // mlbGames.ts: id = String(row.game_pk ?? row.id ?? ...)
    case "mlb":
      return asStr(raw.game_pk) ?? asStr(raw.id) ?? asStr(formatted.game_id);
    default:
      return null;
  }
}

export interface WidgetPayload {
  widget_type: WidgetType;
  sport: Sport;
  matchup: string;
  away_team: string;
  home_team: string;
  data: Record<string, unknown>;
}

/**
 * Project a game down to just what one widget's headline needs.
 *
 * Reads the formatted game's structured groups first (vegas_lines,
 * model_predictions, polymarket) and falls back to raw prediction columns for the
 * model-vs-market deltas, which live on the raw row rather than the formatted
 * projection. Returns null when the widget has nothing to say — an empty card
 * should stay silent rather than get a headline invented for it.
 */
export function buildWidgetPayload(
  sport: Sport,
  widget: WidgetType,
  raw: Row,
  fg: Row,
): WidgetPayload | null {
  const away = String(fg.away_team ?? raw.away_team ?? "");
  const home = String(fg.home_team ?? raw.home_team ?? "");
  const matchup = String(fg.matchup ?? `${away} @ ${home}`);
  const vegas = (fg.vegas_lines ?? {}) as Row;
  const model = (fg.model_predictions ?? {}) as Row;
  const base = { widget_type: widget, sport, matchup, away_team: away, home_team: home };

  switch (widget) {
    case "market_odds": {
      const poly = fg.polymarket as Row | null;
      // No prediction-market data means the widget renders empty — nothing to summarize.
      if (!poly) return null;
      // Relabel each market's two sides explicitly. The cache stores every market
      // as an away/home pair, but for a TOTAL those slots mean over/under — an
      // ambiguity that made the model report "82% on the under" when the 82% was
      // the over. Name the sides so neither the writer nor the judge has to guess.
      const sides = (m: unknown, awayLabel: string, homeLabel: string) => {
        const row = m as Row | null;
        if (!row) return null;
        return {
          [awayLabel]: (row as Row).away_odds_pct ?? null,
          [homeLabel]: (row as Row).home_odds_pct ?? null,
        };
      };
      return {
        ...base,
        data: {
          odds_are_implied_probability_pct: true,
          prediction_market: {
            moneyline: sides(poly.moneyline, `${away}_win_pct`, `${home}_win_pct`),
            spread: sides(poly.spread, `${away}_cover_pct`, `${home}_cover_pct`),
            total: sides(poly.total, "over_pct", "under_pct"),
          },
          // Included so the model can call out prediction-market vs sportsbook
          // disagreement, which is the most interesting thing this card shows.
          sportsbook_for_comparison: {
            away_ml: vegas.away_ml ?? null,
            home_ml: vegas.home_ml ?? null,
            home_spread: vegas.home_spread ?? null,
            total: vegas.total ?? null,
          },
          public_betting: fg.public_betting ?? null,
        },
      };
    }

    case "spread_prediction": {
      const coverProb = pick([model, raw], "spread_cover_prob", "home_away_spread_cover_prob");
      const homeSpread = num(pick([vegas, raw], "home_spread"));
      const edge = num(pick([raw, fg], "home_spread_diff"));
      if (coverProb === null && edge === null) return null;
      return {
        ...base,
        data: {
          vegas_home_spread: homeSpread,
          vegas_away_spread: num(pick([vegas, raw], "away_spread")),
          model_home_cover_probability_pct: probPct(coverProb),
          model_predicted_cover_team: model.predicted_team ?? null,
          model_fair_home_spread: num(
            pick([model, raw], "pred_spread", "model_fair_home_spread"),
          ),
          // Positive = value on the HOME side (vegas home spread − model fair spread).
          home_spread_edge_points: edge,
          weather: sport === "nfl" || sport === "cfb" ? (fg.weather ?? null) : null,
          public_betting: fg.public_betting ?? null,
        },
      };
    }

    case "ou_prediction": {
      if (sport === "mlb") {
        const ouEdge = num(pick([model, raw], "ou_edge"));
        const total = num(pick([raw], "total_line")) ?? num(vegas.total);
        if (ouEdge === null && total === null) return null;
        return {
          ...base,
          data: {
            vegas_total: total,
            model_fair_total: num(pick([model, raw], "ou_fair_total")),
            // 'OVER' | 'UNDER' — the MLB model emits a direction, not a probability.
            model_direction: pick([model, raw], "ou_direction"),
            total_edge_runs: ouEdge,
            first_five: {
              vegas_total: num(pick([raw], "f5_total_line")),
              model_fair_total: num(pick([model, raw], "f5_fair_total")),
              edge_runs: num(pick([model, raw], "f5_ou_edge")),
            },
            starting_pitchers: fg.starting_pitchers ?? null,
            weather: fg.weather ?? null,
          },
        };
      }
      const ouProb = pick([model, raw], "ou_prob", "ou_result_prob");
      const total = num(pick([vegas, raw], "total", "over_line", "api_over_line"));
      const edge = num(pick([raw, fg], "over_line_diff"));
      if (ouProb === null && edge === null && total === null) return null;
      return {
        ...base,
        data: {
          vegas_total: total,
          model_over_probability_pct: probPct(ouProb),
          model_fair_total: num(
            pick([model, raw], "pred_over_line", "model_fair_total"),
          ),
          // Positive = model projects MORE points than Vegas.
          total_edge_points: edge,
          weather: sport === "nfl" || sport === "cfb" ? (fg.weather ?? null) : null,
        },
      };
    }

    case "moneyline_prediction": {
      const homeWin = pick([model, raw], "ml_home_win_prob", "home_win_prob", "ml_prob");
      const homeEdge = num(pick([model, raw], "home_ml_edge_pct"));
      const awayEdge = num(pick([model, raw], "away_ml_edge_pct"));
      if (homeWin === null && homeEdge === null && awayEdge === null) return null;
      return {
        ...base,
        data: {
          vegas_away_ml: vegas.away_ml ?? null,
          vegas_home_ml: vegas.home_ml ?? null,
          model_home_win_probability_pct: probPct(homeWin),
          model_away_win_probability_pct: probPct(
            pick([model, raw], "ml_away_win_prob", "away_win_prob"),
          ),
          // Edge is already a percentage on the MLB prediction rows.
          home_ml_edge_pct: homeEdge,
          away_ml_edge_pct: awayEdge,
          first_five:
            sport === "mlb"
              ? {
                  home_win_probability_pct: probPct(pick([model, raw], "f5_home_win_prob")),
                  away_win_probability_pct: probPct(pick([model, raw], "f5_away_win_prob")),
                  home_ml_edge_pct: num(pick([model, raw], "f5_home_ml_edge_pct")),
                  away_ml_edge_pct: num(pick([model, raw], "f5_away_ml_edge_pct")),
                }
              : null,
          starting_pitchers: sport === "mlb" ? (fg.starting_pitchers ?? null) : null,
        },
      };
    }

    default:
      return null;
  }
}
