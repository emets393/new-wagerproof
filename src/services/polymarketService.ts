import {
  PolymarketMarket,
  PolymarketTrade,
  PolymarketTimeSeriesData,
  PolymarketAllMarketsData,
  TimeSeriesPoint,
  PolymarketSearchResponse,
  MarketType,
  PolymarketEventMarketClean,
  PolymarketEventsResponse,
  GroupedGame,
} from '@/types/polymarket';
import debug from '@/utils/debug';
import { supabase } from '@/integrations/supabase/client';

// Use Supabase Edge Function to proxy Polymarket API calls (avoids CORS issues)
const USE_PROXY = true;

interface PriceHistoryPoint {
  t: number; // Unix timestamp in seconds
  p: number; // Price (0.00-1.00)
}

interface PriceHistoryResponse {
  history: PriceHistoryPoint[];
}

interface PolymarketSport {
  sport: string;
  tags: string;
  series: string;
  ordering: string;
}

interface PolymarketEvent {
  slug: string;
  title: string;
  markets: PolymarketEventMarket[];
  game_start_time?: string;
  gameStartTime?: string;
}

interface PolymarketEventMarket {
  slug: string;
  question: string;
  active: boolean;
  closed: boolean;
  tokens?: { outcome: string; token_id: string }[];
  clobTokenIds?: string[];
}

// Map city names to team mascots for better Polymarket matching
const NFL_TEAM_MASCOTS: Record<string, string> = {
  'Arizona': 'Cardinals',
  'Atlanta': 'Falcons',
  'Baltimore': 'Ravens',
  'Buffalo': 'Bills',
  'Carolina': 'Panthers',
  'Chicago': 'Bears',
  'Cincinnati': 'Bengals',
  'Cleveland': 'Browns',
  'Dallas': 'Cowboys',
  'Denver': 'Broncos',
  'Detroit': 'Lions',
  'Green Bay': 'Packers',
  'Houston': 'Texans',
  'Indianapolis': 'Colts',
  'Jacksonville': 'Jaguars',
  'Kansas City': 'Chiefs',
  'Las Vegas': 'Raiders',
  'Los Angeles Chargers': 'Chargers',
  'Los Angeles Rams': 'Rams',
  'LA Chargers': 'Chargers',
  'LA Rams': 'Rams',
  'Miami': 'Dolphins',
  'Minnesota': 'Vikings',
  'New England': 'Patriots',
  'New Orleans': 'Saints',
  'NY Giants': 'Giants',
  'NY Jets': 'Jets',
  'Philadelphia': 'Eagles',
  'Pittsburgh': 'Steelers',
  'San Francisco': '49ers',
  'Seattle': 'Seahawks',
  'Tampa Bay': 'Buccaneers',
  'Tennessee': 'Titans',
  'Washington': 'Commanders',
};

// CFB teams - map common variations to Polymarket names
const CFB_TEAM_MAPPINGS: Record<string, string> = {
  'Ohio State': 'Ohio State',
  'Michigan': 'Michigan',
  'Alabama': 'Alabama',
  'Georgia': 'Georgia',
  'Texas': 'Texas',
  'Oregon': 'Oregon',
  'Penn State': 'Penn State',
  'Notre Dame': 'Notre Dame',
  'USC': 'USC',
  'LSU': 'LSU',
  'Clemson': 'Clemson',
  'Florida State': 'Florida State',
  'Florida': 'Florida',
  'Tennessee': 'Tennessee',
  'Oklahoma': 'Oklahoma',
  'Texas A&M': 'Texas A&M',
  'Auburn': 'Auburn',
  'Ole Miss': 'Ole Miss',
  'Miami': 'Miami',
  'Washington': 'Washington',
  'Wisconsin': 'Wisconsin',
  'Iowa': 'Iowa',
  'Utah': 'Utah',
  'Oklahoma State': 'Oklahoma State',
  'Kentucky': 'Kentucky',
  'South Carolina': 'South Carolina',
  'Mississippi State': 'Mississippi State',
  'Arkansas': 'Arkansas',
  'Missouri': 'Missouri',
  'Kansas State': 'Kansas State',
  'TCU': 'TCU',
  'Baylor': 'Baylor',
  'North Carolina': 'North Carolina',
  'NC State': 'NC State',
  'Virginia Tech': 'Virginia Tech',
  'Pittsburgh': 'Pittsburgh',
  'Louisville': 'Louisville',
};

