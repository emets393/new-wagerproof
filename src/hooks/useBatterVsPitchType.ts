import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type { BatterVsPitchTypeRow, PitchHand } from '@/types/mlb-matchups';

export function useBatterVsPitchType(
  batterId: number,
  vsPitcherHand: PitchHand,
  pitchTypes: string[],
  season: number,
  enabled: boolean,
) {
  const typesKey = [...pitchTypes].sort().join(',');

  return useQuery<BatterVsPitchTypeRow[]>({
    queryKey: ['mlb-batter-vs-pitch-type', batterId, vsPitcherHand, typesKey, season],
    enabled: enabled && batterId > 0 && pitchTypes.length > 0,
    queryFn: async () => {
      const { data, error } = await collegeFootballSupabase
        .from('mlb_batter_vs_pitch_type')
        .select('*')
        .eq('batter_id', batterId)
        .eq('season', season)
        .eq('vs_pitcher_hand', vsPitcherHand)
        .in('pitch_type', pitchTypes);

      if (error) throw error;
      return (data ?? []) as BatterVsPitchTypeRow[];
    },
    staleTime: 15 * 60 * 1000,
  });
}
