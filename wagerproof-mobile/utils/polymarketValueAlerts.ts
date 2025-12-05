import { PolymarketAllMarketsData, MarketType } from '@/types/polymarket';

export interface ValueAlert {
  market: MarketType;
  side: 'away' | 'home';
  percentage: number;
  team: string;
}

export function detectValueAlerts(
  allMarketsData: PolymarketAllMarketsData | null | undefined,
  awayTeam: string,
  homeTeam: string,
  gameDate?: string
): ValueAlert[] {
  if (!allMarketsData) return [];

  // Check if game has started (disable alerts if game date/time has passed)
  const isGameStarted = (() => {
    if (!gameDate || typeof gameDate !== 'string') return false;
    
    try {
      let gameStartTime: Date;
      const now = new Date();
      
      const isDateTimeString = gameDate.includes('T') || 
                               gameDate.includes(' ') || 
                               gameDate.includes('+') ||
                               gameDate.length > 10;
      
      if (isDateTimeString) {
        gameStartTime = new Date(gameDate);
      } else {
        gameStartTime = new Date(gameDate + 'T23:59:59Z');
      }
      
      if (isNaN(gameStartTime.getTime())) {
        return false;
      }
      
      return now > gameStartTime;
    } catch (error) {
      return false;
    }
  })();

  if (isGameStarted) return [];

  try {
    const alerts: ValueAlert[] = [];
    const spread = allMarketsData.spread;
    const total = allMarketsData.total;
    const moneyline = allMarketsData.moneyline;
    
    // Check Spread (>57% on either side indicates Vegas line mismatch)
    if (spread && typeof spread.currentAwayOdds === 'number' && typeof spread.currentHomeOdds === 'number') {
      if (spread.currentAwayOdds > 57) {
        alerts.push({ 
          market: 'spread', 
          side: 'away', 
          percentage: spread.currentAwayOdds,
          team: awayTeam
        });
      }
      if (spread.currentHomeOdds > 57) {
        alerts.push({ 
          market: 'spread', 
          side: 'home', 
          percentage: spread.currentHomeOdds,
          team: homeTeam
        });
      }
    }
    
    // Check Total (>57% on either side indicates Vegas line mismatch)
    if (total && typeof total.currentAwayOdds === 'number' && typeof total.currentHomeOdds === 'number') {
      if (total.currentAwayOdds > 57) { // Over
        alerts.push({ 
          market: 'total', 
          side: 'away', 
          percentage: total.currentAwayOdds,
          team: 'Over'
        });
      }
      if (total.currentHomeOdds > 57) { // Under
        alerts.push({ 
          market: 'total', 
          side: 'home', 
          percentage: total.currentHomeOdds,
          team: 'Under'
        });
      }
    }
    
    // Check Moneyline (only highlight specific team if 85%+)
    if (moneyline && typeof moneyline.currentAwayOdds === 'number' && typeof moneyline.currentHomeOdds === 'number') {
      if (moneyline.currentAwayOdds >= 85) {
        alerts.push({ 
          market: 'moneyline', 
          side: 'away', 
          percentage: moneyline.currentAwayOdds,
          team: awayTeam
        });
      }
      if (moneyline.currentHomeOdds >= 85) {
        alerts.push({ 
          market: 'moneyline', 
          side: 'home', 
          percentage: moneyline.currentHomeOdds,
          team: homeTeam
        });
      }
    }
    
    return alerts;
  } catch (error) {
    console.error('Error calculating value alerts:', error);
    return [];
  }
}