// Get team mascot from city/school name
function getTeamMascot(teamName: string, league: 'nfl' | 'cfb' = 'nfl'): string {
  if (league === 'cfb') {
    return CFB_TEAM_MAPPINGS[teamName] || teamName;
  }
  return NFL_TEAM_MASCOTS[teamName] || teamName;
}

/**
 * Get sports metadata from Polymarket (includes tag IDs for each sport)
 */
export async function getSportsMetadata(): Promise<PolymarketSport[]> {
  try {
    debug.log('📊 Fetching sports metadata');
    
    if (USE_PROXY) {
      const { data, error } = await supabase.functions.invoke('polymarket-proxy', {
        body: { action: 'sports' },
      });

      if (error) {
        debug.error('❌ Sports metadata proxy error:', error);
        return [];
      }

      return data?.sports || [];
    } else {
      const response = await fetch('https://gamma-api.polymarket.com/sports');
      if (!response.ok) return [];
      return await response.json();
    }
  } catch (error) {
    debug.error('Error fetching sports metadata:', error);
    return [];
  }
}

/**
 * Get league tag ID from sports metadata
 */
async function getLeagueTagId(league: 'nfl' | 'cfb'): Promise<string | null> {
  const sports = await getSportsMetadata();
  const sportName = league === 'nfl' ? 'nfl' : 'cfb'; // Polymarket uses 'cfb' for College Football
  const sport = sports.find((s) => s.sport?.toLowerCase() === sportName);
  
  if (!sport) {
    debug.error(`❌ ${sportName.toUpperCase()} sport not found in Polymarket`);
    return null;
  }

  // tags is comma-separated like "1,450,100639"
  const tagCandidates = sport.tags.split(',').map(t => t.trim()).filter(Boolean);
  
  // Prefer the first tag that's not "1" (generic umbrella tag)
  const primaryTagId = tagCandidates.find(t => t !== '1') || tagCandidates[0];
  
  debug.log(`🏈 ${league.toUpperCase()} tag ID:`, primaryTagId);
  return primaryTagId;
}

/**
 * Get league events from Polymarket (NFL or CFB)
 */
export async function getLeagueEvents(league: 'nfl' | 'cfb' = 'nfl'): Promise<PolymarketEvent[]> {
  try {
    const tagId = await getLeagueTagId(league);
    
    if (!tagId) {
      debug.error(`❌ Could not get ${league.toUpperCase()} tag ID`);
      return [];
    }

    debug.log(`📊 Fetching ${league.toUpperCase()} events with tag:`, tagId);
    
    if (USE_PROXY) {
      const { data, error } = await supabase.functions.invoke('polymarket-proxy', {
        body: { action: 'events', tagId },
      });

      if (error) {
        debug.error('❌ Events proxy error:', error);
        return [];
      }

      const events = data?.events || [];
      debug.log('✅ Found', events.length, 'NFL events');
      return events;
    } else {
      const url = `https://gamma-api.polymarket.com/events?tag_id=${tagId}&closed=false&limit=100&related_tags=true`;
      const response = await fetch(url);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : (data.events || data.data || []);
    }
  } catch (error) {
    debug.error('Error fetching NFL events:', error);
    return [];
  }
}

/**
 * Search for Polymarket markets using Gamma API (via proxy to avoid CORS)
 * @deprecated Use getNFLEvents() instead for better reliability
 */
