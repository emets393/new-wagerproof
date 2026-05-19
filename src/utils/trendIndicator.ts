export type Trend = 'up' | 'down' | 'flat' | 'na';

/** Relative change vs season required before showing a directional arrow. */
export const RELATIVE_THRESHOLD = 0.15;

export function computeTrend(
  recent: number | null | undefined,
  season: number | null | undefined,
  higherIsBetter: boolean = true,
): Trend {
  if (recent == null || season == null || !Number.isFinite(recent) || !Number.isFinite(season) || season === 0) {
    return 'na';
  }
  const relChange = (recent - season) / Math.abs(season);
  if (Math.abs(relChange) < RELATIVE_THRESHOLD) return 'flat';
  const isUp = relChange > 0;
  return isUp === higherIsBetter ? 'up' : 'down';
}

export function trendArrow(t: Trend): string {
  switch (t) {
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    case 'flat':
      return '→';
    default:
      return '';
  }
}

export function trendClass(t: Trend): string {
  switch (t) {
    case 'up':
      return 'text-emerald-500 font-semibold';
    case 'down':
      return 'text-red-500 font-semibold';
    case 'flat':
      return 'text-muted-foreground';
    default:
      return 'text-muted-foreground';
  }
}
