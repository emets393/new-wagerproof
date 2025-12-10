/**
 * WagerBot Proactive Suggestion Service
 *
 * Fetches AI-generated betting suggestions for different pages and game details.
 * Sends raw JSON data to the BuildShip API which handles prompt selection,
 * data formatting, and sport-specific guidance server-side.
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

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type PageType = 'feed' | 'picks' | 'outliers' | 'scoreboard';
export type Sport = 'nfl' | 'cfb' | 'nba' | 'ncaab';
export type GameData = NFLPrediction | CFBPrediction | NBAGame | NCAABGame;

export interface SuggestionResponse {
  suggestion: string;
  gameId: string | null;
  success: boolean;
}

// Polymarket data structure
export interface PolymarketMarketData {
  awayTeam: string;
  homeTeam: string;
  currentAwayOdds: number;
  currentHomeOdds: number;
  volume?: number;
  marketId?: string;
  marketType: 'moneyline' | 'spread' | 'total';
  data?: Array<{
    timestamp: number;
    awayTeamOdds: number;
    homeTeamOdds: number;
  }>;
}

export interface GamePolymarketData {
  moneyline?: PolymarketMarketData;
  spread?: PolymarketMarketData;
  total?: PolymarketMarketData;
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

// ============================================================================
// API CONFIGURATION
// ============================================================================

const ENDPOINT = 'https://xna68l.buildship.run/wager-bot-mobile-gpt-copy-d5038d059f0c';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
 * Convert Map to plain object for JSON serialization
 */
function mapToObject<V>(map: Map<string, V> | undefined): Record<string, V> | undefined {
  if (!map) return undefined;
  const obj: Record<string, V> = {};
  map.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

/**
 * Prepare game data with Polymarket for API request
 */
function prepareGamesWithPolymarket(
  games: GameData[],
  polymarketData?: Map<string, GamePolymarketData>
): any[] {
  return games.map(game => {
    const gameId = (game as any).training_key || (game as any).id || (game as any).unique_id;
    const polymarket = polymarketData?.get(gameId);
    return {
      ...game,
      polymarket,
    };
  });
}

/**
 * Make an API request with the new payload structure
 */
async function makeApiRequest(
  pageType: string,
  sport: Sport | undefined,
  data: any,
  previousInsight?: string,
  previousInsights?: string[],
  previouslySentSuggestions?: string[]
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const payload = {
      pageType,
      sport,
      data,
      previousInsight,
      previousInsights,
      previouslySentSuggestions,
    };

    console.log(`🤖 API Request: pageType=${pageType}, sport=${sport || 'none'}, dataKeys=${Object.keys(data).join(',')}`);

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

// ============================================================================
// MAIN SERVICE
// ============================================================================

export const wagerBotSuggestionService = {
  /**
   * Scan the current page - sends raw data to API for server-side formatting
   * This is the main entry point for the "Scan this page" feature
   */
  async scanPage(
    pageType: PageType,
    data: PageScanData,
    previouslySentSuggestions?: string[]
  ): Promise<SuggestionResponse> {
    console.log(`🤖 Scanning ${pageType} page...`);

    let apiData: any;
    let sport: Sport | undefined;

    // Prepare data based on page type
    switch (pageType) {
      case 'feed': {
        const feedData = data as FeedScanData;
        if (!feedData.games || feedData.games.length === 0) {
          console.log(`🤖 No games available for feed scan`);
          return { suggestion: 'No games available to analyze.', gameId: null, success: false };
        }
        sport = feedData.sport;
        apiData = {
          games: prepareGamesWithPolymarket(feedData.games, feedData.polymarketData),
        };
        break;
      }

      case 'picks': {
        const picksData = data as PicksScanData;
        if (!picksData.picks || picksData.picks.length === 0) {
          console.log(`🤖 No picks available for scan`);
          return { suggestion: 'No editor picks available to analyze.', gameId: null, success: false };
        }
        apiData = { picks: picksData.picks };
        break;
      }

      case 'outliers': {
        const outliersData = data as OutliersScanData;
        if ((!outliersData.valueAlerts || outliersData.valueAlerts.length === 0) &&
            (!outliersData.fadeAlerts || outliersData.fadeAlerts.length === 0)) {
          console.log(`🤖 No outliers available for scan`);
          return { suggestion: 'No outliers or value alerts found at this time.', gameId: null, success: false };
        }
        apiData = {
          valueAlerts: outliersData.valueAlerts || [],
          fadeAlerts: outliersData.fadeAlerts || [],
        };
        break;
      }

      case 'scoreboard': {
        const scoreboardData = data as ScoreboardScanData;
        if (!scoreboardData.liveGames || scoreboardData.liveGames.length === 0) {
          console.log(`🤖 No live games available for scan`);
          return { suggestion: 'No live games at this time.', gameId: null, success: false };
        }
        apiData = { liveGames: scoreboardData.liveGames };
        break;
      }

      default:
        return { suggestion: 'Unknown page type.', gameId: null, success: false };
    }

    console.log(`🤖 Sending ${pageType} scan request...`);

    const text = await makeApiRequest(pageType, sport, apiData, undefined, undefined, previouslySentSuggestions);

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
  async getSuggestion(
    sport: Sport,
    games: GameData[],
    polymarketData?: Map<string, GamePolymarketData>,
    previouslySentSuggestions?: string[]
  ): Promise<SuggestionResponse> {
    return this.scanPage('feed', { games, sport, polymarketData }, previouslySentSuggestions);
  },

  /**
   * Get an insight for a specific game (floating assistant on game details page)
   * Sends raw game data + Polymarket to API for server-side processing
   */
  async getGameInsight(
    game: GameData,
    sport: Sport,
    polymarket?: GamePolymarketData,
    previouslySentSuggestions?: string[]
  ): Promise<SuggestionResponse> {
    console.log(`🤖 Fetching insight for ${game.away_team} @ ${game.home_team}...`);

    const apiData = {
      game: {
        ...game,
        polymarket,
      },
    };

    const text = await makeApiRequest('game_insight', sport, apiData, undefined, undefined, previouslySentSuggestions);

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
   * Sends raw game data + previous insight to API
   */
  async getMoreDetails(
    game: GameData,
    sport: Sport,
    previousInsight: string,
    polymarket?: GamePolymarketData,
    previouslySentSuggestions?: string[]
  ): Promise<SuggestionResponse> {
    console.log(`🤖 Fetching more details on: "${previousInsight.substring(0, 50)}..."`);

    const apiData = {
      game: {
        ...game,
        polymarket,
      },
    };

    const text = await makeApiRequest('more_details', sport, apiData, previousInsight, undefined, previouslySentSuggestions);

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
   * Sends raw game data + list of previous insights to API
   */
  async getAlternativeInsight(
    game: GameData,
    sport: Sport,
    previousInsights: string[],
    polymarket?: GamePolymarketData,
    previouslySentSuggestions?: string[]
  ): Promise<SuggestionResponse> {
    console.log(`🤖 Fetching alternative insight (${previousInsights.length} previous)...`);

    const apiData = {
      game: {
        ...game,
        polymarket,
      },
    };

    const text = await makeApiRequest('alternative', sport, apiData, undefined, previousInsights, previouslySentSuggestions);

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
