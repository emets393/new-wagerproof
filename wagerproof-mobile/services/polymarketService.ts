import {
  PolymarketAllMarketsData,
  PolymarketTimeSeriesData,
  TimeSeriesPoint,
  MarketType,
} from '@/types/polymarket';
import { supabase } from '@/services/supabase';

interface PriceHistoryPoint {
  t: number; // Unix timestamp in seconds
  p: number; // Price (0.00-1.00)
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

function getTeamMascot(teamName: string, league: 'nfl' | 'cfb' = 'nfl'): string {
  if (league === 'cfb') {
    return CFB_TEAM_MAPPINGS[teamName] || teamName;
  }
  return NFL_TEAM_MASCOTS[teamName] || teamName;
}

async function getSportsMetadata(): Promise<PolymarketSport[]> {
  try {
    const { data, error } = await supabase.functions.invoke('polymarket-proxy', {
      body: { action: 'sports' },
    });

    if (error) {
      console.error('Sports metadata proxy error:', error);
      return [];
    }

    return data?.sports || [];
  } catch (error) {
    console.error('Error fetching sports metadata:', error);
    return [];
  }
}

async function getLeagueTagId(league: 'nfl' | 'cfb'): Promise<string | null> {
  const sports = await getSportsMetadata();
  const sportName = league === 'nfl' ? 'nfl' : 'cfb';
  const sport = sports.find((s) => s.sport?.toLowerCase() === sportName);
  
  if (!sport) {
    console.error(`${sportName.toUpperCase()} sport not found in Polymarket`);
    return null;
  }

  const tagCandidates = sport.tags.split(',').map(t => t.trim()).filter(Boolean);
  const primaryTagId = tagCandidates.find(t => t !== '1') || tagCandidates[0];
  
  return primaryTagId;
}

async function getLeagueEvents(league: 'nfl' | 'cfb' = 'nfl'): Promise<PolymarketEvent[]> {
  try {
    const tagId = await getLeagueTagId(league);
    
    if (!tagId) {
      console.error(`Could not get ${league.toUpperCase()} tag ID`);
      return [];
    }

    const { data, error } = await supabase.functions.invoke('polymarket-proxy', {
      body: { action: 'events', tagId },
    });

    if (error) {
      console.error('Events proxy error:', error);
      return [];
    }

    return data?.events || [];
  } catch (error) {
    console.error('Error fetching league events:', error);
    return [];
  }
}

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

function findMatchingEvent(
  events: PolymarketEvent[],
  awayTeam: string,
  homeTeam: string
): PolymarketEvent | null {
  if (!events || events.length === 0) return null;

  const cleanTeamName = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  const awayMascot = getTeamMascot(awayTeam);
  const homeMascot = getTeamMascot(homeTeam);

  for (const event of events) {
    const parsedTeams = parseTeamsFromTitle(event.title);
    
    if (!parsedTeams) continue;

    const eventAway = cleanTeamName(parsedTeams.awayTeam);
    const eventHome = cleanTeamName(parsedTeams.homeTeam);

    const awayMatch = eventAway.includes(cleanTeamName(awayMascot)) || 
                      eventAway.includes(cleanTeamName(awayTeam));
    const homeMatch = eventHome.includes(cleanTeamName(homeMascot)) ||
                      eventHome.includes(cleanTeamName(homeTeam));

    const awayMatchReversed = eventHome.includes(cleanTeamName(awayMascot)) || 
                              eventHome.includes(cleanTeamName(awayTeam));
    const homeMatchReversed = eventAway.includes(cleanTeamName(homeMascot)) ||
                              eventAway.includes(cleanTeamName(homeTeam));

    if ((awayMatch && homeMatch) || (awayMatchReversed && homeMatchReversed)) {
      return event;
    }
  }

  return null;
}

function classifyMarket(question: string, slug: string, awayTeam?: string, homeTeam?: string): MarketType | null {
  const qLower = question.toLowerCase();
  const sLower = slug.toLowerCase();

  if (qLower.includes('1h') || sLower.includes('-1h-')) {
    return null;
  }

  if (qLower.includes('spread') || sLower.includes('-spread-')) {
    return 'spread';
  }

  if (qLower.includes('o/u') || qLower.includes('total') || sLower.includes('-total-')) {
    return 'total';
  }

  if (qLower.includes('moneyline') || sLower.includes('-moneyline')) {
    return 'moneyline';
  }

  if (qLower.includes(' vs ') || qLower.includes(' vs. ')) {
    if (awayTeam && homeTeam) {
      const hasAwayTeam = qLower.includes(awayTeam.toLowerCase());
      const hasHomeTeam = qLower.includes(homeTeam.toLowerCase());
      if (hasAwayTeam && hasHomeTeam) {
        return 'moneyline';
      }
    }
    return 'moneyline';
  }

  if (!sLower.includes('-total-') && !sLower.includes('-spread-')) {
    return 'moneyline';
  }

  return null;
}

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

function extractAllMarketsFromEvent(
  event: PolymarketEvent
): Partial<Record<MarketType, { yesTokenId: string; noTokenId: string; question: string }>> {
  const result: Partial<Record<MarketType, { yesTokenId: string; noTokenId: string; question: string }>> = {};

  if (!event.markets || event.markets.length === 0) {
    return result;
  }

  const teams = parseTeamsFromTitle(event.title);
  const awayTeam = teams?.awayTeam;
  const homeTeam = teams?.homeTeam;

  for (const market of event.markets) {
    if (!market.active || market.closed) continue;

    const marketType = classifyMarket(market.question, market.slug, awayTeam, homeTeam);
    if (!marketType) continue;

    if (result[marketType]) continue;

    const tokens = extractTokensFromMarket(market);
    if (!tokens) continue;

    result[marketType] = {
      ...tokens,
      question: market.question,
    };
  }

  return result;
}

async function getPriceHistory(
  tokenId: string,
  interval: string = 'max',
  fidelity: number = 60
): Promise<PriceHistoryPoint[]> {
  try {
    const { data, error } = await supabase.functions.invoke('polymarket-proxy', {
      body: {
        action: 'price-history',
        tokenId: tokenId,
        interval: interval,
        fidelity: fidelity,
      },
    });

    if (error) {
      console.error('Price history proxy error:', error);
      return [];
    }

    return data?.history || [];
  } catch (error) {
    console.error('Error fetching price history:', error);
    return [];
  }
}

function transformPriceHistory(
  priceHistory: PriceHistoryPoint[],
  isAwayTeam: boolean
): TimeSeriesPoint[] {
  if (!priceHistory || priceHistory.length === 0) return [];

  return priceHistory.map((point) => {
    const probability = point.p;
    const timestampMs = point.t * 1000;
    
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

async function getAllMarketsDataFromCache(
  awayTeam: string,
  homeTeam: string,
  league: 'nfl' | 'cfb' = 'nfl'
): Promise<PolymarketAllMarketsData | null> {
  try {
    const gameKey = `${league}_${awayTeam}_${homeTeam}`;

    const { data, error } = await supabase
      .from('polymarket_markets')
      .select('*')
      .eq('game_key', gameKey)
      .eq('league', league);

    if (error) {
      console.error('Cache query error:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const result: PolymarketAllMarketsData = {
      awayTeam,
      homeTeam,
    };

    for (const market of data) {
      const marketType = (market.market_type as MarketType) || 'moneyline';
      const priceHistory = (market.price_history as PriceHistoryPoint[]) || [];

      if (!priceHistory || priceHistory.length === 0) continue;

      const timeSeriesData = transformPriceHistory(priceHistory, true);

      result[marketType] = {
        awayTeam,
        homeTeam,
        data: timeSeriesData,
        currentAwayOdds: market.current_away_odds || 50,
        currentHomeOdds: market.current_home_odds || 50,
        volume: 0,
        marketId: market.token_id,
        marketType,
      };
    }

    return result;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
}

async function getAllMarketsDataLive(
  awayTeam: string,
  homeTeam: string,
  league: 'nfl' | 'cfb' = 'nfl'
): Promise<PolymarketAllMarketsData | null> {
  try {
    const awayMascot = getTeamMascot(awayTeam, league);
    const homeMascot = getTeamMascot(homeTeam, league);
    
    const events = await getLeagueEvents(league);
    
    if (!events || events.length === 0) {
      return null;
    }

    const event = findMatchingEvent(events, awayTeam, homeTeam);
    
    if (!event) {
      return null;
    }

    const allMarkets = extractAllMarketsFromEvent(event);

    const result: PolymarketAllMarketsData = {
      awayTeam,
      homeTeam,
    };

    for (const [marketType, marketData] of Object.entries(allMarkets) as [MarketType, typeof allMarkets[MarketType]][]) {
      if (!marketData) continue;

      const priceHistory = await getPriceHistory(marketData.yesTokenId, 'max', 60);

      if (!priceHistory || priceHistory.length === 0) {
        continue;
      }

      const timeSeriesData = transformPriceHistory(priceHistory, true);
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
    }

    return result;
  } catch (error) {
    console.error('Error getting all markets data (live):', error);
    return null;
  }
}

export async function getAllMarketsData(
  awayTeam: string,
  homeTeam: string,
  league: 'nfl' | 'cfb' = 'nfl'
): Promise<PolymarketAllMarketsData | null> {
  const cachedData = await getAllMarketsDataFromCache(awayTeam, homeTeam, league);
  
  if (cachedData) {
    return cachedData;
  }

  return getAllMarketsDataLive(awayTeam, homeTeam, league);
}

