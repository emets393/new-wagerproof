// Polymarket API Type Definitions for Mobile

export interface TimeSeriesPoint {
  timestamp: number;
  awayTeamOdds: number;
  homeTeamOdds: number;
  awayTeamPrice?: number;
  homeTeamPrice?: number;
}

export type MarketType = 'moneyline' | 'spread' | 'total';

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

export type TimeRange = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL';

