// V3 read tools — projections over the cached formatted games (no DB query) +
// two query tools (editor picks, props). The terminal write tool (submit_picks)
// lives in submitPicks.ts and is routed by the loop, not here.

import { compactDeepFetch } from "../compactDeepFetch";
import type { ToolDef } from "../types";
import type { SteeringProfile } from "../deriveSteeringProfile";
import { type AgentGenContext, markGrounded, recordFacts, type Sport } from "./context";

// A grounds:"all" deep fetch makes the game bettable on every market it surfaces.
// team_total rides the same lines/model groups (vegas_lines.team_totals +
// model_predictions.team_totals), so any grounds:"all" tool grounds it too —
// notably get_team_totals, get_market_odds, get_game_data. (h1 bets need no extra
// entry: they reuse spread/moneyline/total, which are grounded here; the submit
// gate keys on bet_type, not period.) team_total markets only exist for NFL/CFB,
// where these tools fire — other sports never carry a team-total line to stake.
const ALL_BET_TYPES = ["spread", "moneyline", "total", "team_total"];

interface DeepToolDef {
  groups: string[]; // formatted-game keys this tool projects (first present wins per group)
  sports: Sport[];
  grounds: "all" | "none"; // 'all' → game becomes bettable for any bet type
  desc: string;
  /** Optional: project only this nested sub-key of each group (e.g. "first_half"
   *  inside vegas_lines/model_predictions). Lets one period get its own focused tool. */
  subkey?: string;
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
  get_line_movement: { groups: ["line_movement", "opening_lines"], sports: ["nfl", "cfb"], grounds: "none", desc: "Line-movement history (open → close, snapshots where available)." },
  get_public_betting: { groups: ["public_betting", "public_betting_detailed"], sports: ["nfl", "cfb"], grounds: "none", desc: "Public money/ticket splits." },
  get_weather: { groups: ["weather"], sports: ["nfl", "cfb", "mlb"], grounds: "none", desc: "Game-time weather." },
  get_team_ratings: { groups: ["team_stats"], sports: ["nba", "ncaab"], grounds: "none", desc: "Adjusted off/def/pace ratings (+ rankings for NCAAB)." },
  get_recent_form: { groups: ["trends", "team_stats"], sports: ["nba"], grounds: "none", desc: "Recent form / L3-L5 trends." },
  get_ats_trends: { groups: ["trends"], sports: ["nba", "ncaab"], grounds: "none", desc: "ATS and O/U trend percentages." },
  get_injuries: { groups: ["injuries"], sports: ["nba", "nfl"], grounds: "none", desc: "Injury report with player impact. For NFL: each team's injury digest (QB status, starters out, severity score, key-position counts) plus the notable Out/Doubtful/Questionable players." },
  get_situational_trends: { groups: ["situational_trends"], sports: ["nba", "ncaab"], grounds: "none", desc: "Situational splits for the matchup." },
  get_h2h_history: { groups: ["h2h_recent"], sports: ["nfl"], grounds: "none", desc: "Recent head-to-head results." },
  get_prediction_accuracy: { groups: ["prediction_accuracy", "accuracy_signals"], sports: ["nfl", "cfb", "nba", "ncaab", "mlb"], grounds: "none", desc: "Historical model accuracy buckets for this matchup." },
  get_mlb_perfect_storm: { groups: ["perfect_storm", "accuracy_signals"], sports: ["mlb"], grounds: "all", desc: "Perfect Storm tiers + per-bet-type accuracy buckets (DOW/team/edge)." },
  get_mlb_statcast_signals: { groups: ["signals"], sports: ["mlb"], grounds: "none", desc: "Statcast / pitcher / bullpen signal messages." },
  get_polymarket: { groups: ["polymarket"], sports: ["nfl", "cfb", "nba", "ncaab", "mlb"], grounds: "none", desc: "Polymarket prediction-market prices." },
  // get_props is dispatched by name (runProps) so it can populate
  // ctx.bettableProps, but it lives in DEEP_TOOLS so it's advertised + sport-gated
  // + budgeted like the other deep fetches. grounds:"all" → bettable props ground.
  get_props: { groups: ["props"], sports: ["nfl"], grounds: "all", desc: "Signal-backed player props (only props with a validated signal are bettable) with L3/L5/L10 form." },

