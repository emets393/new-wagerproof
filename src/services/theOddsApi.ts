/**
 * The Odds API service for fetching odds and generating betslip links
 */

import { SPORT_KEY_MAP, TOP_SPORTSBOOKS, ADDITIONAL_SPORTSBOOKS } from '@/utils/sportsbookConfig';
import { getCachedOdds, setCachedOdds, getCacheAge } from './oddsCache';

const THE_ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

// Get API key from environment variable
// Set VITE_THE_ODDS_API_KEY in Netlify environment variables or .env file
const API_KEY = import.meta.env.VITE_THE_ODDS_API_KEY;

if (!API_KEY) {
  console.warn('⚠️ VITE_THE_ODDS_API_KEY is not set. Odds features will be disabled. Please configure it in Netlify or .env file.');
}

// Request deduplication: Prevent multiple components from making the same API call simultaneously
// This is like a "loading lock" - if someone is already fetching NBA odds, others wait for that result
const activeRequests = new Map<string, Promise<OddsApiResponse>>();

export interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: Bookmaker[];
}

export interface Bookmaker {
  key: string;
  title: string;
  last_update: string;
  link?: string; // Event page link from The Odds API
  markets: Market[];
}

export interface Market {
  key: string;
  last_update: string;
  link?: string | null; // Market link (usually null)
  outcomes: Outcome[];
}

export interface Outcome {
  name: string;
  price: number;
  point?: number;
  link?: string; // Betslip link from The Odds API
}

export interface OddsApiResponse {
  events: OddsApiEvent[];
  rateLimitRemaining?: number;
  rateLimitUsed?: number;
}

/**
 * Fetch odds from The Odds API for a specific sport
 */
/**
 * Get all free US bookmaker keys (top 5 + additional)
 */
export function getAllFreeUSBookmakers(): string[] {
  return [...TOP_SPORTSBOOKS, ...ADDITIONAL_SPORTSBOOKS].map(sb => sb.key);
}

/**
 * Fetch odds from The Odds API for a specific sport
 * By default, only fetches from top 5 to conserve API quota
 */
export async function fetchOdds(
  sportKey: string,
  bookmakers: string[] = TOP_SPORTSBOOKS.map(sb => sb.key), // Default to top 5 only
  useCache: boolean = true // Use cache by default
): Promise<OddsApiResponse> {
  // Return empty response if API key is not configured
  if (!API_KEY) {
    console.warn(`⚠️ Skipping odds fetch for ${sportKey} - API key not configured`);
    return { events: [], rateLimitRemaining: undefined, rateLimitUsed: undefined };
  }

  // Check cache first
  if (useCache) {
    const cachedEvents = getCachedOdds(sportKey);
    if (cachedEvents) {
      const age = getCacheAge(sportKey);
      console.log(`✅ Using cached odds for ${sportKey} (age: ${age}s)`);
      return {
        events: cachedEvents,
        rateLimitRemaining: undefined,
        rateLimitUsed: undefined,
      };
    }
  }

  // Request deduplication: Check if another component is already fetching this sport
  // This prevents 5 picks from making 5 simultaneous API calls for the same sport
  const requestKey = `${sportKey}-${bookmakers.join(',')}`;
  const existingRequest = activeRequests.get(requestKey);
  
  if (existingRequest) {
    console.log(`⏳ Waiting for existing API request for ${sportKey}... (preventing duplicate call)`);
    return existingRequest;
  }

  const url = `${THE_ODDS_API_BASE}/sports/${sportKey}/odds`;
  const params = new URLSearchParams({
    regions: 'us',
    markets: 'h2h,spreads,totals',
    bookmakers: bookmakers.join(','),
    apiKey: API_KEY,
    includeLinks: 'true', // Include betslip links in response
  });

  // Create the request promise and store it
  const requestPromise = (async () => {
    try {
      console.log(`📡 Fetching odds from API for ${sportKey}...`);
      const response = await fetch(`${url}?${params.toString()}`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `The Odds API error (${response.status})`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error_code === 'OUT_OF_USAGE_CREDITS') {
          errorMessage = 'API quota exceeded. Please upgrade your plan or wait for quota reset.';
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        // If parsing fails, use the raw error text
        errorMessage = errorText || errorMessage;
      }
      
      const error = new Error(errorMessage);
      (error as any).statusCode = response.status;
      (error as any).isQuotaExceeded = response.status === 401;
      throw error;
    }

      const events = await response.json();
      const rateLimitRemaining = response.headers.get('x-requests-remaining');
      const rateLimitUsed = response.headers.get('x-requests-used');

      const eventsArray = Array.isArray(events) ? events : [];
      
      // Cache the results
      if (useCache && eventsArray.length > 0) {
        setCachedOdds(sportKey, eventsArray);
        console.log(`💾 Cached odds for ${sportKey} (${eventsArray.length} events)`);
      }

      return {
        events: eventsArray,
        rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : undefined,
        rateLimitUsed: rateLimitUsed ? parseInt(rateLimitUsed, 10) : undefined,
      };
    } catch (error) {
      console.error('Error fetching odds from The Odds API:', error);
      throw error;
    } finally {
      // Clean up: Remove the request from active requests after it completes (success or failure)
      activeRequests.delete(requestKey);
    }
  })();

  // Store the promise so other components can wait for it
  activeRequests.set(requestKey, requestPromise);
  
  return requestPromise;
}

