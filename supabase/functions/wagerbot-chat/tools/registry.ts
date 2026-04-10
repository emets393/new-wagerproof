// Tool registry for WagerBot chat. Each tool is a self-contained module
// exporting a `tool` that conforms to `ToolDefinition`. To add a new tool:
//
//   1. Create a file under tools/<name>.ts that exports `tool`.
//   2. Import + register it below in ALL_TOOLS.
//   3. The agent loop calls `runTool` and never knows about individual
//      tool implementations.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { tool as getNbaPredictions } from "./get_nba_predictions.ts";
import { tool as getNflPredictions } from "./get_nfl_predictions.ts";
import { tool as getCfbPredictions } from "./get_cfb_predictions.ts";
import { tool as getNcaabPredictions } from "./get_ncaab_predictions.ts";
import { tool as getMlbPredictions } from "./get_mlb_predictions.ts";
import { tool as getPolymarketOdds } from "./get_polymarket_odds.ts";
import { tool as getGameDetail } from "./get_game_detail.ts";
import { tool as searchGames } from "./search_games.ts";
import { tool as getEditorPicks } from "./get_editor_picks.ts";
import { tool as suggestFollowUps } from "./suggest_follow_ups.ts";

export interface ToolContext {
  /** Main Supabase client (user data, Polymarket, editor picks). */
  supabase: SupabaseClient;
  /** CFB Supabase client (all sports predictions data). */
  cfbSupabase: SupabaseClient;
  /** Authenticated user id. */
  userId: string;
  /** Current chat thread id. */
  threadId: string;
  /** Emit a wagerbot.* event from inside a tool (e.g. follow_ups).
   *  The agent loop already emits tool_start/tool_end — only use this
   *  for tool-specific signals. */
  emit: (event: string, data: unknown) => void;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for OpenAI function calling parameters. */
  parameters: Record<string, unknown>;
  execute: (input: any, ctx: ToolContext) => Promise<unknown>;
}

const ALL_TOOLS: Record<string, ToolDefinition> = {
  [getNbaPredictions.name]: getNbaPredictions,
  [getNflPredictions.name]: getNflPredictions,
  [getCfbPredictions.name]: getCfbPredictions,
  [getNcaabPredictions.name]: getNcaabPredictions,
  [getMlbPredictions.name]: getMlbPredictions,
  [getPolymarketOdds.name]: getPolymarketOdds,
  [getGameDetail.name]: getGameDetail,
  [searchGames.name]: searchGames,
  [getEditorPicks.name]: getEditorPicks,
  [suggestFollowUps.name]: suggestFollowUps,
};

/** Get all tool definitions for the agent config. */
export function getAllTools(): ToolDefinition[] {
  return Object.values(ALL_TOOLS);
}

/** Execute a tool by name. Throws if unknown — the agent loop converts
 *  errors into error tool result messages. */
export async function runTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  const t = ALL_TOOLS[name];
  if (!t) throw new Error(`Unknown tool: ${name}`);
  return await t.execute(input ?? {}, ctx);
}
