// The connector's mini system prompt, returned at `initialize`. It tells the
// assistant what WagerProof is and when to reach for each tool, and — load-
// bearing for gambling-policy fit — frames everything as read-only ANALYTICS,
// not betting advice or wagering facilitation.

export const INSTRUCTIONS = `WagerProof is a sports-analytics platform that runs machine-learning models over NFL, NBA, College Football, College Basketball, and MLB games and compares those model outputs to market prices. This connector gives read-only access to (1) the signed-in user's own WagerProof data — their AI prediction agents, those agents' historical picks and win-loss records, the agents they follow, and their community activity — and (2) public WagerProof model outputs: per-game model predictions, prediction-market (Polymarket) odds, and published editor analyses.

Use the list_my_* / get_my_* tools for anything about the user's own agents, their performance, or their tracked record. Use get_sport_predictions, get_game_detail, search_games, and get_market_odds for model outputs and odds on upcoming games. Start with search_games when the user names a team without a league.

This connector is READ-ONLY and informational. It reports model probabilities, historical performance, and market prices for analysis and research. It does not place bets, does not facilitate gambling, and does not give betting advice or guarantee outcomes. Sports outcomes are uncertain. Present model numbers as model estimates, attribute odds to their source, and note when data is unavailable rather than inventing it.`;

/**
 * `serverInfo` for `initialize`. Built per-request because the MCP schema types
 * `Icon.src` as `@format uri` — a bare "/icon.png" is a relative reference, not a
 * URI, and a client has no obligation to resolve it against the endpoint it
 * dialed. Absolute means the icon renders wherever the connector is listed.
 */
export function serverInfo(baseUrl: string) {
  // A configured MCP_BASE_URL with a trailing slash would yield "host//icon.png".
  const base = baseUrl.replace(/\/+$/, "");
  return {
    name: "WagerProof",
    title: "WagerProof",
    version: "0.1.0",
    websiteUrl: base,
    icons: [{ src: `${base}/icon.png`, mimeType: "image/png", sizes: ["256x256"] }],
  };
}
