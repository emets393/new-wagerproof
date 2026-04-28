import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';

export type ModelBreakdownBetType = 'full_ml' | 'full_ou' | 'f5_ml' | 'f5_ou';
export type ModelBreakdownAxis = 'team' | 'dow';

export interface ModelBreakdownRow {
  bet_type: ModelBreakdownBetType;
  breakdown_type: ModelBreakdownAxis;
  breakdown_value: string;
  games: number;
  wins: number;
  losses: number;
  pushes: number;
  units_won: number;
  win_pct: number;
  roi_pct: number;
}

/**
 * Mobile mirror of src/hooks/useMLBModelBreakdownAccuracy.ts. Reads
 * mlb_model_breakdown_accuracy (refreshed nightly server-side).
 */
export function useMLBModelBreakdownAccuracy() {
  return useQuery<ModelBreakdownRow[]>({
    queryKey: ['mlb-model-breakdown-accuracy'],
    queryFn: async () => {
      const { data, error } = await collegeFootballSupabase
        .from('mlb_model_breakdown_accuracy')
        .select('bet_type, breakdown_type, breakdown_value, games, wins, losses, pushes, units_won, win_pct, roi_pct');

      if (error) throw error;
      return (data || []).map(r => ({
        ...r,
        units_won: Number(r.units_won) || 0,
        win_pct: Number(r.win_pct) || 0,
        roi_pct: Number(r.roi_pct) || 0,
      })) as ModelBreakdownRow[];
    },
    refetchInterval: 30 * 60 * 1000,
    staleTime: 15 * 60 * 1000,
  });
}
