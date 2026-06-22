// V3 read tools — projections over the cached formatted games (no DB query) +
// two query tools (editor picks, props). The terminal write tool (submit_picks)
// lives in submitPicks.ts and is routed by the loop, not here.

import { compactDeepFetch } from "../compactDeepFetch.ts";
import type { ToolDef } from "../types.ts";
import type { SteeringProfile } from "../deriveSteeringProfile.ts";
import { type AgentGenContext, markGrounded, recordFacts, type Sport } from "./context.ts";

const ALL_BET_TYPES = ["spread", "moneyline", "total"];

interface DeepToolDef {
  groups: string[]; // formatted-game keys this tool projects (first present wins per group)
  sports: Sport[];
  grounds: "all" | "none"; // 'all' → game becomes bettable for any bet type
  desc: string;
}

/** Deep projection tools. Each returns the named group(s) from the cached game.
 *  NFL/CFB and MLB/NBA/NCAAB all share the same group keys (vegas_lines,
 *  model_predictions, h2h_recent, …); the rewritten NFL/CFB builder adds
 *  conviction/signals/props on top. projectGroups only emits keys present on the
 *  cached game, so a group listed for a sport that lacks it is simply skipped. */
const DEEP_TOOLS: Record<string, DeepToolDef> = {
  get_game_data: { groups: ["vegas_lines", "model_predictions", "conviction", "signals", "props", "weather", "public_betting", "team_stats", "trends", "injuries", "situational_trends", "prediction_accuracy", "accuracy_signals", "perfect_storm", "starting_pitchers", "h2h_recent", "line_movement", "polymarket"], sports: ["nfl", "cfb", "nba", "ncaab", "mlb"], grounds: "all", desc: "Full data for a game: lines, model, conviction, signals, and all available context." },
  get_model_predictions: { groups: ["model_predictions", "prediction_accuracy", "accuracy_signals"], sports: ["nfl", "cfb", "nba", "ncaab", "mlb"], grounds: "all", desc: "Model win/cover/total probabilities and edges." },
  get_market_odds: { groups: ["vegas_lines"], sports: ["nfl", "cfb", "nba", "ncaab", "mlb"], grounds: "all", desc: "Vegas lines / odds (NFL/CFB incl. team-total + 1H markets; MLB incl. F5 + runline)." },
  get_signals: { groups: ["signals", "conviction"], sports: ["nfl", "cfb"], grounds: "none", desc: "Validated betting signals (action/stance/tier + live hit-rate & ROI record) and the game's conviction tier." },
  get_line_movement: { groups: ["line_movement", "opening_lines"], sports: ["nfl", "cfb"], grounds: "none", desc: "Line-movement history (open → close, snapshots where available)." },
  get_public_betting: { groups: ["public_betting", "public_betting_detailed"], sports: ["nfl", "cfb"], grounds: "none", desc: "Public money/ticket splits." },
  get_weather: { groups: ["weather"], sports: ["nfl", "cfb", "mlb"], grounds: "none", desc: "Game-time weather." },
  get_team_ratings: { groups: ["team_stats"], sports: ["nba", "ncaab"], grounds: "none", desc: "Adjusted off/def/pace ratings (+ rankings for NCAAB)." },
  get_recent_form: { groups: ["trends", "team_stats"], sports: ["nba"], grounds: "none", desc: "Recent form / L3-L5 trends." },
  get_ats_trends: { groups: ["trends"], sports: ["nba", "ncaab", "nfl", "cfb"], grounds: "none", desc: "ATS and O/U trend percentages." },
  get_injuries: { groups: ["injuries"], sports: ["nba"], grounds: "none", desc: "Injury report with player impact." },
  get_situational_trends: { groups: ["situational_trends"], sports: ["nba", "ncaab"], grounds: "none", desc: "Situational splits for the matchup." },
  get_h2h_history: { groups: ["h2h_recent"], sports: ["nfl"], grounds: "none", desc: "Recent head-to-head results." },
  get_prediction_accuracy: { groups: ["prediction_accuracy", "accuracy_signals"], sports: ["nfl", "cfb", "nba", "ncaab", "mlb"], grounds: "none", desc: "Historical model accuracy buckets for this matchup." },
  get_mlb_perfect_storm: { groups: ["perfect_storm", "accuracy_signals"], sports: ["mlb"], grounds: "all", desc: "Perfect Storm tiers + per-bet-type accuracy buckets (DOW/team/edge)." },
  get_mlb_statcast_signals: { groups: ["signals"], sports: ["mlb"], grounds: "none", desc: "Statcast / pitcher / bullpen signal messages." },
  get_props: { groups: ["props"], sports: ["nfl"], grounds: "none", desc: "Player-prop matchups with L3/L5/L10 form and any validated prop signals (read-only context — props are not bettable in V3)." },
  get_polymarket: { groups: ["polymarket"], sports: ["nfl", "cfb", "nba", "ncaab", "mlb"], grounds: "none", desc: "Polymarket prediction-market prices." },
};

