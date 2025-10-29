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

export interface PolymarketTimeSeriesData {
  awayTeam: string;
  homeTeam: string;
  data: TimeSeriesPoint[];
  currentAwayOdds: number;
  currentHomeOdds: number;
  volume?: number;
  marketId?: string;
}

export interface PolymarketSearchResponse {
  data: PolymarketMarket[];
  count: number;
}

export interface PolymarketTradesResponse {
  data: PolymarketTrade[];
}

