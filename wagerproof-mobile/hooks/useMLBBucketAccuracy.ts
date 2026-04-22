import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';

// Mirrors src/hooks/useMLBBucketAccuracy.ts on the web so per-game bucket
// lookups match exactly. Reads mlb_model_bucket_accuracy — one row per
// (bet_type, bucket, side, fav_dog, direction) combination.

export interface BucketAccuracyRow {
  // 'perfect_storm' is a synthetic aggregate row populated from
  // mlb_graded_picks where is_perfect_storm = true (see
  // scripts/sql/refresh_perfect_storm_accuracy.sql).
  bet_type: 'full_ml' | 'full_ou' | 'f5_ml' | 'f5_ou' | 'perfect_storm';
  bucket: string;
  side: string;
  fav_dog: string;
  direction: string;
  games: number;
  wins: number;
  losses: number;
  pushes: number;
  units_won: number;
  win_pct: number;
  roi_pct: number;
  updated_at: string;
}

export interface BetTypeAccuracyWithRoi {
  overall: {
    games: number;
    wins: number;
    win_pct: number;
    units_won: number;
    roi_pct: number;
  };
  by_bucket: Array<{
    bucket: string;
    side?: string;
    fav_dog?: string;
    direction?: string;
    games: number;
    wins: number;
    win_pct: number;
    units_won: number;
    roi_pct: number;
  }>;
}

export interface MLBBucketAccuracy {
  full_ml: BetTypeAccuracyWithRoi;
  full_ou: BetTypeAccuracyWithRoi;
  f5_ml: BetTypeAccuracyWithRoi;
  f5_ou: BetTypeAccuracyWithRoi;
  perfect_storm: BetTypeAccuracyWithRoi;
}

function emptyBetType(): BetTypeAccuracyWithRoi {
  return {
    overall: { games: 0, wins: 0, win_pct: 0, units_won: 0, roi_pct: 0 },
    by_bucket: [],
  };
}

function aggregate(rows: BucketAccuracyRow[]): MLBBucketAccuracy {
  const out: MLBBucketAccuracy = {
    full_ml: emptyBetType(),
    full_ou: emptyBetType(),
    f5_ml: emptyBetType(),
    f5_ou: emptyBetType(),
    perfect_storm: emptyBetType(),
  };

  for (const r of rows) {
    const bt = out[r.bet_type];
    if (!bt) continue;

    bt.overall.games += r.games;
    bt.overall.wins += r.wins;
    bt.overall.units_won += Number(r.units_won) || 0;

    bt.by_bucket.push({
      bucket: r.bucket,
      side: r.side || undefined,
      fav_dog: r.fav_dog || undefined,
      direction: r.direction || undefined,
      games: r.games,
      wins: r.wins,
      win_pct: Number(r.win_pct) || 0,
      units_won: Number(r.units_won) || 0,
      roi_pct: Number(r.roi_pct) || 0,
    });
  }

  for (const bt of Object.values(out)) {
    const g = bt.overall.games;
    bt.overall.win_pct = g > 0 ? Math.round((bt.overall.wins / g) * 1000) / 10 : 0;
    bt.overall.units_won = Math.round(bt.overall.units_won * 100) / 100;
    bt.overall.roi_pct = g > 0 ? Math.round((bt.overall.units_won / g) * 1000) / 10 : 0;
  }

  return out;
}

export function useMLBBucketAccuracy() {
  return useQuery<MLBBucketAccuracy | null>({
    queryKey: ['mlb-bucket-accuracy'],
    queryFn: async () => {
      const { data, error } = await collegeFootballSupabase
        .from('mlb_model_bucket_accuracy')
        .select('*');

      if (error) throw error;
      if (!data) return null;
      return aggregate(data as BucketAccuracyRow[]);
    },
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
}
