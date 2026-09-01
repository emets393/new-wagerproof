// get_player_props — WagerProof's ranked MLB player-prop board, plus the book
// lines behind it and the tier/market track record.
//
// Why a curated tool when query_sports_database can already reach these tables:
// an assistant only looks for what the tool surface advertises. Before this
// existed, nothing in the connector mentioned props, so "what props do you like
// today" got answered as "I don't have that data" — the tables were reachable
// but undiscoverable. See wagerproof-mcp/src/instructions.ts.
//
// Reads the CFB/warehouse project via the anon client: mlb_player_prop_picks,
// mlb_player_prop_grades and mlb_player_props are all RLS-public reads.

import {
  readOnly,
  asOptString,
  asOptNumber,
  type Tool,
  type ToolContext,
} from "../../types.js";

/** One entry of `mlb_player_prop_picks.rationale` (jsonb array). */
interface RationaleItem {
  label?: unknown;
  points?: unknown;
}

interface PickRow {
  report_date?: string;
  player_name?: string;
  team_name?: string;
  market?: string;
  market_label?: string;
  side?: string;
  line?: number;
  over_odds?: number;
  under_odds?: number;
  tier?: string;
  kind?: string;
  score?: number;
  l10_over?: number;
  l10_games?: number;
  l10_pct?: number;
  game_label?: string;
  game_time?: string;
  rationale?: RationaleItem[] | null;
}

interface LineRow {
  player_name?: string;
  market?: string;
  line?: number;
  over_odds?: number;
  under_odds?: number;
  bookmaker?: string;
  is_pitcher?: boolean;
  home_team?: string;
  away_team?: string;
}

const PICK_COLUMNS =
  "report_date,player_name,team_name,market,market_label,side,line,over_odds," +
  "under_odds,tier,kind,score,l10_over,l10_games,l10_pct,game_label,game_time,rationale";

/** PostgREST parses `or=(col.op.val,col.op.val)` positionally, so a comma,
 *  paren or quote in a user-supplied value rewrites the filter instead of being
 *  matched literally. Strip the syntax characters before interpolating. */
