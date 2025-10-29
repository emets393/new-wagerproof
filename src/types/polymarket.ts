// Polymarket API Type Definitions

export interface PolymarketMarket {
  id: string;
  question: string;
  condition_id: string;
  slug: string;
  end_date_iso: string;
  game_start_time?: string;
  tokens: PolymarketToken[];
  outcomes: string[];
  volume?: number;
  active: boolean;
}

export interface PolymarketToken {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

export interface PolymarketTrade {
  id: string;
  market: string;
  asset_id: string;
  price: number;
  side: 'BUY' | 'SELL';
  size: number;
  timestamp: number;
  outcome: string;
}

export interface TimeSeriesPoint {
  timestamp: number;
  awayTeamOdds: number;
  homeTeamOdds: number;
  awayTeamPrice?: number;
  homeTeamPrice?: number;
}

export type MarketType = 'moneyline' | 'spread' | 'total' | '1h_moneyline' | '1h_spread' | '1h_total' | 'other';

export interface PolymarketTimeSeriesData {
  awayTeam: string;
  homeTeam: string;
  data: TimeSeriesPoint[];
  currentAwayOdds: number;
  currentHomeOdds: number;
  volume?: number;
  marketId?: string;
  marketType: MarketType;
}

export interface PolymarketAllMarketsData {
  awayTeam: string;
  homeTeam: string;
  moneyline?: PolymarketTimeSeriesData;
  spread?: PolymarketTimeSeriesData;
  total?: PolymarketTimeSeriesData;
}

// New cleaner structure from /events endpoint
export interface PolymarketEventMarketClean {
  eventSlug: string;
  eventTitle: string;
  awayTeam: string;
  homeTeam: string;
  gameStartTime: string;
  marketSlug: string;
  marketType: string;
  question: string;
  yesTokenId: string;
  noTokenId: string;
  active: boolean;
  closed: boolean;
}

export interface PolymarketEventsResponse {
  sport: string;
  tagId: string;
  seriesId?: string;
  ordering?: string;
  markets: PolymarketEventMarketClean[];
}

export interface GroupedGame {
  eventSlug: string;
  title: string;
  awayTeam: string;
  homeTeam: string;
  gameStartTime: string;
  lines: {
    marketSlug: string;
    marketType: MarketType;
    question: string;
    yesTokenId: string;
    noTokenId: string;
  }[];
}

export interface PolymarketSearchResponse {
  data: PolymarketMarket[];
  count: number;
}

export interface PolymarketTradesResponse {
  data: PolymarketTrade[];
}

