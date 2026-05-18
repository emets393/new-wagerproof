import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type { F5SplitRow } from '@/types/mlbF5Splits';
import { buildSplitLookup, toF5SplitTeamAbbr } from '@/utils/mlbF5Splits';

export function useF5Splits(teamAbbrs: string[]) {
  const normalized = [...new Set(teamAbbrs.map(toF5SplitTeamAbbr).filter(Boolean))].sort();

  return useQuery({
    queryKey: ['mlb-f5-splits', normalized],
    queryFn: async () => {
      if (normalized.length === 0) {
        return { rows: [] as F5SplitRow[], lookup: buildSplitLookup([]), lastRefreshedAt: null as string | null };
      }

      const { data, error } = await collegeFootballSupabase
        .from('mv_mlb_f5_team_splits')
        .select('*')
        .in('team_abbr', normalized);

      if (error) throw error;

      const rows = (data ?? []) as F5SplitRow[];
      const lastRefreshedAt = rows.find(r => r.last_refreshed_at)?.last_refreshed_at ?? null;

      return {
        rows,
        lookup: buildSplitLookup(rows),
        lastRefreshedAt,
      };
    },
    enabled: normalized.length > 0,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });
}