/**
 * Match team names between our data and The Odds API
 */
export function matchTeamName(ourTeamName: string, apiTeamName: string): boolean {
  // Exact match (case-insensitive)
  if (ourTeamName.toLowerCase() === apiTeamName.toLowerCase()) {
    return true;
  }

  // Normalize team names
  const normalize = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/^(the )?/i, '')
      .replace(/\s+(university|college|state)$/i, '')
      .replace(/\s+(university of|college of)/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizedOur = normalize(ourTeamName);
  const normalizedApi = normalize(apiTeamName);

  // Exact match after normalization
  if (normalizedOur === normalizedApi) {
    return true;
  }

  // Check if one contains the other (for partial matches)
  if (normalizedOur.includes(normalizedApi) || normalizedApi.includes(normalizedOur)) {
    return true;
  }

  return false;
}

/**
 * Find matching event in The Odds API data
 */
export function findMatchingEvent(
  awayTeam: string,
  homeTeam: string,
  events: OddsApiEvent[]
): OddsApiEvent | null {
  for (const event of events) {
    const awayMatch = matchTeamName(awayTeam, event.away_team);
    const homeMatch = matchTeamName(homeTeam, event.home_team);

    if (awayMatch && homeMatch) {
      return event;
    }
  }

  return null;
}

/**
 * Get sport key for The Odds API from our game type
 */
export function getSportKey(gameType: string): string | null {
  return SPORT_KEY_MAP[gameType] || null;
}

/**
 * Find odds and betslip link for a specific bet in an event
 */
export function findBetOdds(
  event: OddsApiEvent,
  sportsbookKey: string,
  betType: string,
  teamName?: string,
  line?: number
): { outcome: Outcome; betslipLink: string | null } | null {
  const bookmaker = event.bookmakers?.find(bm => bm.key === sportsbookKey);
  if (!bookmaker) {
    return null;
  }

  // Map our bet types to The Odds API market keys
  const marketKeyMap: Record<string, string> = {
    'spread_away': 'spreads',
    'spread_home': 'spreads',
    'ml_away': 'h2h',
    'ml_home': 'h2h',
    'over': 'totals',
    'under': 'totals',
    // Legacy support
    'spread': 'spreads',
    'moneyline': 'h2h',
    'over_under': 'totals',
  };

  const marketKey = marketKeyMap[betType] || betType;
  const market = bookmaker.markets.find(m => m.key === marketKey);
  if (!market) {
    return null;
  }

  // Find matching outcome
  for (const outcome of market.outcomes) {
    let isMatch = false;

    // For moneyline (h2h), match by team name
    if (marketKey === 'h2h' && teamName) {
      isMatch = matchTeamName(teamName, outcome.name);
    }
    // For spreads, match by team name
    else if (marketKey === 'spreads' && teamName) {
      if (matchTeamName(teamName, outcome.name)) {
        // Optionally check if line matches (with tolerance)
        if (line !== undefined && outcome.point !== undefined) {
          const tolerance = 0.5;
          isMatch = Math.abs(outcome.point - line) <= tolerance;
        } else {
          isMatch = true;
        }
      }
    }
    // For totals, match by over/under
    else if (marketKey === 'totals') {
      const isOver = betType === 'over' || betType === 'over_under';
      const isUnder = betType === 'under';
      
      // The Odds API uses "Over" and "Under" as outcome names
      if (isOver && outcome.name.toLowerCase().includes('over')) {
        if (line !== undefined && outcome.point !== undefined) {
          const tolerance = 0.5;
          isMatch = Math.abs(outcome.point - line) <= tolerance;
        } else {
          isMatch = true;
        }
      } else if (isUnder && outcome.name.toLowerCase().includes('under')) {
        if (line !== undefined && outcome.point !== undefined) {
          const tolerance = 0.5;
          isMatch = Math.abs(outcome.point - line) <= tolerance;
        } else {
          isMatch = true;
        }
      }
    }

    if (isMatch) {
      // Return outcome with betslip link (or fallback to event page link)
      const betslipLink = outcome.link || bookmaker.link || null;
      return { outcome, betslipLink };
    }
  }

  return null;
}

