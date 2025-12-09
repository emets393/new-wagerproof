/**
 * WagerBot Proactive Suggestion Service
 *
 * Fetches AI-generated betting suggestions for different pages and game details.
 * Uses a dedicated BuildShip endpoint with page-specific system prompts
 * optimized for short, actionable insights.
 *
 * Supports:
 * - Feed page suggestions (multiple games with Polymarket data)
 * - Picks page analysis (editor picks performance)
 * - Outliers page insights (value alerts and fade opportunities)
 * - Scoreboard page updates (live game tracking)
 * - Game details insights (single game focus with full Polymarket)
 * - "Tell me more" expanded analysis
 * - "Another insight" alternative angles
 */

import { NFLPrediction } from '../types/nfl';
import { CFBPrediction } from '../types/cfb';
import { NBAGame } from '../types/nba';
import { NCAABGame } from '../types/ncaab';
import {
  PAGE_PROMPTS,
  PageType,
  Sport,
  getScanPageConfig,
  getGameDetailsConfig,
  formatFeedContext,
  formatPicksContext,
  formatOutliersContext,
  formatScoreboardContext,
  formatGameDetailsContext,
  GamePolymarketData,
} from '../config/wagerBotPrompts';

export type { Sport, PageType };
export type GameData = NFLPrediction | CFBPrediction | NBAGame | NCAABGame;

export interface SuggestionResponse {
  suggestion: string;
  gameId: string | null;
  success: boolean;
}

// Data payload types for each page
export interface FeedScanData {
  games: GameData[];
  sport: Sport;
  polymarketData?: Map<string, GamePolymarketData>;
}

export interface PicksScanData {
  picks: any[];
}

export interface OutliersScanData {
  valueAlerts: any[];
  fadeAlerts: any[];
}

export interface ScoreboardScanData {
  liveGames: any[];
}

export type PageScanData = FeedScanData | PicksScanData | OutliersScanData | ScoreboardScanData;

const ENDPOINT = 'https://xna68l.buildship.run/wager-bot-mobile-gpt-copy-d5038d059f0c';

/**
 * Parse the AI response to extract suggestion text and game ID
 */
function parseResponse(text: string): { suggestion: string; gameId: string | null } {
  // Try to extract game ID from [GAME_ID:xxx] format
  const gameIdMatch = text.match(/\[GAME_ID:([^\]]+)\]/i);
  const gameId = gameIdMatch?.[1]?.trim() || null;

  // Remove the game ID tag from the suggestion text
  const suggestion = text
    .replace(/\[GAME_ID:[^\]]+\]/gi, '')
    .trim();

  return { suggestion, gameId };
}

/**
 * Make an API request with error handling
 */
