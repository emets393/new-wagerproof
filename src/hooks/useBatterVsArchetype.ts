import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type { PitchHand } from '@/types/mlb-matchups';
import type { BatterVsArchetypeRow, PitcherArchetypeType } from '@/utils/mlbPitcherArchetypes';
import { isDisplayArchetype } from '@/utils/mlbPitcherArchetypes';

function normalizeVsArchetypeRow(raw: Record<string, unknown>): BatterVsArchetypeRow {
  return {
    batter_id: Number(raw.batter_id),
    season: Number(raw.season),
    vs_pitcher_hand: raw.vs_pitcher_hand as 'R' | 'L',
    archetype: String(raw.archetype),
    pa: Number(raw.pa ?? 0),
    avg: raw.avg != null ? Number(raw.avg) : null,
    obp: raw.obp != null ? Number(raw.obp) : null,
    slg: raw.slg != null ? Number(raw.slg) : null,
    xwoba: raw.xwoba != null ? Number(raw.xwoba) : null,
    k_pct: raw.k_pct != null ? Number(raw.k_pct) : null,
    barrel_pct: raw.barrel_pct != null ? Number(raw.barrel_pct) : null,
    hard_hit_pct: raw.hard_hit_pct != null ? Number(raw.hard_hit_pct) : null,
    hr_per_pa:
      raw.hr_per_pa != null
        ? Number(raw.hr_per_pa)
        : raw.home_runs != null && raw.pa
          ? Number(raw.home_runs) / Number(raw.pa)
          : null,
  };
}

export function useBatterVsArchetype(
  batterId: number,
  season: number,
  vsPitcherHand: PitchHand,
  archetype: PitcherArchetypeType | null | undefined,
  enabled = true,
) {
  return useQuery<BatterVsArchetypeRow | null>({
    queryKey: ['batter-vs-archetype', batterId, season, vsPitcherHand, archetype],
    enabled:
      enabled &&
      batterId > 0 &&
      (vsPitcherHand === 'R' || vsPitcherHand === 'L') &&
      isDisplayArchetype(archetype),
    queryFn: async () => {
      const { data, error } = await collegeFootballSupabase
        .from('mlb_batter_vs_archetype')
        .select('*')
        .eq('batter_id', batterId)
        .eq('season', season)
        .eq('vs_pitcher_hand', vsPitcherHand)
        .eq('archetype', archetype!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return normalizeVsArchetypeRow(data as Record<string, unknown>);
    },
    staleTime: 15 * 60 * 1000,
  });
}
