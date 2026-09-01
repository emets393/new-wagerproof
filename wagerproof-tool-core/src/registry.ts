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
import { getPlayerProps } from "./tools/sports/getPlayerProps.js";
import { getEditorPicks } from "./tools/sports/getEditorPicks.js";
import { agentTools } from "./tools/user/agents.js";
import { communityTools } from "./tools/user/community.js";
import { communityAnalyticsTools } from "./tools/community/getTopCommunityAgentPicks.js";
import { sqlExplorationTools } from "./tools/sports/querySportsDatabase.js";

/** Public sports/analytics tools (global data, no user identity). */
export const sportsTools: Tool[] = [
  getSportPredictions,
  getGameDetail,
  searchGames,
  getMarketOdds,
  getPlayerProps,
  getEditorPicks,
];

/** Public analytics over WagerProof's opt-in community agents. */
export { communityAnalyticsTools };

/** The signed-in user's own data (RLS-scoped), plus signed-in-only capabilities
 *  like raw SQL exploration (global data, gated behind sign-in on purpose). */
export const userTools: Tool[] = [...agentTools, ...communityTools, ...sqlExplorationTools];

export interface RegistryOptions {
  /** Include the user's own data tools (requires a user-scoped client + userId). */
  includeUserTools?: boolean;
}

/** Assemble the tool set for a surface. */
export function buildTools(opts: RegistryOptions = {}): Tool[] {
  const globalTools = [...sportsTools, ...communityAnalyticsTools];
  return opts.includeUserTools ? [...globalTools, ...userTools] : globalTools;
}

/** Index a tool list by name for O(1) dispatch. */
export function indexByName(tools: Tool[]): Map<string, Tool> {
  return new Map(tools.map((t) => [t.name, t]));
}