async function makeApiRequest(
  message: string,
  systemPrompt: string,
  conversationHistory: string[] = []
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        SystemPrompt: systemPrompt,
        conversationHistory,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`🤖 API error: ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('🤖 Request timed out');
    } else {
      console.error('🤖 API error:', error);
    }
    return null;
  }
}

// System prompt for single game insight (floating assistant mode)
const GAME_INSIGHT_PROMPT = `You are WagerBot, the AI betting assistant floating alongside the user as they browse game details. Your job is to highlight the MOST compelling insight about this specific game.

CRITICAL RULES:
1. Keep your response to 2-3 sentences MAXIMUM
2. Focus on the SINGLE most interesting data point or edge
3. Be conversational and insightful, like a pro bettor sharing a tip
4. Reference specific numbers (spreads, probabilities, trends)
5. If Polymarket data is available, highlight any significant divergence from Vegas
6. Don't include game IDs - just the insight

EXAMPLE RESPONSES:
"The model sees 62% value on this spread, but public money is heavily the other way at 70%. Classic contrarian spot!"
"Interesting edge here - Polymarket has Ravens at 58% while Vegas implies only 52%. The prediction market sees value on Baltimore."
"Weather alert: 15 mph winds could impact the passing game. Might want to lean under on this one."`;

// System prompt for "Tell me more" expanded analysis
const MORE_DETAILS_PROMPT = `You are WagerBot providing deeper analysis on a betting insight. The user wants MORE DETAIL on your previous observation.

CRITICAL RULES:
1. Expand with 2-3 additional supporting data points
2. Keep it to 3-4 sentences max
3. Reference specific stats, trends, or situational factors
4. If Polymarket data is available, discuss line movement trends
5. Maintain your conversational tone
6. Connect the dots - explain WHY this matters for betting`;

// System prompt for "Another insight" alternative angle
const ALTERNATIVE_INSIGHT_PROMPT = `You are WagerBot providing a DIFFERENT betting angle on this game. The user has already seen some insights and wants a fresh perspective.

CRITICAL RULES:
1. Focus on a DIFFERENT aspect (if they saw spread, talk O/U or props)
2. Keep it to 2-3 sentences max
3. Don't repeat information from previous insights
4. Consider Polymarket vs Vegas divergence if not already discussed
5. Offer genuine contrarian or overlooked angles
6. Be conversational and insightful`;

export const wagerBotSuggestionService = {
  /**
   * Scan the current page with page-specific prompts and data formatting
   * This is the main entry point for the "Scan this page" feature
   */
  async scanPage(pageType: PageType, data: PageScanData): Promise<SuggestionResponse> {
    console.log(`🤖 Scanning ${pageType} page...`);

    const config = getScanPageConfig(pageType);

    if (!config.prompt.scanEnabled) {
      console.log(`🤖 Scanning disabled for ${pageType} page`);
      return { suggestion: 'Scanning not available for this page.', gameId: null, success: false };
    }

    // Format the data using the page-specific formatter
    const formattedContext = config.formatContext(data);

    if (formattedContext.includes('No ') && formattedContext.includes('available')) {
      console.log(`🤖 No data available for ${pageType} page scan`);
      return { suggestion: formattedContext, gameId: null, success: false };
    }

    // Combine system prompt with formatted context
    const fullPrompt = `${config.prompt.systemPrompt}${formattedContext}`;

    console.log(`🤖 Sending ${pageType} scan request with ${formattedContext.length} chars of context`);

    const text = await makeApiRequest(
      `Analyze this ${pageType} page and give me your best insight.`,
      fullPrompt
    );

    if (!text) {
      return { suggestion: '', gameId: null, success: false };
    }

    const { suggestion, gameId } = parseResponse(text);

    console.log(`🤖 ${pageType} scan result: "${suggestion.substring(0, 80)}..."`);

    return {
      suggestion: suggestion || text.trim(),
      gameId,
      success: true,
    };
  },

  /**
   * Legacy method for backward compatibility - wraps scanPage for feed
   * @deprecated Use scanPage('feed', data) instead
   */
  async getSuggestion(sport: Sport, games: GameData[], polymarketData?: Map<string, GamePolymarketData>): Promise<SuggestionResponse> {
    return this.scanPage('feed', { games, sport, polymarketData });
  },

  /**
   * Get an insight for a specific game (floating assistant on game details page)
   * Includes full Polymarket data analysis
   */
  async getGameInsight(
    game: GameData,
    sport: Sport,
    polymarket?: GamePolymarketData
  ): Promise<SuggestionResponse> {
    console.log(`🤖 Fetching insight for ${game.away_team} @ ${game.home_team}...`);

    // Use the new formatter that includes Polymarket
    const gameContext = formatGameDetailsContext(game, sport, polymarket);
    const fullPrompt = `${GAME_INSIGHT_PROMPT}\n\n${gameContext}`;

    const text = await makeApiRequest(
      'Give me the most compelling insight about this game.',
      fullPrompt
    );

    if (!text) {
      return { suggestion: '', gameId: null, success: false };
    }

    console.log(`🤖 Game insight: ${text.substring(0, 100)}...`);

    return {
      suggestion: text.trim(),
      gameId: String((game as any).id || (game as any).unique_id || (game as any).training_key),
      success: true,
    };
  },

  /**
   * Get expanded details on a previous insight ("Tell me more")
   */
  async getMoreDetails(
    game: GameData,
    sport: Sport,
    previousInsight: string,
    polymarket?: GamePolymarketData
  ): Promise<SuggestionResponse> {
    console.log(`🤖 Fetching more details on: "${previousInsight.substring(0, 50)}..."`);

    const gameContext = formatGameDetailsContext(game, sport, polymarket);
    const fullPrompt = `${MORE_DETAILS_PROMPT}\n\n${gameContext}\n\nPrevious insight: "${previousInsight}"`;

    const text = await makeApiRequest(
      'Tell me more about this insight. Expand with additional supporting data.',
      fullPrompt
    );

    if (!text) {
      return { suggestion: '', gameId: null, success: false };
    }

    console.log(`🤖 More details: ${text.substring(0, 100)}...`);

    return {
      suggestion: text.trim(),
      gameId: String((game as any).id || (game as any).unique_id || (game as any).training_key),
      success: true,
    };
  },

  /**
   * Get an alternative insight angle ("Another insight")
   */
  async getAlternativeInsight(
    game: GameData,
    sport: Sport,
    previousInsights: string[],
    polymarket?: GamePolymarketData
  ): Promise<SuggestionResponse> {
    console.log(`🤖 Fetching alternative insight (${previousInsights.length} previous)...`);

    const gameContext = formatGameDetailsContext(game, sport, polymarket);
    const previousContext = previousInsights.length > 0
      ? `\n\nPrevious insights already covered:\n${previousInsights.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`
      : '';
    const fullPrompt = `${ALTERNATIVE_INSIGHT_PROMPT}\n\n${gameContext}${previousContext}`;

    const text = await makeApiRequest(
      'Give me a different betting angle for this game.',
      fullPrompt
    );

    if (!text) {
      return { suggestion: '', gameId: null, success: false };
    }

    console.log(`🤖 Alternative insight: ${text.substring(0, 100)}...`);

    return {
      suggestion: text.trim(),
      gameId: String((game as any).id || (game as any).unique_id || (game as any).training_key),
      success: true,
    };
  },
};