  // ── NFL/CFB-specific tools (our dryrun model output + validated signals) ──
  get_signals: { groups: ["signals"], sports: ["nfl", "cfb"], grounds: "all", desc: "Validated betting signals firing on this game — each with its stance (the side/market it triggers) + tier. These are our proven high-ROI SPOT triggers, not just model output; a firing signal makes the game bettable on its side. Each signal carries TWO distinct records (do not conflate): all_time = the validated backtest record (validated_hit + one_liner/why_it_works/bet_direction), and season_to_date = this season's live record so far (sample/record/hit_rate/roi, may be null early in the season). IMPORTANT: signals with tier 'tracking' / conviction 'track' (marked ⚠ TRACKING ONLY) are paper-traded to build a live record and are NOT validated for betting — treat them as informational context only, never as a reason to place a bet." },
  get_conviction: { groups: ["conviction"], sports: ["nfl", "cfb"], grounds: "none", desc: "Our conviction read for the game: conviction tier, stake units, and the mammoth flag (the 3-unit, highest-confidence plays where the model + signals align)." },
  get_full_game: { groups: ["vegas_lines", "model_predictions"], subkey: "full_game", sports: ["nfl", "cfb"], grounds: "all", desc: "Full-game model + lines: spread cover prob, predicted margin/total, spread + total edges, predicted scores, and the model's pick + tier." },
  get_first_half: { groups: ["vegas_lines", "model_predictions"], subkey: "first_half", sports: ["nfl", "cfb"], grounds: "all", desc: "First-half (1H) model + 1H lines: 1H predicted margin/total, 1H edges, cover-tilt, and 1H picks. (Our vaulted 1H model.)" },
  get_team_totals: { groups: ["vegas_lines", "model_predictions"], subkey: "team_totals", sports: ["nfl", "cfb"], grounds: "all", desc: "Team-totals model + lines: each team's predicted points, the TT edges + picks, and over/under prices." },
};

/** Tools the loop should charge against the deep-fetch budget.
 *  get_prop_player_page is player-keyed (not a cached-game projection) so it
 *  lives outside DEEP_TOOLS, but it hits the DB per call → budget it like one. */
export const DEEP_TOOL_NAMES = new Set([...Object.keys(DEEP_TOOLS), "get_prop_player_page"]);

