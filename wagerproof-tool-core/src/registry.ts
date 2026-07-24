// Tool registry. Surfaces select the subset they expose:
//   - public MCP connector → sports (global) + user tools
//   - WagerBot chat        → sports (global) tools + its own presentation tools
//   - agent generation     → sports (global) tools only
//
// The registry itself is transport-agnostic: it only assembles Tool[]. Each host
// builds the per-call ToolContext (clients + today + userId) and dispatches.

import type { Tool } from "./types.js";

import { getSportPredictions } from "./tools/sports/getSportPredictions.js";
import { getGameDetail } from "./tools/sports/getGameDetail.js";
import { searchGames } from "./tools/sports/searchGames.js";
import { getMarketOdds } from "./tools/sports/getMarketOdds.js";
import { getEditorPicks } from "./tools/sports/getEditorPicks.js";
import { historicalTrendsTools } from "./tools/sports/historicalTrends.js";
import { agentTools } from "./tools/user/agents.js";
import { communityTools } from "./tools/user/community.js";

/** Public sports/analytics tools (global data, no user identity). */
export const sportsTools: Tool[] = [
  getSportPredictions,
  getGameDetail,
  searchGames,
  getMarketOdds,
  getEditorPicks,
  ...historicalTrendsTools,
];

/** The signed-in user's own data (RLS-scoped). */
export const userTools: Tool[] = [...agentTools, ...communityTools];

export interface RegistryOptions {
  /** Include the user's own data tools (requires a user-scoped client + userId). */
  includeUserTools?: boolean;
}

/** Assemble the tool set for a surface. */
export function buildTools(opts: RegistryOptions = {}): Tool[] {
  return opts.includeUserTools ? [...sportsTools, ...userTools] : [...sportsTools];
}

/** Index a tool list by name for O(1) dispatch. */
export function indexByName(tools: Tool[]): Map<string, Tool> {
  return new Map(tools.map((t) => [t.name, t]));
}
