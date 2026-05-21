export type StatBucket = 'elite' | 'above_avg' | 'avg' | 'below_avg' | 'poor';

export interface LeagueBenchmarkPercentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export type LeagueBenchmarks = Record<string, LeagueBenchmarkPercentiles>;

export function getStatBucket(
  value: number | null | undefined,
  p10: number,
  p25: number,
  p75: number,
  p90: number,
  higherIsBetter = true,
): StatBucket | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  if (higherIsBetter) {
    if (value >= p90) return 'elite';
    if (value >= p75) return 'above_avg';
    if (value < p10) return 'poor';
    if (value < p25) return 'below_avg';
    return 'avg';
  }
  if (value <= p10) return 'elite';
  if (value <= p25) return 'above_avg';
  if (value > p90) return 'poor';
  if (value > p75) return 'below_avg';
  return 'avg';
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
  benchmarks: LeagueBenchmarks | null | undefined,
  statKey: string,
): LeagueBenchmarkPercentiles | null {
  if (!benchmarks) return null;
  const keys = STAT_ALIASES[statKey] ?? [statKey];
  for (const key of keys) {
    if (benchmarks[key]) return benchmarks[key];
  }
  return benchmarks[statKey] ?? null;
}

export function bucketColors(bucket: StatBucket | null, isDark: boolean) {
  switch (bucket) {
    case 'elite':
      return { text: '#22c55e', bg: isDark ? 'rgba(34, 197, 94, 0.14)' : 'rgba(34, 197, 94, 0.11)', border: 'rgba(34, 197, 94, 0.38)' };
    case 'above_avg':
      return { text: '#4ade80', bg: isDark ? 'rgba(74, 222, 128, 0.10)' : 'rgba(34, 197, 94, 0.08)', border: 'rgba(74, 222, 128, 0.28)' };
    case 'below_avg':
      return { text: '#fb923c', bg: isDark ? 'rgba(251, 146, 60, 0.12)' : 'rgba(251, 146, 60, 0.10)', border: 'rgba(251, 146, 60, 0.32)' };
    case 'poor':
      return { text: '#ef4444', bg: isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.10)', border: 'rgba(239, 68, 68, 0.38)' };
    default:
      return { text: null, bg: isDark ? '#262626' : '#f3f4f6', border: isDark ? '#3f3f46' : '#e5e7eb' };
  }
}