export async function searchMarketsGamma(query: string): Promise<any[]> {
  try {
    debug.log('🔍 Searching Gamma API:', query);
    
    if (USE_PROXY) {
      // Use Supabase Edge Function proxy
      const { data, error } = await supabase.functions.invoke('polymarket-proxy', {
        body: {
          action: 'search',
          query: query,
        },
      });

      if (error) {
        debug.error('❌ Polymarket proxy error:', error);
        return [];
      }

      const markets = data?.markets || [];
      debug.log('✅ Found markets:', markets.length);
      
      if (markets.length > 0) {
        debug.log('📋 Sample markets:', markets.slice(0, 3).map((m: any) => m.question || m.title));
      }
      
      return markets;
    } else {
      // Direct API call (only works in dev/localhost)
      const url = `https://gamma-api.polymarket.com/markets?limit=100&closed=false&_search=${encodeURIComponent(query)}`;
      debug.log('URL:', url);
      
      const response = await fetch(url);

      if (!response.ok) {
        debug.error('Gamma API search failed:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      const markets = Array.isArray(data) ? data : [];
      debug.log('Found markets:', markets.length);
      
      return markets;
    }
  } catch (error) {
    debug.error('Error searching Gamma API:', error);
    return [];
  }
}

/**
 * Get price history for a specific token using the prices-history endpoint (via proxy to avoid CORS)
 */
export async function getPriceHistory(
  tokenId: string,
  interval: string = 'max',
  fidelity: number = 60
): Promise<PriceHistoryPoint[]> {
  try {
    debug.log('📈 Fetching price history for token:', tokenId);
    
    if (USE_PROXY) {
      // Use Supabase Edge Function proxy
      const { data, error } = await supabase.functions.invoke('polymarket-proxy', {
        body: {
          action: 'price-history',
          tokenId: tokenId,
          interval: interval,
          fidelity: fidelity,
        },
      });

      if (error) {
        debug.error('❌ Price history proxy error:', error);
        return [];
      }

      const history = data?.history || [];
      debug.log('✅ Found price points:', history.length);
      return history;
    } else {
      // Direct API call (only works in dev/localhost)
      const url = `https://clob.polymarket.com/prices-history?market=${tokenId}&interval=${interval}&fidelity=${fidelity}`;
      debug.log('URL:', url);
      
      const response = await fetch(url);

      if (!response.ok) {
        debug.error('Price history fetch failed:', response.status);
        return [];
      }

      const data: PriceHistoryResponse = await response.json();
      debug.log('Found price points:', data?.history?.length || 0);
      return data.history || [];
    }
  } catch (error) {
    debug.error('Error fetching price history:', error);
    return [];
  }
}

/**
 * Parse team names from Polymarket event title
 * Format: "Ravens vs. Dolphins" or "Chiefs @ Bills"
 */
function parseTeamsFromTitle(title: string): { awayTeam: string; homeTeam: string } | null {
  if (!title) return null;

  if (title.includes(' vs. ')) {
    const [away, home] = title.split(' vs. ').map(s => s.trim());
    if (away && home) return { awayTeam: away, homeTeam: home };
  } else if (title.includes(' @ ')) {
    const [away, home] = title.split(' @ ').map(s => s.trim());
    if (away && home) return { awayTeam: away, homeTeam: home };
  }

  return null;
}

/**
 * Find matching event from Polymarket events based on team names
 */
function findMatchingEvent(
  events: PolymarketEvent[],
  awayTeam: string,
  homeTeam: string
): PolymarketEvent | null {
  if (!events || events.length === 0) return null;

  // Clean team names for matching
  const cleanTeamName = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  // Get mascots for matching
  const awayMascot = getTeamMascot(awayTeam);
  const homeMascot = getTeamMascot(homeTeam);

  debug.log(`🔍 Looking for event: ${awayTeam} (${awayMascot}) vs ${homeTeam} (${homeMascot})`);

  for (const event of events) {
    const parsedTeams = parseTeamsFromTitle(event.title);
    
    if (!parsedTeams) continue;

    const eventAway = cleanTeamName(parsedTeams.awayTeam);
    const eventHome = cleanTeamName(parsedTeams.homeTeam);

    // Check if event matches our game (either direction)
    const awayMatch = eventAway.includes(cleanTeamName(awayMascot)) || 
                      eventAway.includes(cleanTeamName(awayTeam));
    const homeMatch = eventHome.includes(cleanTeamName(homeMascot)) ||
                      eventHome.includes(cleanTeamName(homeTeam));

    // Also check reversed (sometimes Polymarket lists home team first)
    const awayMatchReversed = eventHome.includes(cleanTeamName(awayMascot)) || 
                              eventHome.includes(cleanTeamName(awayTeam));
    const homeMatchReversed = eventAway.includes(cleanTeamName(homeMascot)) ||
                              eventAway.includes(cleanTeamName(homeTeam));

    if ((awayMatch && homeMatch) || (awayMatchReversed && homeMatchReversed)) {
      debug.log('✅ Found matching event:', event.title);
      return event;
    }
  }

  debug.log('❌ No matching event found');
  if (events.length > 0) {
    debug.log('📋 Available events:', events.slice(0, 5).map(e => e.title));
  }

  return null;
}

/**
 * Classify market type based on question and slug
 * Handles both NFL and CFB market naming conventions
 */
function classifyMarket(question: string, slug: string, awayTeam?: string, homeTeam?: string): MarketType | null {
  const qLower = question.toLowerCase();
  const sLower = slug.toLowerCase();

  // Skip 1st half markets (for now - we focus on full game markets)
  if (qLower.includes('1h') || sLower.includes('-1h-')) {
    return null;
  }

  // Check for spread
  if (qLower.includes('spread') || sLower.includes('-spread-')) {
    return 'spread';
  }

  // Check for total/over-under
  if (qLower.includes('o/u') || qLower.includes('total') || sLower.includes('-total-')) {
    return 'total';
  }

  // Check for explicit moneyline
  if (qLower.includes('moneyline') || sLower.includes('-moneyline')) {
    return 'moneyline';
  }

  // CFB/NFL fallback: plain "Team A vs. Team B" = moneyline
  // Check if question contains "vs" or "vs." and both team names
  if (qLower.includes(' vs ') || qLower.includes(' vs. ')) {
    // If no specific market type indicators and has team names, it's moneyline
    if (awayTeam && homeTeam) {
      const hasAwayTeam = qLower.includes(awayTeam.toLowerCase());
      const hasHomeTeam = qLower.includes(homeTeam.toLowerCase());
      if (hasAwayTeam && hasHomeTeam) {
        return 'moneyline';
      }
    }
    // Even without team names, if it's just "Team vs Team" with no other indicators, it's moneyline
    return 'moneyline';
  }

  // Main market without suffix is likely moneyline
  if (!sLower.includes('-total-') && !sLower.includes('-spread-')) {
    return 'moneyline';
  }

  return null;
}

/**
 * Extract token IDs from a specific market
 */
function extractTokensFromMarket(
  market: PolymarketEventMarket
): { yesTokenId: string; noTokenId: string } | null {
  let yesTokenId: string | null = null;
  let noTokenId: string | null = null;

  if (market.tokens && Array.isArray(market.tokens)) {
    const yesToken = market.tokens.find(t => (t.outcome || '').toLowerCase() === 'yes');
    const noToken = market.tokens.find(t => (t.outcome || '').toLowerCase() === 'no');
    
    yesTokenId = yesToken?.token_id || null;
    noTokenId = noToken?.token_id || null;
  } else if (market.clobTokenIds) {
    if (typeof market.clobTokenIds === 'string') {
      try {
        const arr = JSON.parse(market.clobTokenIds);
        if (Array.isArray(arr) && arr.length >= 2) {
          yesTokenId = arr[0];
          noTokenId = arr[1];
        }
      } catch (e) {
        // Not JSON
      }
    } else if (Array.isArray(market.clobTokenIds) && market.clobTokenIds.length >= 2) {
      yesTokenId = market.clobTokenIds[0];
      noTokenId = market.clobTokenIds[1];
    }
  }

  if (!yesTokenId) return null;
  
  return { yesTokenId, noTokenId: noTokenId || '' };
}

/**
 * Extract all market types (moneyline, spread, total) from an event
 */
function extractAllMarketsFromEvent(
  event: PolymarketEvent
): Partial<Record<MarketType, { yesTokenId: string; noTokenId: string; question: string }>> {
  const result: Partial<Record<MarketType, { yesTokenId: string; noTokenId: string; question: string }>> = {};

  if (!event.markets || event.markets.length === 0) {
    return result;
  }

  // Extract team names from event title for better classification
  const teams = parseTeamsFromTitle(event.title);
  const awayTeam = teams?.awayTeam;
  const homeTeam = teams?.homeTeam;

  for (const market of event.markets) {
    if (!market.active || market.closed) continue;

    const marketType = classifyMarket(market.question, market.slug, awayTeam, homeTeam);
    if (!marketType) continue;

    // Skip if we already have this market type
    if (result[marketType]) continue;

    const tokens = extractTokensFromMarket(market);
    if (!tokens) continue;

    result[marketType] = {
      ...tokens,
      question: market.question,
    };

    debug.log(`📊 Found ${marketType} market:`, market.question);
  }

  return result;
}

/**
 * Extract token IDs from an event's markets
 * Returns yesTokenId for the first team mentioned (usually away team per "ordering: away")
 * @deprecated Use extractAllMarketsFromEvent instead
 */
function extractTokensFromEvent(
  event: PolymarketEvent,
  awayTeam: string,
  homeTeam: string
): { yesTokenId: string; noTokenId: string; isAwayTeamYes: boolean } | null {
  if (!event.markets || event.markets.length === 0) {
    debug.log('❌ No markets in event');
    return null;
  }

  // Look for the main moneyline market (eventSlug matches the main question)
  // Or look for markets without specific market type suffixes
  const mainMarket = event.markets.find((m) => {
    const slug = m.slug || '';
    const question = (m.question || '').toLowerCase();
    
    // Main market usually has slug equal to event slug, or doesn't have type suffix
    // Also prefer active, non-closed markets
    return m.active && !m.closed && (
      !slug.includes('-total-') &&
      !slug.includes('-1h-') &&
      !slug.includes('-spread-') &&
      (question === event.title.toLowerCase() || question.includes('vs'))
    );
  });

  const marketToUse = mainMarket || event.markets[0];

  if (!marketToUse) {
    debug.log('❌ No suitable market found');
    return null;
  }

  debug.log('📊 Using market:', marketToUse.question);

  // Extract token IDs
  let yesTokenId: string | null = null;
  let noTokenId: string | null = null;

  if (marketToUse.tokens && Array.isArray(marketToUse.tokens)) {
    const yesToken = marketToUse.tokens.find(t => (t.outcome || '').toLowerCase() === 'yes');
    const noToken = marketToUse.tokens.find(t => (t.outcome || '').toLowerCase() === 'no');
    
    yesTokenId = yesToken?.token_id || null;
    noTokenId = noToken?.token_id || null;
  } else if (marketToUse.clobTokenIds) {
    if (typeof marketToUse.clobTokenIds === 'string') {
      try {
        const arr = JSON.parse(marketToUse.clobTokenIds);
        if (Array.isArray(arr) && arr.length >= 2) {
          yesTokenId = arr[0];
          noTokenId = arr[1];
        }
      } catch (e) {
        // Not JSON, might be array already
      }
    } else if (Array.isArray(marketToUse.clobTokenIds) && marketToUse.clobTokenIds.length >= 2) {
      yesTokenId = marketToUse.clobTokenIds[0];
      noTokenId = marketToUse.clobTokenIds[1];
    }
  }

  if (!yesTokenId) {
    debug.log('❌ Could not extract token IDs');
    return null;
  }

  debug.log('🎯 Tokens extracted:', { yesTokenId: yesTokenId.slice(0, 20) + '...', noTokenId: noTokenId?.slice(0, 20) + '...' });

  // The YES token represents the first team (away team per Polymarket's "ordering: away")
  return { yesTokenId, noTokenId: noTokenId || '', isAwayTeamYes: true };
}

/**
 * Find the best matching market for a game from Gamma API results
 * @deprecated Use findMatchingEvent() instead
 */
function findBestMarketGamma(
  markets: any[],
  awayTeam: string,
  homeTeam: string
): any | null {
  if (!markets || markets.length === 0) return null;

  // Clean team names for matching
  const cleanTeamName = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  // Get mascots for matching
  const awayMascot = getTeamMascot(awayTeam);
  const homeMascot = getTeamMascot(homeTeam);

  const awayClean = cleanTeamName(awayMascot);
  const homeClean = cleanTeamName(homeMascot);
  const awayCleanCity = cleanTeamName(awayTeam);
  const homeCleanCity = cleanTeamName(homeTeam);

  // Build all possible team identifiers (city, mascot, full name)
  // Polymarket uses full names like "Baltimore Ravens", "Miami Dolphins"
  const awayTerms = [
    awayClean,
    awayCleanCity,
    cleanTeamName(`${awayTeam} ${awayMascot}`),
  ];

  const homeTerms = [
    homeClean,
    homeCleanCity,
    cleanTeamName(`${homeTeam} ${homeMascot}`),
  ];

  debug.log('🔍 Matching for away:', awayTerms, 'home:', homeTerms);
  debug.log('📋 Checking', markets.length, 'markets');

  // Look for markets that contain both team identifiers
  // Polymarket format: "Will the Baltimore Ravens beat the Miami Dolphins on Oct 30?"
  const matchingMarkets = markets.filter((market) => {
    const question = cleanTeamName(market.question || market.title || '');
    
    // Check if question contains ANY away term AND ANY home term
    const hasAway = awayTerms.some(term => question.includes(term));
    const hasHome = homeTerms.some(term => question.includes(term));
    
    if (hasAway && hasHome) {
      debug.log('✅ Match found:', market.question || market.title);
      return true;
    }
    return false;
  });

  if (matchingMarkets.length === 0) {
    debug.log('❌ No matching markets found for:', awayMascot, 'vs', homeMascot);
    if (markets.length > 0) {
      debug.log('📋 Available markets:', markets.slice(0, 5).map(m => m.question || m.title));
    }
    return null;
  }

  // Prefer markets that are specifically about the winner (moneyline) - "beat" or "win"
  const moneylineMarkets = matchingMarkets.filter((market) => {
    const question = (market.question || market.title || '').toLowerCase();
    return question.includes('beat') || question.includes('win');
  });

  const bestMarket = moneylineMarkets.length > 0 ? moneylineMarkets[0] : matchingMarkets[0];
  debug.log('🎯 Selected market:', bestMarket.question || bestMarket.title);
  
  return bestMarket;
}

/**
 * Transform price history into time series data
 */
function transformPriceHistory(
  priceHistory: PriceHistoryPoint[],
  isAwayTeam: boolean
): TimeSeriesPoint[] {
  if (!priceHistory || priceHistory.length === 0) return [];

  return priceHistory.map((point) => {
    const probability = point.p; // 0.00-1.00
    const timestampMs = point.t * 1000; // Convert to milliseconds
    
    // Convert to percentage
    const oddsPercentage = Math.round(probability * 100);
    
    if (isAwayTeam) {
      return {
        timestamp: timestampMs,
        awayTeamOdds: oddsPercentage,
        homeTeamOdds: 100 - oddsPercentage,
        awayTeamPrice: probability,
        homeTeamPrice: 1 - probability,
      };
    } else {
      return {
        timestamp: timestampMs,
        awayTeamOdds: 100 - oddsPercentage,
        homeTeamOdds: oddsPercentage,
        awayTeamPrice: 1 - probability,
        homeTeamPrice: probability,
      };
    }
  });
}

/**
 * Group markets by event slug for easier display
 * Useful when consuming /events endpoint that returns flat list of markets
 */
export function groupByEventSlug(markets: PolymarketEventMarketClean[]): GroupedGame[] {
  const byGame = new Map<string, GroupedGame>();

  for (const mkt of markets) {
    const key = mkt.eventSlug;
    if (!byGame.has(key)) {
      byGame.set(key, {
        eventSlug: mkt.eventSlug,
        title: mkt.eventTitle,
        awayTeam: mkt.awayTeam,
        homeTeam: mkt.homeTeam,
        gameStartTime: mkt.gameStartTime,
        lines: []
      });
    }

    // Classify the market type
    const marketType = classifyMarket(mkt.question, mkt.marketSlug, mkt.awayTeam, mkt.homeTeam) || 'other';

    byGame.get(key)!.lines.push({
      marketSlug: mkt.marketSlug,
      marketType,
      question: mkt.question,
      yesTokenId: mkt.yesTokenId,
      noTokenId: mkt.noTokenId
    });
  }

  return Array.from(byGame.values());
}

// OLD VERSION REMOVED - See new implementation below with league parameter support

/**
 * Get all market types (moneyline, spread, total) for a game - LIVE API
 * This function makes direct API calls and should only be used as fallback
 */
export async function getAllMarketsDataLive(
  awayTeam: string,
  homeTeam: string,
  league: 'nfl' | 'cfb' = 'nfl'
): Promise<PolymarketAllMarketsData | null> {
  try {
    const awayMascot = getTeamMascot(awayTeam, league);
    const homeMascot = getTeamMascot(homeTeam, league);
    
    debug.log(`🔍 Fetching all Polymarket markets for: ${awayTeam} (${awayMascot}) vs ${homeTeam} (${homeMascot})`);
    
    // Step 1: Get all league events
    const events = await getLeagueEvents(league);
    
    if (!events || events.length === 0) {
      debug.log('❌ No NFL events available from Polymarket');
      return null;
    }

    // Step 2: Find the matching event
    const event = findMatchingEvent(events, awayTeam, homeTeam);
    
    if (!event) {
      debug.log('❌ No matching event found for this game');
      return null;
    }

    debug.log(`✅ Found event: ${event.title}`);

    // Step 3: Extract all market types
    const allMarkets = extractAllMarketsFromEvent(event);

    const result: PolymarketAllMarketsData = {
      awayTeam,
      homeTeam,
    };

    // Step 4: Fetch price history for each market type
    for (const [marketType, marketData] of Object.entries(allMarkets) as [MarketType, typeof allMarkets[MarketType]][]) {
      if (!marketData) continue;

      const priceHistory = await getPriceHistory(marketData.yesTokenId, 'max', 60);

      if (!priceHistory || priceHistory.length === 0) {
        debug.log(`⚠️ No price history for ${marketType}`);
        continue;
      }

      const timeSeriesData = transformPriceHistory(priceHistory, true); // Always use away team as YES

      const latestPoint = timeSeriesData[timeSeriesData.length - 1];

      result[marketType] = {
        awayTeam,
        homeTeam,
        data: timeSeriesData,
        currentAwayOdds: latestPoint?.awayTeamOdds || 50,
        currentHomeOdds: latestPoint?.homeTeamOdds || 50,
        volume: 0,
        marketId: marketData.yesTokenId,
        marketType,
      };

      debug.log(`✅ ${marketType}: ${latestPoint?.awayTeamOdds}% - ${latestPoint?.homeTeamOdds}%`);
    }

    return result;
  } catch (error) {
    debug.error('❌ Error getting all markets data (live):', error);
    return null;
  }
}

/**
 * Get cached market data from Supabase
 */
async function getAllMarketsDataFromCache(
  awayTeam: string,
  homeTeam: string,
  league: 'nfl' | 'cfb' = 'nfl'
): Promise<PolymarketAllMarketsData | null> {
  try {
    const gameKey = `${league}_${awayTeam}_${homeTeam}`;
    debug.log(`🔍 Checking cache for: ${gameKey}`);

    // @ts-ignore - polymarket_markets table exists but not in types yet
    const { data, error } = await supabase
      .from('polymarket_markets')
      .select('*')
      .eq('game_key', gameKey)
      .eq('league', league);

    if (error) {
      debug.error('❌ Cache query error:', error);
      return null;
    }

    if (!data || data.length === 0) {
      debug.log('⚠️ No cached data found');
      return null;
    }

    debug.log(`✅ Found ${data.length} cached markets`);

    const result: PolymarketAllMarketsData = {
      awayTeam,
      homeTeam,
    };

    // Process each cached market
    for (const market of data) {
      // @ts-ignore - dynamic table columns
      const marketType = market.market_type as MarketType;
      // @ts-ignore
      const priceHistory = market.price_history as PriceHistoryPoint[];

      if (!priceHistory || priceHistory.length === 0) continue;

      // Transform to time series format
      const timeSeriesData = transformPriceHistory(priceHistory, true);

      result[marketType] = {
        awayTeam,
        homeTeam,
        data: timeSeriesData,
        // @ts-ignore
        currentAwayOdds: market.current_away_odds,
        // @ts-ignore
        currentHomeOdds: market.current_home_odds,
        volume: 0,
        // @ts-ignore
        marketId: market.token_id,
        marketType,
      };

      // @ts-ignore
      debug.log(`✅ ${marketType} (cached): ${market.current_away_odds}% - ${market.current_home_odds}%`);
    }

    return result;
  } catch (error) {
    debug.error('❌ Error getting cached data:', error);
    return null;
  }
}

/**
 * Get all market types - uses cache first, falls back to live API
 */
export async function getAllMarketsData(
  awayTeam: string,
  homeTeam: string,
  league: 'nfl' | 'cfb' = 'nfl'
): Promise<PolymarketAllMarketsData | null> {
  // Try cache first
  const cachedData = await getAllMarketsDataFromCache(awayTeam, homeTeam, league);
  
  if (cachedData) {
    debug.log('✅ Using cached Polymarket data');
    return cachedData;
  }

  // Fall back to live API
  debug.log('⚠️ Cache miss, falling back to live API');
  return getAllMarketsDataLive(awayTeam, homeTeam, league);
}

/**
 * Get complete time series data for a game using /sports → /events → /prices-history flow
 * @deprecated Use getAllMarketsData instead for multi-market support
 */
export async function getMarketTimeSeriesData(
  awayTeam: string,
  homeTeam: string
): Promise<PolymarketTimeSeriesData | null> {
  try {
    const awayMascot = getTeamMascot(awayTeam, 'nfl');
    const homeMascot = getTeamMascot(homeTeam, 'nfl');
    
    debug.log(`🔍 Fetching Polymarket data for: ${awayTeam} (${awayMascot}) vs ${homeTeam} (${homeMascot})`);
    
    // Step 1: Get all NFL events from Polymarket
    const events = await getLeagueEvents('nfl');
    
    if (!events || events.length === 0) {
      debug.log('❌ No NFL events available from Polymarket');
      return null;
    }

    debug.log(`📊 Got ${events.length} NFL events, searching for match...`);

    // Step 2: Find the matching event for this game
    const event = findMatchingEvent(events, awayTeam, homeTeam);
    
    if (!event) {
      debug.log('❌ No matching event found for this game');
      return null;
    }

    debug.log(`✅ Found event: ${event.title}`);

    // Step 3: Extract token IDs from the event
    const tokens = extractTokensFromEvent(event, awayTeam, homeTeam);
    
    if (!tokens) {
      debug.log('❌ Could not extract token IDs from event');
      return null;
    }

    const { yesTokenId, isAwayTeamYes } = tokens;

    // Step 4: Fetch price history for the YES token
    const priceHistory = await getPriceHistory(yesTokenId, 'max', 60);

    if (!priceHistory || priceHistory.length === 0) {
      debug.log('❌ No price history found for token');
      return null;
    }

    debug.log(`📈 Got ${priceHistory.length} price points`);

    // Step 5: Transform price history to time series
    const timeSeriesData = transformPriceHistory(priceHistory, isAwayTeamYes);

    // Get current odds from the latest data point
    const latestPoint = timeSeriesData[timeSeriesData.length - 1];
    const currentAwayOdds = latestPoint?.awayTeamOdds || 50;
    const currentHomeOdds = latestPoint?.homeTeamOdds || 50;

    debug.log(`✅ Success! Current odds: ${awayMascot} ${currentAwayOdds}% - ${homeMascot} ${currentHomeOdds}%`);

    return {
      awayTeam,
      homeTeam,
      data: timeSeriesData,
      currentAwayOdds,
      currentHomeOdds,
      volume: 0, // Not available in events response
      marketId: yesTokenId,
      marketType: 'moneyline', // Default to moneyline for legacy function
    };
  } catch (error) {
    debug.error('❌ Error getting market time series data:', error);
    return null;
  }
}

