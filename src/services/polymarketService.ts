import {
  PolymarketMarket,
  PolymarketTrade,
  PolymarketTimeSeriesData,
  TimeSeriesPoint,
  PolymarketSearchResponse,
} from '@/types/polymarket';
import debug from '@/utils/debug';

const POLYMARKET_CLOB_API = 'https://clob.polymarket.com';
const POLYMARKET_GAMMA_API = 'https://gamma-api.polymarket.com';

interface PriceHistoryPoint {
  t: number; // Unix timestamp in seconds
  p: number; // Price (0.00-1.00)
}

interface PriceHistoryResponse {
  history: PriceHistoryPoint[];
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

// Get team mascot from city name
function getTeamMascot(cityName: string): string {
  return NFL_TEAM_MASCOTS[cityName] || cityName;
}

/**
 * Search for Polymarket markets using Gamma API
 */
export async function searchMarketsGamma(query: string): Promise<any[]> {
  try {
    const url = `${POLYMARKET_GAMMA_API}/markets?limit=100&closed=false&_search=${encodeURIComponent(query)}`;
    debug.log('Searching Gamma API:', query);
    debug.log('URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      debug.error('Gamma API search failed:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const markets = Array.isArray(data) ? data : [];
    debug.log('Found markets:', markets.length);
    
    if (markets.length > 0) {
      debug.log('Sample markets:', markets.slice(0, 3).map(m => m.question || m.title));
    }
    
    return markets;
  } catch (error) {
    debug.error('Error searching Gamma API:', error);
    return [];
  }
}

/**
 * Get price history for a specific token using the prices-history endpoint
 */
export async function getPriceHistory(
  tokenId: string,
  interval: string = '1h',
  fidelity: number = 60
): Promise<PriceHistoryPoint[]> {
  try {
    const url = `${POLYMARKET_CLOB_API}/prices-history?market=${tokenId}&interval=${interval}&fidelity=${fidelity}`;
    debug.log('Fetching price history for token:', tokenId);
    debug.log('URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      debug.error('Price history fetch failed:', response.status);
      return [];
    }

    const data: PriceHistoryResponse = await response.json();
    debug.log('Found price points:', data?.history?.length || 0);
    return data.history || [];
  } catch (error) {
    debug.error('Error fetching price history:', error);
    return [];
  }
}

/**
 * Find the best matching market for a game from Gamma API results
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

  // Look for markets that contain both team names (mascots or cities)
  const matchingMarkets = markets.filter((market) => {
    const question = cleanTeamName(market.question || market.title || '');
    // Check if question contains both mascots OR both cities
    const hasBothMascots = question.includes(awayClean) && question.includes(homeClean);
    const hasBothCities = question.includes(awayCleanCity) && question.includes(homeCleanCity);
    const hasAwayMascotHomeCity = question.includes(awayClean) && question.includes(homeCleanCity);
    const hasAwayCityHomeMascot = question.includes(awayCleanCity) && question.includes(homeClean);
    
    return hasBothMascots || hasBothCities || hasAwayMascotHomeCity || hasAwayCityHomeMascot;
  });

  if (matchingMarkets.length === 0) {
    debug.log('No matching markets found for:', awayMascot, 'vs', homeMascot);
    if (markets.length > 0) {
      debug.log('Available markets:', markets.slice(0, 5).map(m => m.question || m.title));
    }
    return null;
  }

  // Prefer markets that are specifically about the winner (moneyline)
  const moneylineMarkets = matchingMarkets.filter((market) => {
    const question = (market.question || market.title || '').toLowerCase();
    return question.includes('win');
  });

  const bestMarket = moneylineMarkets.length > 0 ? moneylineMarkets[0] : matchingMarkets[0];
  debug.log('Selected market:', bestMarket.question || bestMarket.title);
  
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
 * Get complete time series data for a game using Gamma API + prices-history endpoint
 */
export async function getMarketTimeSeriesData(
  awayTeam: string,
  homeTeam: string
): Promise<PolymarketTimeSeriesData | null> {
  try {
    // Convert city names to mascots
    const awayMascot = getTeamMascot(awayTeam);
    const homeMascot = getTeamMascot(homeTeam);
    
    debug.log(`🔍 Searching for: ${awayTeam} (${awayMascot}) vs ${homeTeam} (${homeMascot})`);
    
    // Try multiple search patterns for Gamma API
    const searchQueries = [
      `${awayMascot} ${homeMascot}`,
      `${homeMascot} ${awayMascot}`,
      `${awayMascot} vs ${homeMascot}`,
      `${awayMascot} ${homeTeam}`,
      `${awayTeam} ${homeMascot}`,
    ];
    
    let markets: any[] = [];
    
    // Try each search pattern until we find markets
    for (const searchQuery of searchQueries) {
      markets = await searchMarketsGamma(searchQuery);
      if (markets && markets.length > 0) {
        debug.log(`✅ Found ${markets.length} markets with query: "${searchQuery}"`);
        break;
      }
    }

    if (!markets || markets.length === 0) {
      debug.log('❌ No markets found after trying all search patterns');
      return null;
    }

    // Find the best matching market
    const market = findBestMarketGamma(markets, awayTeam, homeTeam);
    if (!market) {
      debug.log('❌ No matching market found');
      return null;
    }

    debug.log(`📊 Selected market: ${market.question || market.title}`);

    // Get the token ID for the YES outcome (typically one team winning)
    // Gamma API structure: market.tokens or market.outcomes
    let yesTokenId: string | null = null;
    let isAwayTeamYes = false;

    // Try to find token ID from market structure
    if (market.tokens && Array.isArray(market.tokens)) {
      // Look for the away team token
      const awayToken = market.tokens.find((t: any) => {
        const outcome = (t.outcome || '').toLowerCase();
        return outcome.includes(awayMascot.toLowerCase()) || outcome.includes(awayTeam.toLowerCase());
      });
      
      if (awayToken) {
        yesTokenId = awayToken.token_id || awayToken.tokenId;
        isAwayTeamYes = true;
        debug.log(`🎯 Found away team token: ${yesTokenId}`);
      } else {
        // Try home team
        const homeToken = market.tokens.find((t: any) => {
          const outcome = (t.outcome || '').toLowerCase();
          return outcome.includes(homeMascot.toLowerCase()) || outcome.includes(homeTeam.toLowerCase());
        });
        
        if (homeToken) {
          yesTokenId = homeToken.token_id || homeToken.tokenId;
          isAwayTeamYes = false;
          debug.log(`🎯 Found home team token: ${yesTokenId}`);
        }
      }
    }

    // Try alternative structure: clobTokenIds
    if (!yesTokenId && market.clobTokenIds && Array.isArray(market.clobTokenIds)) {
      yesTokenId = market.clobTokenIds[0];
      isAwayTeamYes = true;
      debug.log(`🎯 Using first clobTokenId: ${yesTokenId}`);
    }

    if (!yesTokenId) {
      debug.error('❌ Could not find token ID from market');
      debug.log('Market structure:', Object.keys(market));
      return null;
    }

    // Fetch price history for this token
    const priceHistory = await getPriceHistory(yesTokenId, 'max', 60);

    if (!priceHistory || priceHistory.length === 0) {
      debug.log('❌ No price history found for token:', yesTokenId);
      return null;
    }

    // Transform price history to time series
    const timeSeriesData = transformPriceHistory(priceHistory, isAwayTeamYes);

    // Get current odds from the latest data point
    const latestPoint = timeSeriesData[timeSeriesData.length - 1];
    const currentAwayOdds = latestPoint?.awayTeamOdds || 50;
    const currentHomeOdds = latestPoint?.homeTeamOdds || 50;

    debug.log(`✅ Loaded ${timeSeriesData.length} data points`);
    debug.log(`📈 Current odds: ${awayMascot} ${currentAwayOdds}% - ${homeMascot} ${currentHomeOdds}%`);

    return {
      awayTeam,
      homeTeam,
      data: timeSeriesData,
      currentAwayOdds,
      currentHomeOdds,
      volume: market.volume,
      marketId: yesTokenId,
    };
  } catch (error) {
    debug.error('❌ Error getting market time series data:', error);
    return null;
  }
}

