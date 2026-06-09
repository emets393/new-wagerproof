// present_components — V2 chat ONLY. Renders the model's analysis as rich,
// TAPPABLE components that mirror the app's real list items / widgets (game
// cards, mini game-detail widgets, agent/editor/tool cards). Emits
// `wagerbot.app_components`; each component carries a `nav` descriptor so the
// iOS client can open the real destination on tap.
//
// Game-linked components are built server-side from the game cards stored in
// blocks by the prediction tools (reusing widgetDataBuilder), with the model's
// optional `fields` merged on top. Entity components (tool/editor/agent/prop)
// take the model's `fields` + the ids needed to navigate.

import type { ToolDefinition } from "./registry.ts";
import {
  buildModelProjectionData,
  buildPolymarketData,
  buildBettingTrendsData,
  buildInjuryData,
  buildWeatherData,
  buildPublicBettingData,
} from "./widgetDataBuilder.ts";

const GAME_LINKED = new Set([
  "game",
  "value",
  "model_projection",
  "polymarket",
  "betting_trends",
  "model_accuracy",
  "injury",
  "weather",
  "public_betting",
]);

// Tool/report banners — title/subtitle/icon by ToolRouter category id.
const TOOL_CATALOG: Record<string, { title: string; subtitle: string; icon: string }> = {
  mlbTrends: { title: "MLB Betting Trends", subtitle: "ATS & O/U situational trends", icon: "chart.bar.fill" },
  mlbRegression: { title: "MLB Regression Report", subtitle: "Model regression candidates", icon: "waveform.path.ecg" },
  mlbPitcherMatchups: { title: "Player Prop Matchups", subtitle: "Pitcher vs lineup edges", icon: "baseball.fill" },
  mlbF5Splits: { title: "MLB F5 Splits", subtitle: "First-5-innings model splits", icon: "5.circle.fill" },
  nbaTrends: { title: "NBA Betting Trends", subtitle: "ATS & O/U trends", icon: "chart.bar.fill" },
  nbaAccuracy: { title: "NBA Model Accuracy", subtitle: "Historical accuracy buckets", icon: "scope" },
  ncaabTrends: { title: "NCAAB Betting Trends", subtitle: "ATS & O/U trends", icon: "chart.bar.fill" },
  ncaabAccuracy: { title: "NCAAB Model Accuracy", subtitle: "Historical accuracy buckets", icon: "scope" },
};

function fmtSpread(v: unknown): string {
  if (v == null) return "";
  const n = Number(v);
  return n > 0 ? `+${n}` : String(n);
}
function pctStr(v: unknown): string | null {
  if (v == null) return null;
  let n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n <= 1) n = n * 100;
  return `${Math.round(n)}%`;
}
function toPct(v: unknown): number | null {
  if (v == null) return null;
  let n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n <= 1) n = n * 100;
  return Math.round(n);
}

interface ComponentSpec {
  type: string;
  game_id?: string;
  sport?: string;
  agent_id?: string;
  prop_id?: string;
  tool_category?: string;
  pick?: string;
  analysis?: string;
  fields?: Record<string, unknown>;
}

