export type StatBucket = 'elite' | 'above_avg' | 'avg' | 'below_avg' | 'poor';

export function getStatBucket(
  value: number | null | undefined,
  p10: number,
  p25: number,
  p75: number,
  p90: number,
  higherIsBetter: boolean = true,
): StatBucket | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (higherIsBetter) {
    if (value >= p90) return 'elite';
    if (value >= p75) return 'above_avg';
    if (value < p10) return 'poor';
    if (value < p25) return 'below_avg';
    return 'avg';
  }
  if (value <= p10) return 'elite';
  if (value <= p25) return 'above_avg';
  if (value > p90) return 'poor';
  if (value > p75) return 'below_avg';
  return 'avg';
}

export function bucketToClass(b: StatBucket | null): string {
  switch (b) {
    case 'elite':
      return 'text-emerald-500 font-bold';
    case 'above_avg':
      return 'text-emerald-400 font-medium';
    case 'avg':
      return 'text-foreground';
    case 'below_avg':
      return 'text-orange-400 font-medium';
    case 'poor':
      return 'text-red-500 font-bold';
    default:
      return 'text-muted-foreground';
  }
}

export function bucketTooltip(b: StatBucket | null): string {
  switch (b) {
    case 'elite':
      return 'Top 10% of league';
    case 'above_avg':
      return 'Top 25% of league';
    case 'avg':
      return 'League average range';
    case 'below_avg':
      return 'Bottom 25%';
    case 'poor':
      return 'Bottom 10%';
    default:
      return 'Not enough data';
  }
}
