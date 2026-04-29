/**
 * Mobile mirror of src/hooks/useMLBPerfectStormRecords.ts. Aggregates
 * the season-to-date record for each Perfect Storm tier ('ps' and 'psh')
 * from mlb_graded_picks for display on the regression report screen.
 */

import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';

export interface PerfectStormRecord {
  tier: 'ps' | 'psh';
  picks: number;
  wins: number;
  losses: number;
  pushes: number;
  win_pct: number | null;
  units: number;
}

export interface MLBPerfectStormRecords {
  ps: PerfectStormRecord;
  psh: PerfectStormRecord;
}

const EMPTY: PerfectStormRecord = {
  tier: 'ps',
  picks: 0, wins: 0, losses: 0, pushes: 0,
  win_pct: null, units: 0,
};

export function useMLBPerfectStormRecords() {
  return useQuery<MLBPerfectStormRecords>({
    queryKey: ['mlb-perfect-storm-records'],
    queryFn: async () => {
      const { data, error } = await collegeFootballSupabase
        .from('mlb_graded_picks')
        .select('perfect_storm_tier, result, units_won')
        .in('perfect_storm_tier', ['ps', 'psh']);
      if (error) throw error;

      const acc = {
        ps:  { ...EMPTY, tier: 'ps'  as const },
        psh: { ...EMPTY, tier: 'psh' as const },
      };

      for (const row of data ?? []) {
        const tier = row.perfect_storm_tier as 'ps' | 'psh';
        const r = acc[tier];
        r.picks += 1;
        if (row.result === 'won')  r.wins   += 1;
        else if (row.result === 'lost') r.losses += 1;
        else if (row.result === 'push') r.pushes += 1;
        r.units += Number(row.units_won ?? 0);
      }

      const finalize = (r: PerfectStormRecord): PerfectStormRecord => {
        const graded = r.wins + r.losses;
        return {
          ...r,
          win_pct: graded > 0 ? Math.round((100 * r.wins / graded) * 10) / 10 : null,
          units: Math.round(r.units * 100) / 100,
        };
      };

      return { ps: finalize(acc.ps), psh: finalize(acc.psh) };
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