/** Tools the loop should charge against the deep-fetch budget. */
export const DEEP_TOOL_NAMES = new Set(Object.keys(DEEP_TOOLS));

function projectGroups(fg: Record<string, unknown>, groups: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const g of groups) if (fg[g] != null) out[g] = fg[g];
  return out;
}

export interface ReadToolResult {
  content: string;
  ok: boolean;
  summary: string;
}

/** Execute a read/query tool. Mutates ctx ledger (grounding + facts). */
export async function runReadTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentGenContext,
): Promise<ReadToolResult> {
  if (name === "get_editor_picks") return runEditorPicks(args, ctx);

  const def = DEEP_TOOLS[name];
  if (!def) return { content: JSON.stringify({ error: `unknown tool: ${name}` }), ok: false, summary: "unknown tool" };

  const gameIds = Array.isArray(args.game_ids) ? args.game_ids.map(String) : [];
  if (gameIds.length === 0) return { content: JSON.stringify({ error: "game_ids is required (from the slate)" }), ok: false, summary: "no game_ids" };

  const results: Record<string, unknown>[] = [];
  for (const id of gameIds) {
    const loaded = ctx.games.get(id);
    if (!loaded) { results.push({ game_id: id, error: "not_in_slate" }); continue; }
    if (!def.sports.includes(loaded.sport)) { results.push({ game_id: id, applicable: false, note: `${name} not available for ${loaded.sport}` }); continue; }
    const data = projectGroups(loaded.fg, def.groups);
    results.push({ game_id: id, matchup: loaded.fg.matchup, ...data });
    recordFacts(ctx, id, data);
    if (def.grounds === "all") for (const bt of ALL_BET_TYPES) markGrounded(ctx, id, bt);
  }

  return {
    content: compactDeepFetch(name, { tool: name, games: results }),
    ok: true,
    summary: `${name}: ${results.length} game(s)`,
  };
}

async function runEditorPicks(args: Record<string, unknown>, ctx: AgentGenContext): Promise<ReadToolResult> {
  try {
    let q = ctx.main.from("editors_picks").select("game_type, game_id, selected_bet_type, bet_type, pick_value, best_price, sportsbook, editors_notes, result").eq("is_published", true).order("created_at", { ascending: false }).limit(20);
    const sport = typeof args.sport === "string" ? args.sport : undefined;
    if (sport) q = q.eq("game_type", sport);
    const { data, error } = await q;
    if (error) return { content: JSON.stringify({ error: error.message }), ok: false, summary: "editor picks failed" };
    return { content: compactDeepFetch("get_editor_picks", { picks: data ?? [] }), ok: true, summary: `editor picks: ${(data ?? []).length}` };
  } catch (e) {
    return { content: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), ok: false, summary: "editor picks error" };
  }
}

/** Build the read-tool definitions the model sees, restricted to applicable
 *  sports and ordered by steering tool affinity (preferred tools first). */
export function buildReadToolDefs(steering: SteeringProfile): ToolDef[] {
  const sports = new Set(steering.preferredSports as Sport[]);
  const defs: ToolDef[] = [];

  const order = (name: string): number => {
    const a = steering.toolAffinity[name];
    return a === "+" ? 0 : a === "-" ? 2 : 1;
  };

  const applicable = Object.entries(DEEP_TOOLS)
    .filter(([, d]) => d.sports.some((s) => sports.has(s)))
    .sort((a, b) => order(a[0]) - order(b[0]));

  for (const [name, d] of applicable) {
    defs.push({
      type: "function",
      function: {
        name,
        description: `${d.desc} (sports: ${d.sports.filter((s) => sports.has(s)).join(", ")}).`,
        parameters: {
          type: "object",
          properties: {
            game_ids: { type: "array", items: { type: "string" }, description: "game_ids from the slate (verbatim)." },
          },
          required: ["game_ids"],
        },
      },
    });
  }

  defs.push({
    type: "function",
    function: {
      name: "get_editor_picks",
      description: "Published editor/expert picks with graded results (context only).",
      parameters: { type: "object", properties: { sport: { type: "string" } } },
    },
  });

  return defs;
}
