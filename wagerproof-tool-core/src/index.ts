// @wagerproof/tool-core — shared, runtime-agnostic WagerProof MCP tool
// definitions + data access. See types.ts for the abstraction; registry.ts for
// the tool set. Hosts (the MCP connector, the chat loop, agent generation)
// import from here and build their own per-call ToolContext.

export * from "./types.js";
export { getTodayInET, getDateInET } from "./date.js";
export {
  sportsTools,
  userTools,
  buildTools,
  indexByName,
  type RegistryOptions,
} from "./registry.js";

// Individual tools (handy for surfaces that want to compose a custom set).
export { getSportPredictions } from "./tools/sports/getSportPredictions.js";
export { getGameDetail } from "./tools/sports/getGameDetail.js";
export { searchGames } from "./tools/sports/searchGames.js";
export { getMarketOdds } from "./tools/sports/getMarketOdds.js";
export { getEditorPicks } from "./tools/sports/getEditorPicks.js";
export {
  listMyAgents,
  getAgentPerformance,
  listMyAgentPicks,
  listMyFollows,
  agentTools,
} from "./tools/user/agents.js";
export {
  getMyCommunityActivity,
  getMyRecord,
  communityTools,
} from "./tools/user/community.js";
