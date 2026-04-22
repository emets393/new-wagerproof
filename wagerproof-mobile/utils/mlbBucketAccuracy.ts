import type { MLBBucketAccuracy } from '@/hooks/useMLBBucketAccuracy';

// Bucket thresholds must match the Python script that populates
// mlb_model_bucket_accuracy, and the web constants in src/pages/MLB.tsx.
export const ML_BUCKETS: [number, string][] = [[7, '7%+'], [4, '4-6.9%'], [2, '2-3.9%'], [0, '<2%']];
export const OU_BUCKETS: [number, string][] = [[1.5, '1.5+'], [1.0, '1.0-1.49'], [0.5, '0.5-0.99'], [0, '<0.5']];
export const F5_ML_BUCKETS: [number, string][] = [[20, '20%+'], [10, '10-19.9%'], [5, '5-9.9%'], [0, '<5%']];
export const F5_OU_BUCKETS: [number, string][] = [[1.0, '1.0+'], [0.5, '0.5-0.99'], [0, '<0.5']];

export function getBucketLabel(edge: number, buckets: [number, string][]): string {
  const absEdge = Math.abs(edge);
  const prefix = edge < 0 ? '-' : '+';
  for (const [threshold, label] of buckets) {
    if (absEdge >= threshold) return `${prefix}${label}`;
  }
  return `${prefix}${buckets[buckets.length - 1][1]}`;
}

export interface BucketAccuracyResult {
  win_pct: number;
  roi_pct: number;
  record: string;
}

export function lookupBucketAccuracy(
  modelAccuracy: MLBBucketAccuracy | null | undefined,
  betType: 'full_ml' | 'full_ou' | 'f5_ml' | 'f5_ou',
  edge: number,
  side?: 'home' | 'away',
  favDog?: 'favorite' | 'underdog',
  direction?: string,
): BucketAccuracyResult | null {
  if (!modelAccuracy) return null;
  const data = modelAccuracy[betType];
  if (!data) return null;

  const buckets = betType === 'full_ml' ? ML_BUCKETS
    : betType === 'full_ou' ? OU_BUCKETS
    : betType === 'f5_ml' ? F5_ML_BUCKETS
    : F5_OU_BUCKETS;
  const bucketLabel = getBucketLabel(edge, buckets);

  for (const b of data.by_bucket) {
    if (b.bucket !== bucketLabel) continue;
    if (side && b.side && b.side !== side) continue;
    if (favDog && b.fav_dog && b.fav_dog !== favDog) continue;
    if (direction && b.direction && b.direction !== direction) continue;
    if (b.games < 3) continue;
    return {
      win_pct: b.win_pct,
      roi_pct: b.roi_pct ?? 0,
      record: `${b.wins}-${b.games - b.wins}`,
    };
  }
  return null;
}
