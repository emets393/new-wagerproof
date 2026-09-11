/**
 * Aggregated Perfect Storm tier records from `mlb_unified_pick_record`.
 *
 * That view is the single combined record: the existing legacy graded picks
 * (unchanged, full history) PLUS the BallparkPal engine's picks from its
 * go-live date forward (no backfill — see memory bpp-pick-engine). Returns the
 * W-L record and ROI% for each of the 4 tiers (hammer, ps, lean, watch), so the
 * regression report shows the real, live-accruing track record next to today's
 * picks. React Query refetches every 10 min as more picks grade.
 */

import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

export type PerfectStormTier = 'hammer' | 'ps' | 'lean' | 'watch';

export interface PerfectStormRecord {
  tier: PerfectStormTier;
  picks: number;
  wins: number;
  losses: number;
  pushes: number;
  win_pct: number | null;
  units: number;
  roi_pct: number | null;
}

export type MLBPerfectStormRecords = Record<PerfectStormTier, PerfectStormRecord>;

const blank = (tier: PerfectStormTier): PerfectStormRecord => ({
  tier,
  picks: 0, wins: 0, losses: 0, pushes: 0,
  win_pct: null, units: 0, roi_pct: null,
});

export function useMLBPerfectStormRecords() {
  return useQuery<MLBPerfectStormRecords>({
    queryKey: ['mlb-perfect-storm-records'],
    queryFn: async () => {
      // Combined record view is pre-aggregated by (tier, source, bet_type); roll it up to tier.
      const { data, error } = await collegeFootballSupabase
        .from('mlb_unified_pick_record')
        .select('tier, n, w, l, p, units')
        .in('tier', ['hammer', 'ps', 'lean', 'watch']);
      if (error) throw error;

      const acc: MLBPerfectStormRecords = {
        hammer: blank('hammer'),
        ps:     blank('ps'),
        lean:   blank('lean'),
        watch:  blank('watch'),
      };

      for (const row of data ?? []) {
        const tier = row.tier as PerfectStormTier;
        const r = acc[tier];
        if (!r) continue;
        r.picks  += Number(row.n ?? 0);
        r.wins   += Number(row.w ?? 0);
        r.losses += Number(row.l ?? 0);
        r.pushes += Number(row.p ?? 0);
        r.units  += Number(row.units ?? 0);
      }

      // Finalize: compute win_pct and roi_pct (over graded games only).
      for (const tier of Object.keys(acc) as PerfectStormTier[]) {
        const r = acc[tier];
        const graded = r.wins + r.losses;
        r.win_pct = graded > 0 ? Math.round((100 * r.wins / graded) * 10) / 10 : null;
        r.roi_pct = graded > 0 ? Math.round((100 * r.units / graded) * 10) / 10 : null;
        r.units   = Math.round(r.units * 100) / 100;
      }

      return acc;
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
