// query_historical_trends / get_trend_matches_today — the Historical Trends
// filter engine exposed over MCP. The AI client translates the user's sentence
// into whitelisted filter keys; the warehouse computes AGGREGATES server-side
// (record / hit % / ROI / splits). Raw game rows are never returned, unknown
// keys are rejected with the valid list so the model can self-correct, and the
// underlying RPCs carry their own statement timeouts.
//
// Same engine as the app pages and the Systems grader — one WHERE, every
// surface. Key list: ./trendFilterKeys.ts (generated from the live engine).

import { readOnly, type Tool } from "../../types.js";
import { TREND_FILTER_KEYS } from "./trendFilterKeys.js";

const BET_TYPES: Record<string, readonly string[]> = {
  nfl: ["fg_spread", "fg_ml", "fg_total", "team_total", "h1_spread", "h1_ml", "h1_total"],
  cfb: ["fg_spread", "fg_ml", "fg_total", "team_total", "h1_spread", "h1_ml", "h1_total"],
  mlb: ["ml", "rl", "total", "f5_ml", "f5_rl", "f5_total"],
};

// The semantics Claude must know to write correct values. Kept in the tool
// description (shared by both tools) so translation errors stay rare.
const FILTER_SEMANTICS =
  "FILTER VALUE SEMANTICS (critical):\n" +
  "- *_pct keys are FRACTIONS 0-1 (win_pct_min 0.6 = 60%), except nothing — never send 60 for 60%.\n" +
  "- spread_min/spread_max are SIGNED team-perspective points: favored = NEGATIVE " +
  "(favored by 3-7 => spread_min -7, spread_max -3; getting 3-7 => 3 to 7). " +
  "abs_spread_min/max are unsigned magnitudes.\n" +
  "- last_margin_min/max (and opp_/h2h_ variants) are SIGNED: won by 10+ => min 10; lost by 7+ => max -7.\n" +
  "- Streak keys are counts of CONSECUTIVE games ENTERING the game (win_streak_min 9 = riding 9+ wins).\n" +
  "- day_of_week is an ARRAY of day names ([\"Sun\",\"Mon\"]); team/opponent are ARRAYS " +
  "(NFL/MLB abbreviations like KC/LAD; CFB full school names like \"Ohio State\").\n" +
  "- Tri-state keys (dome, primetime, division, doubleheader, ...) are true/false; omit for 'any'.\n" +
  "- ml_min/ml_max are American odds numbers (-150, 130). temp/wind are deg F / mph.\n" +
  "- season_min/season_max bound the year window (data: NFL 2018+, CFB 2016+, MLB 2023+; " +
  "prices for ROI are complete 2023+ NFL/MLB, 2021+ CFB).\n" +
  "- If the user's ask is NOT expressible with these keys (e.g. 'won 3 of their last 6', " +
  "custom sequences), SAY you can't compute that exact cut and offer the nearest supported filter. " +
  "Never approximate silently.";

