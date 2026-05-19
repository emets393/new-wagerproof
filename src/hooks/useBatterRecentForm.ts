import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type { BatterRecentForm, PitchHand } from '@/types/mlb-matchups';

const L10_WINDOW = 10;

export function useBatterRecentForm(
  batterId: number,
  season: number,
  vsPitcherHand: PitchHand,
  enabled = true,
) {
  return useQuery<BatterRecentForm | null>({
    queryKey: ['batter-recent-form', batterId, season, vsPitcherHand, L10_WINDOW],
    enabled: enabled && batterId > 0 && (vsPitcherHand === 'R' || vsPitcherHand === 'L'),
    queryFn: async () => {
      const { data, error } = await collegeFootballSupabase
        .from('mlb_batter_recent_form')
        .select('*')
        .eq('batter_id', batterId)
        .eq('season', season)
        .eq('vs_pitcher_hand', vsPitcherHand)
        .eq('window_games', L10_WINDOW)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        batter_id: Number(data.batter_id),
        games_used: Number(data.games_used ?? 0),
        pa: Number(data.pa ?? 0),
        bbe: Number(data.bbe ?? 0),
      } as BatterRecentForm;
    },
    staleTime: 15 * 60 * 1000,
  });
}
