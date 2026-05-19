import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type { LeagueBenchmarks, LeagueBenchmarkPercentiles, PitchHand } from '@/types/mlb-matchups';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseBenchmarkRow(row: Record<string, unknown>): LeagueBenchmarks {
  const out: LeagueBenchmarks = {};
  const statKeys = new Set<string>();

  for (const key of Object.keys(row)) {
    const match = key.match(/^(.+)_p(10|25|50|75|90)$/i);
    if (match) statKeys.add(match[1].toLowerCase());
  }

  for (const stat of statKeys) {
    const p10 = row[`${stat}_p10`] ?? row[`${stat}_P10`];
    const p25 = row[`${stat}_p25`] ?? row[`${stat}_P25`];
    const p50 = row[`${stat}_p50`] ?? row[`${stat}_P50`];
    const p75 = row[`${stat}_p75`] ?? row[`${stat}_P75`];
    const p90 = row[`${stat}_p90`] ?? row[`${stat}_P90`];
    if (p10 == null && p90 == null) continue;
    out[stat] = {
      p10: num(p10),
      p25: num(p25),
      p50: num(p50),
      p75: num(p75),
      p90: num(p90),
    };
  }

  return out;
}

const STAT_ALIASES: Record<string, string[]> = {
  avg: ['avg', 'batting_avg'],
  obp: ['obp'],
  slg: ['slg'],
  ops: ['ops'],
  iso: ['iso'],
  woba: ['woba'],
  xwoba: ['xwoba', 'x_woba'],
  babip: ['babip'],
  k_pct: ['k_pct', 'kpercent', 'k_rate'],
  bb_pct: ['bb_pct', 'bbpercent', 'bb_rate'],
  barrel_pct: ['barrel_pct', 'barrelpercent'],
  hard_hit_pct: ['hard_hit_pct', 'hardhit_pct'],
  pull_air_pct: ['pull_air_pct', 'pullair_pct'],
  hr_per_fb_pct: ['hr_per_fb_pct', 'hr_per_fb'],
  gb_pct: ['gb_pct'],
  fb_pct: ['fb_pct'],
  ld_pct: ['ld_pct'],
  iffb_pct: ['iffb_pct'],
  pull_pct: ['pull_pct'],
  center_pct: ['center_pct'],
  oppo_pct: ['oppo_pct', 'opposite_pct'],
  avg_exit_velo: ['avg_exit_velo', 'exit_velo', 'avg_ev'],
};

export function resolveBenchmark(
  benchmarks: LeagueBenchmarks,
  statKey: string,
): LeagueBenchmarkPercentiles | null {
  const keys = STAT_ALIASES[statKey] ?? [statKey];
  for (const k of keys) {
    if (benchmarks[k]) return benchmarks[k];
  }
  return benchmarks[statKey] ?? null;
}

export function useLeagueBenchmarks(season: number, vsPitcherHand: PitchHand | 'A') {
  return useQuery<LeagueBenchmarks>({
    queryKey: ['mlb-league-batting-benchmarks', season, vsPitcherHand],
    queryFn: async () => {
      const { data, error } = await collegeFootballSupabase
        .from('v_mlb_league_batting_benchmarks')
        .select('*')
        .eq('season', season)
        .eq('vs_pitcher_hand', vsPitcherHand)
        .maybeSingle();

      if (error) throw error;
      if (!data) return {};
      return parseBenchmarkRow(data as Record<string, unknown>);
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}
