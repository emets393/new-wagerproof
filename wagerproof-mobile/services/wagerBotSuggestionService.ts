/**
 * WagerBot Proactive Suggestion Service
 *
 * Fetches AI-generated betting suggestions for the Feed page and game details.
 * Uses a dedicated BuildShip endpoint with custom system prompts
 * optimized for short, actionable insights.
 *
 * Supports:
 * - Feed page suggestions (multiple games)
 * - Game details insights (single game focus)
 * - "Tell me more" expanded analysis
 * - "Another insight" alternative angles
 */

import { NFLPrediction } from '../types/nfl';
import { CFBPrediction } from '../types/cfb';
import { NBAGame } from '../types/nba';
import { NCAABGame } from '../types/ncaab';

export type Sport = 'nfl' | 'cfb' | 'nba' | 'ncaab';
export type GameData = NFLPrediction | CFBPrediction | NBAGame | NCAABGame;

export interface SuggestionResponse {
  suggestion: string;
  gameId: string | null;
  success: boolean;
}

const ENDPOINT = 'https://xna68l.buildship.run/wager-bot-mobile-gpt-copy-d5038d059f0c';

const SYSTEM_PROMPT = `You are WagerBot, the AI betting assistant for WagerProof. Your job is to provide ONE short, actionable betting suggestion based on today's games.

CRITICAL RULES:
1. Keep your response to 1-2 sentences MAXIMUM
2. Mention a SPECIFIC game by team names (e.g., "Chiefs vs Ravens")
3. Highlight ONE specific betting angle: spread, over/under, or moneyline
4. Be conversational, confident, and engaging
5. Include brief reasoning (e.g., "both defenses struggling" or "model sees value")
6. You MUST include the game's ID at the end in this exact format: [GAME_ID:xxx]

EXAMPLE RESPONSES:
"The Chiefs-Ravens game has solid value on the over 47.5 - both offenses are clicking lately! [GAME_ID:123]"
"Atlanta's spread at +7 looks generous, their defense has been underrated this season. [GAME_ID:456]"
"I like the Celtics moneyline tonight - they're 8-2 in their last 10 home games. [GAME_ID:789]"

Pick the game with the BEST value based on the model probabilities vs the betting lines. Look for edges where the model probability differs significantly from implied odds.`;

/**
 * Format game data into a compact context string for the AI
 */
function formatGameContext(games: GameData[], sport: Sport): string {
  const sportLabel = sport.toUpperCase();

  const gamesContext = games.slice(0, 15).map((game) => {
    const away = game.away_team;
    const home = game.home_team;
    const id = game.id || game.unique_id || game.training_key || `${away}_${home}`;

    // Get spread info
    const homeSpread = game.home_spread ?? 'N/A';
    const spreadProb = game.home_away_spread_cover_prob
      ? `${(game.home_away_spread_cover_prob * 100).toFixed(0)}%`
      : 'N/A';

    // Get O/U info
    const overLine = game.over_line ?? 'N/A';
    const ouProb = game.ou_result_prob
      ? `${(game.ou_result_prob * 100).toFixed(0)}%`
      : 'N/A';

    // Get ML info
    const mlProb = game.home_away_ml_prob
      ? `${(game.home_away_ml_prob * 100).toFixed(0)}%`
      : 'N/A';

    return `[${id}] ${away} @ ${home}: Spread ${homeSpread} (model: ${spreadProb}), O/U ${overLine} (over prob: ${ouProb}), Home ML prob: ${mlProb}`;
  }).join('\n');

  return `Today's ${sportLabel} Games:\n${gamesContext}\n\nAnalyze these games and give me ONE suggestion for the best value bet.`;
}

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

// System prompt for single game insight (floating assistant mode)
const GAME_INSIGHT_PROMPT = `You are WagerBot, the AI betting assistant floating alongside the user as they browse game details. Your job is to highlight the MOST compelling insight about this specific game.

CRITICAL RULES:
1. Keep your response to 2-3 sentences MAXIMUM
2. Focus on the SINGLE most interesting data point or edge
3. Be conversational and insightful, like a pro bettor sharing a tip
4. Reference specific numbers (spreads, probabilities, trends)
5. Don't include game IDs - just the insight

EXAMPLE RESPONSES:
"The model sees 62% value on this spread, but public money is heavily the other way at 70%. Classic contrarian spot!"
"This over/under is interesting - both teams' pace metrics suggest a high-scoring affair, yet 58% of bets are on the under."
"Weather alert: 15 mph winds could impact the passing game. Might want to lean under on this one."`;

// System prompt for "Tell me more" expanded analysis
const MORE_DETAILS_PROMPT = `You are WagerBot providing deeper analysis on a betting insight. The user wants MORE DETAIL on your previous observation.

CRITICAL RULES:
1. Expand with 2-3 additional supporting data points
2. Keep it to 3-4 sentences max
3. Reference specific stats, trends, or situational factors
4. Maintain your conversational tone
5. Connect the dots - explain WHY this matters for betting`;