function projectGroups(fg: Record<string, unknown>, groups: string[], subkey?: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const g of groups) {
    const v = fg[g];
    if (v == null) continue;
    out[g] = subkey ? ((v as Record<string, unknown>)[subkey] ?? null) : v;
  }
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
  if (name === "get_props") return runProps(args, ctx);
  if (name === "get_prop_player_page") return runPropPlayerPage(args, ctx);

  const def = DEEP_TOOLS[name];
  if (!def) return { content: JSON.stringify({ error: `unknown tool: ${name}` }), ok: false, summary: "unknown tool" };

  const gameIds = Array.isArray(args.game_ids) ? args.game_ids.map(String) : [];
  if (gameIds.length === 0) return { content: JSON.stringify({ error: "game_ids is required (from the slate)" }), ok: false, summary: "no game_ids" };

  const results: Record<string, unknown>[] = [];
  for (const id of gameIds) {
    const loaded = ctx.games.get(id);
    if (!loaded) { results.push({ game_id: id, error: "not_in_slate" }); continue; }
    if (!def.sports.includes(loaded.sport)) { results.push({ game_id: id, applicable: false, note: `${name} not available for ${loaded.sport}` }); continue; }
    const data = projectGroups(loaded.fg, def.groups, def.subkey);
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

/** Build the bettable-prop ledger key. MUST stay byte-identical to the key the
 *  submit tool checks and to the format documented in context.ts:
 *  `${player_name.toLowerCase()}::${market}::${line}` (line = close_line). */
export function propKey(playerName: unknown, market: unknown, line: unknown): string {
  return `${String(playerName ?? "").toLowerCase()}::${String(market ?? "")}::${String(line ?? "")}`;
}

/** get_props — project each game's `props` array and register every bettable
 *  prop (is_bettable === true) in ctx.bettableProps so the submit tool can gate
 *  prop bets. Mirrors the generic deep-tool loop (slate/sport checks, grounding,
 *  recordFacts) since get_props can't go through projectGroups + the ledger pop
 *  in one pass. NFL-only (DEEP_TOOLS.get_props.sports). */
function runProps(args: Record<string, unknown>, ctx: AgentGenContext): ReadToolResult {
  const def = DEEP_TOOLS.get_props;
  const gameIds = Array.isArray(args.game_ids) ? args.game_ids.map(String) : [];
  if (gameIds.length === 0) return { content: JSON.stringify({ error: "game_ids is required (from the slate)" }), ok: false, summary: "no game_ids" };

  const results: Record<string, unknown>[] = [];
  for (const id of gameIds) {
    const loaded = ctx.games.get(id);
    if (!loaded) { results.push({ game_id: id, error: "not_in_slate" }); continue; }
    if (!def.sports.includes(loaded.sport)) { results.push({ game_id: id, applicable: false, note: `get_props not available for ${loaded.sport}` }); continue; }

    const props = Array.isArray(loaded.fg.props) ? (loaded.fg.props as Record<string, unknown>[]) : [];
    // Return ONLY signal-backed (bettable) props. A game carries 70+ props but only a handful
    // are flagged; returning all of them lets compaction (MAX_ARRAY=12) silently drop the flagged
    // ones (incl. the volume markets) before the model sees them. The tool IS "signal-backed
    // props," and submit gates on bettable anyway, so surface exactly those.
    const bettableProps = props.filter((p) => p.is_bettable === true);
    results.push({ game_id: id, matchup: loaded.fg.matchup,
      n_props_total: props.length, n_signal_props: bettableProps.length, props: bettableProps });
    recordFacts(ctx, id, { props: bettableProps });

    // Register bettable props (signal-backed) so submit can gate prop bets.
    let bettable = ctx.bettableProps.get(id);
    for (const p of bettableProps) {
      if (!bettable) { bettable = new Set<string>(); ctx.bettableProps.set(id, bettable); }
      bettable.add(propKey(p.player_name, p.market, p.line));
    }
    // grounds:"all" — a deep prop fetch grounds the game for any bet type.
    for (const bt of ALL_BET_TYPES) markGrounded(ctx, id, bt);
  }

  return {
    content: compactDeepFetch("get_props", { tool: "get_props", games: results }),
    ok: true,
    summary: `get_props: ${results.length} game(s)`,
  };
}

/** get_prop_player_page — deep dive on an NFL player from nfl_prop_player_pages
 *  (the prop-model page contract on the CFB instance; anon-readable). Serves the
 *  player's prop markets, baseline, advanced stats, scheme-matchup layer, and the
 *  prop MODEL projection bands. Informational only (grounds nothing): bettable
 *  props are still gated exclusively by get_props' is_bettable ledger.
 *  The scheme jsonb's children are hoisted onto the player object and players are
 *  keyed by name at the root — compactDeepFetch prunes objects at depth 5, and the
 *  nested layout would gut player_splits/defense before the model saw them. */
async function runPropPlayerPage(args: Record<string, unknown>, ctx: AgentGenContext): Promise<ReadToolResult> {
  const names = Array.isArray(args.player_names)
    ? args.player_names.map((n) => String(n).trim()).filter(Boolean).slice(0, 5)
    : [];
  if (names.length === 0) {
    return { content: JSON.stringify({ error: "player_names is required (1-5 names as they appear in get_props)" }), ok: false, summary: "no player_names" };
  }

  const players: Record<string, unknown> = {};
  for (const name of names) {
    try {
      const { data, error } = await ctx.cfb
        .from("nfl_prop_player_pages")
        .select("player_name, position, team, opponent, game_label, rookie, markets, baseline, ngs, scheme, projection")
        .ilike("player_name", `%${name}%`)
        .order("season", { ascending: false })
        .order("week", { ascending: false })
        .limit(6);
      if (error) { players[name] = { error: error.message }; continue; }
      const rows = (data ?? []) as Record<string, unknown>[];
      if (rows.length === 0) { players[name] = { error: "not_found — use the exact player_name from get_props" }; continue; }
      const exact = rows.find((r) => String(r.player_name).toLowerCase() === name.toLowerCase());
      const distinct = new Set(rows.map((r) => String(r.player_name)));
      if (!exact && distinct.size > 1) {
        players[name] = { ambiguous: [...distinct].slice(0, 5) };
        continue;
      }
      const row = exact ?? rows[0];
      const scheme = (row.scheme ?? {}) as Record<string, unknown>;
      players[String(row.player_name)] = {
        position: row.position, team: row.team, opponent: row.opponent,
        game: row.game_label, rookie: row.rookie === true ? true : undefined,
        markets: row.markets, baseline: row.baseline, advanced_stats: row.ngs,
        // scheme layer, hoisted (see depth note above)
        opp_defense_identity: scheme.identity ?? (scheme.defense as Record<string, unknown> | undefined)?.identity ?? null,
        opp_defense_rates: (scheme.defense as Record<string, unknown> | undefined) ?? null,
        matchup_look_focus: scheme.look_focus ?? null,
        player_overall: scheme.player_overall ?? null,
        player_vs_look_splits: scheme.player_splits ?? null,
        model_projection: row.projection ?? null,
      };
    } catch (e) {
      players[name] = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  const payload = {
    tool: "get_prop_player_page",
    note: "model_projection bands are PREVIEW (first live season) — use as context, not as a validated edge. markets with status 'pending' have no posted line yet. Only props returned by get_props are bettable.",
    players,
  };
  // Multi-player payloads overflow the default 4000-char compaction target and
  // would collapse to the top-level summary — scale the target per player.
  return {
    content: compactDeepFetch("get_prop_player_page", payload, 3000 + 2500 * names.length),
    ok: true,
    summary: `prop pages: ${Object.keys(players).length} player(s)`,
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

  // Player-keyed (not game-keyed) so it can't ride the DEEP_TOOLS loop above.
  if (sports.has("nfl")) {
    defs.push({
      type: "function",
      function: {
        name: "get_prop_player_page",
        description: "Deep dive on NFL prop players (sports: nfl): per-market prop lines, per-game baselines, advanced stats (NGS/charting with league percentiles), the opponent-defense scheme identity + the player's splits vs those looks (man/zone, one-high/two-high, box counts, pressure), and our prop MODEL's projection band per market (preview status this season). Use AFTER get_props to research the players you're considering — this tool is context only and does not make a prop bettable.",
        parameters: {
          type: "object",
          properties: {
            player_names: { type: "array", items: { type: "string" }, description: "1-5 player names, exactly as they appear in get_props results." },
          },
          required: ["player_names"],
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
