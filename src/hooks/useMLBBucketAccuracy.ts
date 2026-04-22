import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

/**
 * Bucket accuracy row as stored in mlb_model_bucket_accuracy.
 * One row per (bet_type, bucket, side, fav_dog, direction) combination.
 * Empty strings are used in place of NULL for the sub-dimension columns so
 * the primary key is fully indexable.
 */
export interface BucketAccuracyRow {
  // 'perfect_storm' is a synthetic aggregate row populated from
  // mlb_graded_picks where is_perfect_storm = true (see
  // scripts/sql/refresh_perfect_storm_accuracy.sql).
  bet_type: 'full_ml' | 'full_ou' | 'f5_ml' | 'f5_ou' | 'perfect_storm';
  bucket: string;
  side: string;        // 'home' | 'away' | ''
  fav_dog: string;     // 'favorite' | 'underdog' | ''
  direction: string;   // 'OVER' | 'UNDER' | 'over' | 'under' | ''
  games: number;
  wins: number;
  losses: number;
  pushes: number;
  units_won: number;
  win_pct: number;
  roi_pct: number;
  updated_at: string;
}

/**
 * Shape consumers get back: same structure that used to live in
 * regressionReport.model_accuracy, so existing lookup/render code
 * in MLB.tsx and AccuracyDashboard keeps working unchanged.
 */
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

  // Derive overall win_pct / roi_pct from the per-bucket sums
  for (const bt of Object.values(out)) {
    const g = bt.overall.games;
    bt.overall.win_pct = g > 0 ? Math.round((bt.overall.wins / g) * 1000) / 10 : 0;
    bt.overall.units_won = Math.round(bt.overall.units_won * 100) / 100;
    bt.overall.roi_pct = g > 0 ? Math.round((bt.overall.units_won / g) * 1000) / 10 : 0;
  }

  return out;
}

/**
 * Reads mlb_model_bucket_accuracy and returns data shaped like the legacy
 * regressionReport.model_accuracy field. Used by MLB.tsx for per-game bucket
 * lookups and by AccuracyDashboard on the regression page.
 */
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
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    staleTime: 5 * 60 * 1000,
  });
}