function validate(input: Record<string, unknown>): {
  sport: string;
  betType: string;
  filters: Record<string, unknown>;
} {
  const sport = String(input.sport ?? "");
  if (!TREND_FILTER_KEYS[sport]) throw new Error(`Invalid sport — use one of: nfl, cfb, mlb.`);
  const betType = String(input.bet_type ?? "");
  if (!BET_TYPES[sport].includes(betType)) {
    throw new Error(`Invalid bet_type for ${sport} — use one of: ${BET_TYPES[sport].join(", ")}.`);
  }
  const raw = (input.filters ?? {}) as Record<string, unknown>;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("`filters` must be an object.");
  const allowed = new Set(TREND_FILTER_KEYS[sport]);
  const unknown = Object.keys(raw).filter((k) => !allowed.has(k));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown filter key(s) for ${sport}: ${unknown.join(", ")}. ` +
        `Valid keys: ${TREND_FILTER_KEYS[sport].join(", ")}`,
    );
  }
  return { sport, betType, filters: raw };
}

const INPUT_SCHEMA = {
  type: "object",
  properties: {
    sport: {
      type: "string",
      enum: ["nfl", "cfb", "mlb"],
      description: "League whose historical warehouse to query.",
    },
    bet_type: {
      type: "string",
      description:
        "Result market to grade. NFL/CFB: fg_spread, fg_ml, fg_total, team_total, " +
        "h1_spread, h1_ml, h1_total. MLB: ml, rl, total, f5_ml, f5_rl, f5_total.",
    },
    filters: {
      type: "object",
      description:
        "Whitelisted filter keys (call once with an unknown key to get the full list back " +
        "in the error, or just use known keys). Common: side ('home'/'away'), fav_dog " +
        "('favorite'/'underdog'), win_streak_min, loss_streak_min, win_pct_min (0-1), " +
        "last_won/last_covered/last_over (1 or 0), last_margin_min/max (signed), " +
        "spread_min/max (signed), total_min/max, ml_min/max (American), season_min/max, " +
        "week_min/max, day_of_week (array), team/opponent (array), h2h_last_win, " +
        "opp_win_pct_min, dome, primetime, temp_min/max, wind_min/max… (~110-123 keys/sport).",
      additionalProperties: true,
    },
  },
  required: ["sport", "bet_type"],
  additionalProperties: false,
} as const;

export const queryHistoricalTrends: Tool = {
  name: "query_historical_trends",
  title: "Query historical betting trends",
  scope: "global",
  annotations: readOnly("Query historical betting trends"),
  description:
    "Grade any filterable situation against WagerProof's historical results warehouse " +
    "(NFL 2018+, CFB 2016+, MLB 2023+). Returns AGGREGATES ONLY: overall record, hit %, " +
    "real-price ROI, home/away + favorite/underdog (or over/under) splits, and per-team " +
    "breakdowns — the exact numbers the app's Historical Trends page shows for the same " +
    "filters. Chain calls to compare situations. Historical performance, not advice; " +
    "always report the sample size (n) alongside any rate.\n\n" +
    FILTER_SEMANTICS,
  inputSchema: INPUT_SCHEMA,
  async execute(input, ctx) {
    const { sport, betType, filters } = validate(input as Record<string, unknown>);
    const { data, error } = await ctx.cfb.rpc(`${sport}_analysis`, {
      p_bet_type: betType,
      p_filters: filters,
    });
    if (error) throw new Error(`Trends query failed: ${error.message}`);
    return data ?? { error: "empty response" };
  },
};

export const getTrendMatchesToday: Tool = {
  name: "get_trend_matches_today",
  title: "Get today's games matching a trend",
  scope: "global",
  annotations: readOnly("Get today's games matching a trend"),
  description:
    "List UPCOMING games (today's slate) that match the same filters used in " +
    "query_historical_trends — 'which games tonight fit this situation'. Uses each " +
    "team's CURRENT form (streaks, records, H2H, weather forecast where available). " +
    "Same sport/bet_type/filters contract and value semantics as query_historical_trends. " +
    "Off-season sports return an empty list. Filters that need data not yet posted " +
    "(e.g. weather forecast) exclude games rather than guessing.\n\n" +
    FILTER_SEMANTICS,
  inputSchema: INPUT_SCHEMA,
  async execute(input, ctx) {
    const { sport, betType, filters } = validate(input as Record<string, unknown>);
    const { data, error } = await ctx.cfb.rpc(`${sport}_analysis_upcoming`, {
      p_bet_type: betType,
      p_filters: filters,
    });
    if (error) throw new Error(`Upcoming-matches query failed: ${error.message}`);
    const games = Array.isArray(data) ? data : [];
    return { count: games.length, games };
  },
};

export const historicalTrendsTools: Tool[] = [queryHistoricalTrends, getTrendMatchesToday];
