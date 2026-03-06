/**
 * Types for Model Accuracy tool (NBA & NCAAB)
 * Shows today's model predictions with historical edge accuracy buckets
 */

export type AccuracySortMode = 'time' | 'spread' | 'moneyline' | 'ou';

export interface AccuracyBucket {
  games: number;
  accuracy_pct: number;
}

export interface GameAccuracyData {
  gameId: number;
  awayTeam: string;
  homeTeam: string;
  awayAbbr: string;
  homeAbbr: string;
  gameDate: string;
  tipoffTime: string | null;
  // Spread
  homeSpread: number | null;
  homeSpreadDiff: number | null;
  spreadAccuracy: AccuracyBucket | null;
  // Moneyline
  homeWinProb: number | null;
  awayWinProb: number | null;
  mlPickIsHome: boolean | null;
  mlPickProbRounded: number | null;
  mlAccuracy: AccuracyBucket | null;
  // Over/Under
  overLine: number | null;
  overLineDiff: number | null;
  ouAccuracy: AccuracyBucket | null;
  // NCAAB-specific (optional)
  awayTeamLogo?: string | null;
  homeTeamLogo?: string | null;
}

/** Round to nearest 0.5 */
export function roundToNearestHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/** Format tipoff time to ET display */
export function formatTipoffTime(tipoffTimeUtc: string | null, gameDate?: string | null): string {
  if (!tipoffTimeUtc) return 'TBD';
  try {
    let utcDate: Date;
    if (tipoffTimeUtc.includes('T') || (tipoffTimeUtc.length > 10 && tipoffTimeUtc.includes(' '))) {
      utcDate = new Date(tipoffTimeUtc);
    } else if (gameDate) {
      const timePart = tipoffTimeUtc.includes(':') && tipoffTimeUtc.split(':').length >= 2
        ? tipoffTimeUtc.length === 5 ? `${tipoffTimeUtc}:00` : tipoffTimeUtc
        : tipoffTimeUtc;
      utcDate = new Date(`${gameDate}T${timePart}`);
    } else {
      utcDate = new Date(tipoffTimeUtc);
    }
    if (isNaN(utcDate.getTime())) return 'TBD';
    const timeStr = utcDate.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${timeStr} ET`;
  } catch {
    return 'TBD';
  }
}
