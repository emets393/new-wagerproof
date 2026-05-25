// Reads the graded picks archive + the per-(tier × market) summary view.
import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

export type Tier = 'lean' | 'strong' | 'elite';
export type PickResult = 'won' | 'lost' | 'push' | 'pending' | 'void';

export interface GradeRow {
  report_date: string;
  game_pk: number;
  player_id: number;
  player_name: string | null;
  team_name: string | null;
  market: string;
  market_label: string | null;
  kind: 'batter' | 'pitcher' | null;
  tier: Tier | null;
  score: number | null;
  line: number | null;
  over_odds: number | null;
  l10_pct: number | null;
  actual_value: number | null;
  result: PickResult | null;
  units_staked: number | null;
  units_won: number | null;
}

export interface GradeSummaryRow {
  tier: Tier;
  market: string;
  market_label: string;
  kind: 'batter' | 'pitcher';
  picks_total: number;
  picks_won: number;
  picks_lost: number;
  picks_push: number;
  picks_pending: number;
  win_pct: number | null;
  units_staked: number | null;
  units_won: number | null;
  roi_pct: number | null;
}

export function usePlayerPropGradeSummary() {
  return useQuery<GradeSummaryRow[]>({
    queryKey: ['mlb-player-prop-grade-summary'],
    queryFn: async () => {
      const { data, error } = await collegeFootballSupabase
        .from('v_mlb_player_prop_grade_summary')
        .select('*');
      if (error) throw error;
      return (data ?? []) as GradeSummaryRow[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlayerPropGradeHistory(limit = 200) {
  return useQuery<GradeRow[]>({
    queryKey: ['mlb-player-prop-grade-history', limit],
    queryFn: async () => {
      const { data, error } = await collegeFootballSupabase
        .from('mlb_player_prop_grades')
        .select(
          'report_date, game_pk, player_id, player_name, team_name, market, market_label, kind, tier, score, line, over_odds, l10_pct, actual_value, result, units_staked, units_won',
        )
        .order('report_date', { ascending: false })
        .order('score', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as GradeRow[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
