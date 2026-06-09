// present_analysis — Structures the model's game-by-game analysis into
// rich inline widget components. Pulls game cards from blocks stored by
// prediction tools, builds widget payloads per game, and emits them via SSE.

import type { ToolDefinition } from "./registry.ts";
import { buildWidgetData } from "./widgetDataBuilder.ts";

// Default widgets when model doesn't specify
const DEFAULT_WIDGETS = ["matchup", "model_projection"];

export const tool: ToolDefinition = {
  name: "present_analysis",
  description:
    "REQUIRED for game analysis. Present your picks as rich inline widgets instead of markdown. " +
    "Call this AFTER fetching predictions. Each game gets rendered as interactive cards " +
    "with team logos, odds, model projections, and your analysis text. " +
    "ONLY include the 3-5 best value games, not every game on the slate. " +
    "DO NOT write your analysis as regular text — put it ALL in this tool call. " +
    "You can optionally specify show_widgets per game to control which data visualizations appear.",
  parameters: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "1-2 sentence overview. This is the only text shown outside the widgets.",
      },
      game_analyses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            game_id: {
              type: "string",
              description: "The game_id from the prediction data. Must match exactly.",
            },
            analysis: {
              type: "string",
              description: "2-3 sentence analysis with specific numbers. Appears inside the widget.",
            },
            show_widgets: {
              type: "array",
              items: {
                type: "string",
                enum: ["matchup", "model_projection", "polymarket", "public_betting", "injuries", "betting_trends", "weather"],
              },
              description:
                "Which data widgets to show for this game. Defaults to ['matchup', 'model_projection']. " +
                "Options: matchup (team logos+odds), model_projection (model vs vegas), " +
                "polymarket (market odds), public_betting (betting splits, NFL/CFB), " +
                "injuries (key injuries, NBA), betting_trends (ATS/O-U%, NBA/NCAAB), " +
                "weather (game conditions, NFL/CFB/MLB).",
            },
          },
          required: ["game_id", "analysis"],
        },
        description: "3-5 best value games with analysis.",
      },
    },
    required: ["summary", "game_analyses"],
  },
  async execute(
    input: {
      summary: string;
      game_analyses: Array<{
        game_id: string;
        analysis: string;
        show_widgets?: string[];
      }>;
    },
    ctx,
  ) {
    const analyses = Array.isArray(input?.game_analyses) ? input.game_analyses : [];

    // Pull stored game cards from blocks (added by prediction tools)
    const blocks = ctx.getBlocks();
    const allCards: any[] = [];
    for (const block of blocks) {
      if (block.type === "game_cards" && Array.isArray(block.cards)) {
        for (const card of block.cards) allCards.push(card);
      }
    }

    // Build a game_id → card lookup
    const cardMap = new Map<string, any>();
    for (const card of allCards) {
      cardMap.set(String(card.game_id).trim(), card);
    }

    // Pull polymarket data from tool_result blocks and attach to cards
    // Polymarket game_key format: "nba_Portland Trail Blazers_Sacramento Kings"
    // Game cards have full team names (away_team, home_team) — match on those
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
                  // Prefer moneyline/win market for probabilities
                  const mlMarket = markets.find((m: any) =>
                    m.market_type === "moneyline" ||
                    (m.question?.toLowerCase().includes("win") && !m.question?.toLowerCase().includes("o/u"))
                  );
                  const mkt = mlMarket || markets[0];
                  if (mkt) {
                    card._polymarket = {
                      away_yes_price: mkt.outcome_yes,
                      home_yes_price: mkt.outcome_no,
                      volume: mkt.volume,
                    };
                  }
                }
              }
            }
          }
        } catch { /* not polymarket data */ }
      }
    }

    // Build widgets for each analyzed game
    const widgets: any[] = [];
    for (const entry of analyses) {
      const gameId = String(entry.game_id || "").trim();
      const card = cardMap.get(gameId);
      if (!card) continue;

      const widgetTypes = entry.show_widgets?.length
        ? entry.show_widgets
        : DEFAULT_WIDGETS;

      for (const wType of widgetTypes) {
        const data = buildWidgetData(wType, card);
        if (!data) continue;
        // Skip widgets that have no meaningful data
        if (wType === "polymarket" && data.away_yes_price == null && data.home_yes_price == null) continue;
        if (wType === "betting_trends" && data.away_ats_pct == null && data.home_ats_pct == null) continue;
        if (wType === "weather" && data.temperature == null && data.wind_speed == null) continue;
        if (wType === "injuries" && (!Array.isArray(data.away_injuries) || data.away_injuries.length === 0) && (!Array.isArray(data.home_injuries) || data.home_injuries.length === 0)) continue;
        if (wType === "public_betting" && data.spread_splits_label == null && data.ml_splits_label == null) continue;

        widgets.push({
          widget_type: wType,
          sport: card.sport || "nba",
          game_id: gameId,
          analysis: wType === widgetTypes[widgetTypes.length - 1] ? entry.analysis : undefined,
          data,
          raw_game: card.raw_game || {},
        });
      }
    }

    // Emit widgets to client
    ctx.emit("wagerbot.chat_widgets", { widgets });

    // Also emit game_analyses for summary text
    ctx.emit("wagerbot.game_analyses", {
      summary: String(input?.summary || "").trim(),
      analyses: analyses.map((a) => ({
        game_id: String(a.game_id).trim(),
        analysis: String(a.analysis).trim(),
      })),
    });

    return { ok: true, widget_count: widgets.length, chat_widgets: widgets };
  },
};