function safeFilterValue(v: string): string {
  return v.replace(/[,()"*\\]/g, " ").trim();
}

/** The scoring reasons, flattened to readable strings. The raw jsonb is
 *  {label, points} pairs; the points are internal ranker weights and mean
 *  nothing outside it, so only the labels cross the wire. */
function reasons(raw: RationaleItem[] | null | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => (typeof r?.label === "string" ? r.label : ""))
    .filter((s) => s.length > 0)
    .slice(0, 6);
}

function shapePick(p: PickRow) {
  // The board picks a side, so quote the price for THAT side. Returning both
  // prices invites the assistant to quote the wrong one.
  const price = p.side === "under" ? p.under_odds : p.over_odds;
  return {
    player: p.player_name,
    team: p.team_name,
    game: p.game_label,
    game_time: p.game_time,
    market: p.market_label ?? p.market,
    market_key: p.market,
    pick: `${p.side === "under" ? "Under" : "Over"} ${p.line}`,
    odds: price,
    tier: p.tier,
    score: p.score,
    last_10:
      p.l10_games != null && p.l10_over != null
        ? `${p.l10_over}/${p.l10_games} (${p.l10_pct}%)`
        : undefined,
    reasons: reasons(p.rationale),
  };
}

export const getPlayerProps: Tool = {
  name: "get_player_props",
  title: "Get player-prop board",
  scope: "global",
  annotations: readOnly("Get player-prop board"),
  description: [
    "WagerProof's ranked MLB player-prop board for a date: which player props the model",
    "flags, which side, the book line and price, a strong/lean tier, a 0-100 score, the",
    "player's last-10 hit rate, and the reasons the ranker fired (recent xwOBA and barrel",
    "trends, day/night and handedness splits, opposing-pitcher archetype).",
    "",
    "Markets covered: hits, total bases, H+R+RBI, RBIs, runs, home runs, batter walks,",
    "batter strikeouts, pitcher strikeouts, hits allowed. Filter with `market` using either",
    "the key (batter_hits, batter_total_bases, batter_hits_runs_rbis, pitcher_strikeouts)",
    "or the label (Hits, Total Bases, H+R+RBI, Pitcher K).",
    "",
    "Also returns `track_record` — settled win rate, units and ROI for the matching",
    "tier/market, so a pick is never quoted without its historical base rate. Pass `player`",
    "to focus one hitter or pitcher; if that player has no ranked pick, the current book",
    "lines for them are returned instead so the question is still answerable.",
    "",
    "Prop LINES for players the board didn't rank live in the `mlb_player_props` table via",
    "query_sports_database. These are model estimates and historical results for analysis,",
    "not betting advice.",
  ].join("\n"),
  inputSchema: {
    type: "object",
    properties: {
      sport: {
        type: "string",
        enum: ["mlb"],
        description: "League. Only MLB has a ranked prop board today.",
      },
      date: {
        type: "string",
        description: "Date in YYYY-MM-DD (Eastern Time). Defaults to today.",
      },
      player: {
        type: "string",
        description: "Optional player-name filter (partial match, e.g. 'Judge').",
      },
      market: {
        type: "string",
        description:
          "Optional market filter — key or label (e.g. 'pitcher_strikeouts', 'Total Bases').",
      },
      tier: {
        type: "string",
        enum: ["strong", "lean"],
        description: "Optional tier filter. 'strong' is the higher-conviction subset.",
      },
      limit: {
        type: "number",
        description: "Max picks to return (default 25, max 100).",
      },
    },
    required: ["sport"],
    additionalProperties: false,
  },
  async execute(input, ctx: ToolContext) {
    const sport = asOptString(input.sport)?.toLowerCase();
    if (sport !== "mlb") {
      throw new Error(
        "Only `mlb` has a ranked player-prop board. NFL prop lines are in the " +
          "nfl_player_props table via query_sports_database.",
      );
    }
    const date = asOptString(input.date) ?? ctx.today();
    const rawPlayer = asOptString(input.player);
    const rawMarket = asOptString(input.market);
    const player = rawPlayer ? safeFilterValue(rawPlayer) : undefined;
    const market = rawMarket ? safeFilterValue(rawMarket) : undefined;
    const tier = asOptString(input.tier)?.toLowerCase();
    const limit = Math.min(Math.max(asOptNumber(input.limit) ?? 25, 1), 100);

    let q = ctx.cfb
      .from<PickRow>("mlb_player_prop_picks")
      .select(PICK_COLUMNS)
      .eq("report_date", date);
    if (player) q = q.ilike("player_name", `%${player}%`);
    if (tier) q = q.eq("tier", tier);
    // `market` accepts either the key or the display label, so match on both.
    if (market) q = q.or(`market.ilike.%${market}%,market_label.ilike.%${market}%`);

    const { data: picks, error } = await q
      .order("score", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Prop board query failed: ${error.message}`);

    const rows = picks ?? [];

    // Settled performance for the slice being shown. Tier/market filters carry
    // over so the base rate describes THESE picks, not the whole board.
    let tq = ctx.cfb
      .from<Record<string, unknown>>("v_mlb_player_prop_grade_summary")
      .select(
        "tier,market,market_label,kind,picks_total,picks_won,picks_lost,picks_push,win_pct,units_won,roi_pct",
      );
    if (tier) tq = tq.eq("tier", tier);
    if (market) tq = tq.or(`market.ilike.%${market}%,market_label.ilike.%${market}%`);
    const { data: record } = await tq.order("picks_total", { ascending: false }).limit(20);

    // A named player with no ranked pick is the common "is there a prop on X"
    // question. Answer it with the live board rather than an empty result.
    let lines: LineRow[] | undefined;
    if (player && rows.length === 0) {
      const { data: lineRows } = await ctx.cfb
        .from<LineRow>("mlb_player_props")
        .select(
          "player_name,market,line,over_odds,under_odds,bookmaker,is_pitcher,home_team,away_team",
        )
        .eq("official_date", date)
        .ilike("player_name", `%${player}%`)
        .limit(40);
      lines = lineRows ?? [];
    }

    return {
      sport: "mlb",
      date,
      pick_count: rows.length,
      picks: rows.map(shapePick),
      track_record: record ?? [],
      ...(lines
        ? {
            unranked_player_lines: lines,
            note:
              `No ranked prop for "${player}" on ${date} — showing the current book ` +
              `lines for them instead. The board only ranks props that clear its ` +
              `scoring threshold, so an absent player is not a negative read.`,
          }
        : {}),
      disclaimer:
        "Model estimates and historical results for analysis. Not betting advice; " +
        "past performance does not predict future results.",
    };
  },
};