// System prompt for "Another insight" alternative angle
const ALTERNATIVE_INSIGHT_PROMPT = `You are WagerBot providing a DIFFERENT betting angle on this game. The user has already seen some insights and wants a fresh perspective.

CRITICAL RULES:
1. Focus on a DIFFERENT aspect (if they saw spread, talk O/U or props)
2. Keep it to 2-3 sentences max
3. Don't repeat information from previous insights
4. Offer genuine contrarian or overlooked angles
5. Be conversational and insightful`;

/**
 * Format a single game's data for detailed AI analysis
 */
function formatSingleGameContext(game: GameData, sport: Sport): string {
  const away = game.away_team;
  const home = game.home_team;

  // Basic lines
  const homeSpread = game.home_spread ?? 'N/A';
  const awaySpread = game.away_spread ?? 'N/A';
  const overLine = game.over_line ?? 'N/A';
  const homeMl = game.home_ml ?? 'N/A';
  const awayMl = game.away_ml ?? 'N/A';

  // Model probabilities
  const spreadProb = game.home_away_spread_cover_prob
    ? `${(game.home_away_spread_cover_prob * 100).toFixed(0)}%`
    : 'N/A';
  const ouProb = game.ou_result_prob
    ? `${(game.ou_result_prob * 100).toFixed(0)}%`
    : 'N/A';
  const mlProb = game.home_away_ml_prob
    ? `${(game.home_away_ml_prob * 100).toFixed(0)}%`
    : 'N/A';

  // Public betting splits (if available)
  const spreadSplits = (game as any).spread_splits_label || 'N/A';
  const totalSplits = (game as any).total_splits_label || 'N/A';
  const mlSplits = (game as any).ml_splits_label || 'N/A';

  // Weather (if available)
  const weather = (game as any).temperature
    ? `${(game as any).temperature}°F, Wind: ${(game as any).wind_speed || 0} mph`
    : 'Indoor/N/A';

  return `${sport.toUpperCase()} Game: ${away} @ ${home}

BETTING LINES:
- Home Spread: ${homeSpread} | Away Spread: ${awaySpread}
- Over/Under: ${overLine}
- Home ML: ${homeMl} | Away ML: ${awayMl}

MODEL PROBABILITIES:
- Spread Cover (Home): ${spreadProb}
- Over Probability: ${ouProb}
- Home ML Probability: ${mlProb}

PUBLIC BETTING SPLITS:
- Spread: ${spreadSplits}
- Total: ${totalSplits}
- Moneyline: ${mlSplits}

WEATHER: ${weather}

Analyze this game and provide your most compelling insight.`;
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

export const wagerBotSuggestionService = {
  /**
   * Fetch a proactive suggestion for the given sport and games (Feed page)
   */
  async getSuggestion(sport: Sport, games: GameData[]): Promise<SuggestionResponse> {
    if (games.length === 0) {
      console.log('🤖 No games available for suggestions');
      return { suggestion: '', gameId: null, success: false };
    }

    const gameContext = formatGameContext(games, sport);

    const requestBody = {
      message: 'Give me a proactive betting suggestion for one of today\'s games.',
      SystemPrompt: `${SYSTEM_PROMPT}\n\n${gameContext}`,
      conversationHistory: [],
    };

    console.log(`🤖 Fetching ${sport.toUpperCase()} suggestion for ${games.length} games...`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`🤖 Suggestion API error: ${response.status}`);
        return { suggestion: '', gameId: null, success: false };
      }

      const text = await response.text();
      console.log(`🤖 Raw suggestion response: ${text.substring(0, 100)}...`);

      const { suggestion, gameId } = parseResponse(text);

      if (!suggestion) {
        console.error('🤖 Empty suggestion received');
        return { suggestion: '', gameId: null, success: false };
      }

      console.log(`🤖 Parsed suggestion: "${suggestion}" for game: ${gameId}`);

      return {
        suggestion,
        gameId,
        success: true,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('🤖 Suggestion request timed out');
      } else {
        console.error('🤖 Suggestion API error:', error);
      }
      return { suggestion: '', gameId: null, success: false };
    }
  },

  /**
   * Get an insight for a specific game (floating assistant on game details page)
   */
  async getGameInsight(game: GameData, sport: Sport): Promise<SuggestionResponse> {
    console.log(`🤖 Fetching insight for ${game.away_team} @ ${game.home_team}...`);

    const gameContext = formatSingleGameContext(game, sport);
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
    previousInsight: string
  ): Promise<SuggestionResponse> {
    console.log(`🤖 Fetching more details on: "${previousInsight.substring(0, 50)}..."`);

    const gameContext = formatSingleGameContext(game, sport);
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
    previousInsights: string[]
  ): Promise<SuggestionResponse> {
    console.log(`🤖 Fetching alternative insight (${previousInsights.length} previous)...`);

    const gameContext = formatSingleGameContext(game, sport);
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
