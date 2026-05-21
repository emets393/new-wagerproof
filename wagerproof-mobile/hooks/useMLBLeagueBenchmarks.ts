import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import type { LeagueBenchmarks } from '@/utils/statShading';

type HandBenchmarks = Partial<Record<'R' | 'L', LeagueBenchmarks>>;

function num(value: unknown): number {
  const n = Number(value);
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

export function useMLBLeagueBenchmarks(season: number | null) {
  return useQuery<HandBenchmarks>({
    queryKey: ['mlb-league-batting-benchmarks-mobile', season],
    enabled: !!season,
    queryFn: async () => {
      if (!season) return {};
      const { data, error } = await collegeFootballSupabase
        .from('v_mlb_league_batting_benchmarks')
        .select('*')
        .eq('season', season)
        .in('vs_pitcher_hand', ['R', 'L']);

      if (error) {
        console.warn('League batting benchmarks unavailable:', error.message);
        return {};
      }

      const out: HandBenchmarks = {};
      for (const row of data ?? []) {
        const hand = row.vs_pitcher_hand === 'R' || row.vs_pitcher_hand === 'L'
          ? row.vs_pitcher_hand
          : null;
        if (hand) out[hand] = parseBenchmarkRow(row as Record<string, unknown>);
      }
      return out;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}