export const tool: ToolDefinition = {
  name: "present_components",
  description:
    "REQUIRED to present results visually in V2 chat. Render your answer as rich, TAPPABLE " +
    "components that mirror the real app — game cards, mini widgets, agent/editor/tool cards. " +
    "Call this AFTER fetching data, instead of writing the analysis as markdown. For game-linked " +
    "components (game, value, model_projection, polymarket, betting_trends, injury, weather, " +
    "public_betting, model_accuracy) pass the game_id + sport and the server fills the data; you " +
    "may add a `fields` object to override/extend. For entity components (tool, editor_pick, agent, " +
    "agent_pick, prop) pass the relevant id (tool_category / agent_id / prop_id) and a `fields` " +
    "object built from the tool results. Then call suggest_follow_ups LAST.",
  parameters: {
    type: "object",
    properties: {
      summary: { type: "string", description: "1-2 sentence overview shown above the components." },
      components: {
        type: "array",
        description: "Ordered list of components to render (aim for the 3-6 most useful).",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "game", "value", "model_projection", "polymarket", "betting_trends",
                "model_accuracy", "injury", "weather", "public_betting",
                "prop", "agent", "agent_pick", "editor_pick", "tool",
              ],
              description: "Component kind.",
            },
            game_id: { type: "string", description: "For game-linked components — must match the prediction data." },
            sport: { type: "string", enum: ["nfl", "nba", "cfb", "ncaab", "mlb"] },
            agent_id: { type: "string", description: "For agent / agent_pick components." },
            prop_id: { type: "string", description: "For prop components." },
            tool_category: {
              type: "string",
              description: "For tool components — one of: mlbTrends, mlbRegression, mlbPitcherMatchups, mlbF5Splits, nbaTrends, nbaAccuracy, ncaabTrends, ncaabAccuracy.",
            },
            pick: { type: "string", description: "Optional human pick label, e.g. 'Lakers -3.5 (-110)'." },
            analysis: { type: "string", description: "Optional 1-2 sentence analysis for this component." },
            fields: {
              type: "object",
              description: "Display fields for this component (required for entity components; optional override for game components).",
              additionalProperties: true,
            },
          },
          required: ["type"],
        },
      },
    },
    required: ["summary", "components"],
  },
  async execute(input: { summary: string; components: ComponentSpec[] }, ctx) {
    const specs = Array.isArray(input?.components) ? input.components : [];

    // Pull stored game cards from blocks (added by prediction tools) +
    // attach polymarket like present_analysis does.
    const blocks = ctx.getBlocks();
    const cardMap = new Map<string, any>();
    for (const block of blocks) {
      if (block.type === "game_cards" && Array.isArray(block.cards)) {
        for (const card of block.cards) cardMap.set(String(card.game_id).trim(), card);
      }
    }
    for (const block of blocks) {
      if (block.type === "tool_result" && typeof block.content === "string") {
        try {
          const parsed = JSON.parse(block.content);
          if (parsed?.games && Array.isArray(parsed.games)) {
            for (const g of parsed.games) {
              const key = (g.game_key || "").toLowerCase();
              const markets = g.markets || [];
              for (const [, card] of cardMap.entries()) {
                const awayName = (card.away_team || "").toLowerCase();
                const homeName = (card.home_team || "").toLowerCase();
                if (!awayName || !homeName) continue;
                if (key.includes(awayName) && key.includes(homeName)) {
                  const mlMarket = markets.find((m: any) =>
                    m.market_type === "moneyline" ||
                    (m.question?.toLowerCase().includes("win") && !m.question?.toLowerCase().includes("o/u"))
                  );
                  const mkt = mlMarket || markets[0];
                  if (mkt) card._polymarket = { away_yes_price: mkt.outcome_yes, home_yes_price: mkt.outcome_no };
                }
              }
            }
          }
        } catch { /* not polymarket */ }
      }
    }

    const out: any[] = [];
    let idx = 0;

    for (const spec of specs) {
      const type = String(spec.type || "").trim();
      if (!type) continue;
      const id = `${type}_${spec.game_id || spec.agent_id || spec.tool_category || idx++}`;
      const modelFields = (spec.fields && typeof spec.fields === "object") ? spec.fields : {};

      // Entity components — model supplies fields; server attaches nav.
      if (!GAME_LINKED.has(type)) {
        let fields: Record<string, unknown> = { ...modelFields };
        let nav: any = { kind: "none" };
        if (type === "tool") {
          const cat = String(spec.tool_category || "");
          const meta = TOOL_CATALOG[cat];
          fields = { title: meta?.title ?? modelFields.title ?? "Open tool", subtitle: meta?.subtitle ?? modelFields.subtitle, icon: meta?.icon ?? modelFields.icon, ...modelFields };
          nav = { kind: "tool", tool_category: cat };
        } else if (type === "editor_pick") {
          nav = { kind: "editor_picks" };
        } else if (type === "agent" || type === "agent_pick") {
          nav = { kind: type, agent_id: spec.agent_id };
        } else if (type === "prop") {
          nav = { kind: "prop", prop_id: spec.prop_id };
        }
        if (spec.analysis) fields.analysis = fields.analysis ?? spec.analysis;
        out.push({ type, id, nav, fields });
        continue;
      }

      // Game-linked components — build fields from the card + builders.
      const gameId = String(spec.game_id || "").trim();
      const card = cardMap.get(gameId);
      if (!card) continue;
      const sport = spec.sport || card.sport || "nba";
      const matchup = `${card.away_abbr ?? card.away_team} @ ${card.home_abbr ?? card.home_team}`;
      let fields: Record<string, unknown> = {};

      switch (type) {
        case "game":
        case "value": {
          fields = {
            sport,
            away_abbr: card.away_abbr,
            home_abbr: card.home_abbr,
            away_team: card.away_team,
            home_team: card.home_team,
            game_time: card.game_time,
            spread: card.home_spread != null ? `${card.home_abbr ?? card.home_team} ${fmtSpread(card.home_spread)}` : null,
            total: card.over_under != null ? String(card.over_under) : null,
            spread_edge: card.spread_edge,
            pick: spec.pick ?? card.spread_pick ?? null,
          };
          break;
        }
        case "model_projection": {
          const d = buildModelProjectionData(card);
          fields = {
            matchup,
            predicted_score: (card.raw_game?.predicted_away_score != null && card.raw_game?.predicted_home_score != null)
              ? `${card.raw_game.predicted_away_score}-${card.raw_game.predicted_home_score}` : null,
            model_fair_spread: d.model_fair_spread,
            model_fair_total: d.model_fair_total,
            spread_edge: d.spread_edge,
            total_edge: d.total_edge,
          };
          break;
        }
        case "polymarket": {
          const d = buildPolymarketData(card);
          fields = {
            away_abbr: card.away_abbr,
            home_abbr: card.home_abbr,
            away_implied: toPct(d.away_yes_price),
            home_implied: toPct(d.home_yes_price),
            model_prob: toPct(card.ml_prob),
          };
          break;
        }
        case "betting_trends": {
          const d = buildBettingTrendsData(card);
          const rows = [
            { label: `${card.away_abbr} ATS`, value: pctStr(d.away_ats_pct) },
            { label: `${card.home_abbr} ATS`, value: pctStr(d.home_ats_pct) },
            { label: `${card.away_abbr} Over%`, value: pctStr(d.away_over_pct) },
            { label: `${card.home_abbr} Over%`, value: pctStr(d.home_over_pct) },
          ].filter((r) => r.value != null);
          fields = { matchup, rows };
          break;
        }
        case "injury": {
          const d = buildInjuryData(card) as any;
          const toRows = (arr: any[], abbr: string) =>
            (Array.isArray(arr) ? arr : []).map((i: any) => ({
              name: i.player ?? i.name ?? "", team: abbr, status: i.status ?? "",
            }));
          fields = {
            matchup,
            players: [...toRows(d.away_injuries, card.away_abbr), ...toRows(d.home_injuries, card.home_abbr)],
          };
          break;
        }
        case "weather": {
          const d = buildWeatherData(card);
          fields = {
            matchup,
            temperature: d.temperature, wind_speed: d.wind_speed,
            precipitation: d.precipitation, sky: d.sky,
          };
          break;
        }
        case "public_betting": {
          const d = buildPublicBettingData(card) as any;
          const splits = [
            { label: "Spread", value: d.spread_splits_label },
            { label: "Moneyline", value: d.ml_splits_label },
            { label: "Total", value: d.total_splits_label },
          ].filter((s) => s.value != null);
          fields = { matchup, splits };
          break;
        }
        case "model_accuracy": {
          // Server can't reliably extract per-sport accuracy buckets — rely on
          // the model's supplied fields (record / win_pct / roi_pct / bet_type).
          fields = { matchup };
          break;
        }
      }

      if (spec.analysis) fields.analysis = spec.analysis;
      // Model-supplied fields override/extend the server-built ones.
      fields = { ...fields, ...modelFields };

      out.push({
        type,
        id,
        nav: { kind: type === "value" ? "value" : "game", sport, game_id: gameId },
        fields,
        raw_game: card.raw_game || {},
      });
    }

    const summary = String(input?.summary || "").trim();
    ctx.emit("wagerbot.app_components", { summary, components: out });
    // Returned so the agent loop persists an `app_components` block.
    return { ok: true, app_components: out, summary, count: out.length };
  },
};
