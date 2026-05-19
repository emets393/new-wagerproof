import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

export interface ParkHRFactors {
  team_abbr: string;
  venue_name: string;
  lf_line_ft: number;
  rf_line_ft: number;
  cf_ft: number;
  lf_wall_ft: number;
  rf_wall_ft: number;
  altitude_ft: number;
  has_roof: boolean;
  is_artificial: boolean;
  notes: string;
  rhb_distance_mult: number;
  lhb_distance_mult: number;
  rhb_wall_mult: number;
  lhb_wall_mult: number;
  altitude_mult: number;
  rhb_hr_factor: number;
  lhb_hr_factor: number;
  lf_short_porch: boolean;
  rf_short_porch: boolean;
  lf_tall_wall: boolean;
  rf_tall_wall: boolean;
}

async function fetchParksByAbbr(abbrs: string[]): Promise<Map<string, ParkHRFactors>> {
  const unique = [...new Set(abbrs.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await collegeFootballSupabase
    .from('v_mlb_park_hr_factors')
    .select('*')
    .in('team_abbr', unique);

  if (error) throw error;

  const map = new Map<string, ParkHRFactors>();
  for (const row of (data ?? []) as ParkHRFactors[]) {
    map.set(row.team_abbr, row);
  }
  return map;
}

export function usePark(team_abbr: string | null) {
  return useQuery({
    queryKey: ['park-hr-factors', team_abbr],
    queryFn: async () => {
      if (!team_abbr) return null;
      const map = await fetchParksByAbbr([team_abbr]);
      return map.get(team_abbr) ?? null;
    },
    enabled: !!team_abbr,
    staleTime: 1000 * 60 * 60 * 24,
  });
}

/** Batch-load parks for the slate (home team abbr per game). */
export function useParksMap(teamAbbrs: string[]) {
  const key = [...new Set(teamAbbrs.filter(Boolean))].sort().join(',');

  return useQuery({
    queryKey: ['park-hr-factors-batch', key],
    queryFn: () => fetchParksByAbbr(teamAbbrs),
    enabled: key.length > 0,
    staleTime: 1000 * 60 * 60 * 24,
  });
}
