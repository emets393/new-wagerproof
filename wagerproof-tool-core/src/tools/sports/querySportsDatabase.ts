// Raw read-only SQL exploration over the sports warehouse — the "obscure data
// theories" tools. Safety lives in the DATABASE, not here:
//   - public.mcp_run_sql() accepts a single SELECT/WITH statement only, runs it
//     under the SELECT-only `mcp_explorer` role (writes are impossible at the
//     permission level), with a 12s statement timeout and a 400-row cap.
//   - EXECUTE on the RPC is granted to service_role only, so these tools need
//     the host to supply ctx.cfbService (see DataContext.cfbService).
// Both tools are scope:"user": raw exploration is for signed-in users only.

import { asString, readOnly, type Tool, type ToolContext } from "../../types.js";

function requireService(ctx: ToolContext) {
  if (!ctx.cfbService) {
    throw new Error(
      "SQL exploration is not configured on this deployment (missing CFB service client).",
    );
  }
  return ctx.cfbService;
}

export const querySportsDatabase: Tool = {
  name: "query_sports_database",
  title: "Query the sports database (SQL)",
  description: [
    "Run a single read-only SQL SELECT against WagerProof's sports warehouse (Postgres). Use this to",
    "test bespoke betting theories that the curated tools can't express — situational splits, streaks,",
    "line-movement patterns, umpire/park/weather effects, anything derivable from the data.",
    "",
    "Key tables (call get_sports_schema for the full catalog with columns):",
    "- mlb_analysis_base / nfl_analysis_base / cfb_analysis_base — one row per TEAM per game with",
    "  results, closing lines, situational flags (streaks, rest, series game, favorite/underdog,",
    "  weather, park) and leak-safe 'entering this game' season-to-date form. The workhorses.",
    "- mlb_game_log, mlb_pitcher_logs, mlb_team_batting_logs, mlb_bullpen_pregame, mlb_odds_snapshots",
    "  (hourly line history), mlb_schedule, mlb_park_factors, mlb_power_ratings.",
    "- nfl_betting_lines, nfl_epa_data, nfl_predictions_epa, nfl_team_trends; cfb_games, cfb_api_predictions.",
    "- nba_/ncaab_ tables: predictions, ratings, odds snapshots, situational trends.",
    "- PLAYER PROPS — mlb_player_props (every book line, all markets, by date),",
    "  mlb_player_prop_picks (the ranked board: side, tier, score, L10, rationale),",
    "  mlb_player_prop_grades + v_mlb_player_prop_grade_summary (settled results, ROI by",
    "  tier/market), mlb_batter_logs / mlb_pitcher_logs for game-by-game hit-or-miss.",
    "  Projections: mlb_batter_matchup_projections (batter-vs-pitcher per-PA probabilities),",
    "  mlb_pitcher_k_projections (proj_k vs the posted line + edge), mlb_batter_game_projections,",
    "  mlb_pitcher_game_projections, mlb_team_run_projections, mlb_prop_market_probabilities.",
    "  NFL: nfl_player_props, nfl_slate_props, nfl_player_prop_trends, nfl_prop_player_pages.",
    "  For MLB the curated get_player_props tool is faster than SQL for \"what do we like today\".",
    "",
    "Rules: exactly ONE SELECT (or WITH…SELECT) statement, no semicolons, no writes. This tool is for",
    "ANALYSIS, not export: results cap at 100 rows and 20 columns (wide SELECT * is rejected — project",
    "the specific columns you need), ~200KB per response, and each user has a query budget (60/hour).",
    "The right shape is: aggregate in SQL for the headline number, then a second small query for",
    "10–20 example games that illustrate it. 12-second timeout: filter by season or team on big",
    "tables. Dates are Eastern Time. MLB team abbreviations use AZ (not ARI) and ATH (not OAK). When",
    "quoting hit rates, always include the sample size, and never invent columns — check",
    "get_sports_schema first.",
  ].join("\n"),
  scope: "user",
  inputSchema: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description:
          "One read-only SQL SELECT/WITH statement. Example: SELECT season, count(*) n, round(avg(rl_covered)::numeric,3) cover_rate FROM mlb_analysis_base WHERE is_favorite AND closing_runline > 0 GROUP BY 1 ORDER BY 1",
      },
    },
    required: ["sql"],
  },
  annotations: readOnly("Query the sports database (SQL)"),
  async execute(input, ctx) {
    const sql = asString(input.sql).trim();
    if (!sql) throw new Error("sql is required");
    if (!ctx.userId) throw new Error("Sign in required for SQL exploration");
    const cfb = requireService(ctx);
    const { data, error } = await cfb.rpc("mcp_run_sql", { p_sql: sql, p_user_id: ctx.userId });
    if (error) throw new Error(`Query failed: ${error.message}`);
    const rows = Array.isArray(data) ? data : [];
    return {
      rows,
      row_count: rows.length,
      truncated: rows.length >= 100,
      note:
        rows.length >= 100
          ? "Hit the 100-row cap — this tool returns aggregates and example games, not full datasets. Use GROUP BY / count / avg for the headline number."
          : undefined,
    };
  },
};

export const getSportsSchema: Tool = {
  name: "get_sports_schema",
  title: "Sports database schema catalog",
  description:
    "List every queryable table in the sports warehouse with its columns, types, row estimates, and " +
    "comments. Call this before writing SQL for query_sports_database — never guess table or column " +
    "names. Tables are readable snapshots; treat *_analysis_base tables as one row per team per game.",
  scope: "user",
  inputSchema: {
    type: "object",
    properties: {
      table_filter: {
        type: "string",
        description:
          "Optional case-insensitive substring to filter table names (e.g. 'mlb', 'odds', 'nfl_predictions').",
      },
    },
  },
  annotations: readOnly("Sports database schema catalog"),
  async execute(input, ctx) {
    const cfb = requireService(ctx);
    const { data, error } = await cfb.rpc("mcp_schema_catalog", {});
    if (error) throw new Error(`Catalog failed: ${error.message}`);
    let tables = Array.isArray(data) ? (data as Array<{ table?: string }>) : [];
    const filter = asString(input.table_filter).trim().toLowerCase();
    if (filter) {
      tables = tables.filter((t) => String(t.table ?? "").toLowerCase().includes(filter));
    }
    return { tables, table_count: tables.length };
  },
};

export const sqlExplorationTools: Tool[] = [querySportsDatabase, getSportsSchema];
