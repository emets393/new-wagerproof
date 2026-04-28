import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

export type ModelBreakdownBetType = 'full_ml' | 'full_ou' | 'f5_ml' | 'f5_ou';
export type ModelBreakdownAxis = 'team' | 'dow';

export interface ModelBreakdownRow {
  bet_type: ModelBreakdownBetType;
  breakdown_type: ModelBreakdownAxis;
  breakdown_value: string;     // 'NYY', 'BAL' etc. for team; 'Sun'..'Sat' for dow
  games: number;
  wins: number;
  losses: number;
  pushes: number;
  units_won: number;
  win_pct: number;
  roi_pct: number;
}

/**
 * Reads mlb_model_breakdown_accuracy. Used by the regression report to render
 * the day-of-week and team-level model accuracy/ROI tables underneath the
 * existing Model Accuracy Dashboard.
 *
 * Refreshed nightly server-side by refresh_mlb_model_breakdown_accuracy().
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
    refetchInterval: 30 * 60 * 1000,   // 30 min — data only changes nightly
    staleTime: 15 * 60 * 1000,
  });
}
