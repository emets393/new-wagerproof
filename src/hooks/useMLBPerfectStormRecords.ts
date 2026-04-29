/**
 * Aggregated Perfect Storm tier records sourced from mlb_graded_picks.
 *
 * Returns the season-to-date W-L record and ROI% for each of the 4
 * tiers (hammer, ps, lean, watch), so the regression report can show
 * the historical track record of each tier next to today's picks.
 *
 * Refreshes when the cron-driven nightly classifier updates rows.
 * React Query refetches every 10 min in case more picks have graded.
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
      const { data, error } = await collegeFootballSupabase
        .from('mlb_graded_picks')
        .select('perfect_storm_tier, result, units_won')
        .in('perfect_storm_tier', ['hammer', 'ps', 'lean', 'watch']);
      if (error) throw error;

      const acc: MLBPerfectStormRecords = {
        hammer: blank('hammer'),
        ps:     blank('ps'),
        lean:   blank('lean'),
        watch:  blank('watch'),
      };

      for (const row of data ?? []) {
        const tier = row.perfect_storm_tier as PerfectStormTier;
        const r = acc[tier];
        if (!r) continue;
        r.picks += 1;
        if (row.result === 'won')       r.wins   += 1;
        else if (row.result === 'lost') r.losses += 1;
        else if (row.result === 'push') r.pushes += 1;
        r.units += Number(row.units_won ?? 0);
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
