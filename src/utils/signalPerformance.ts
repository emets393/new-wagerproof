export type SignalPerformanceRow = {
  sport: string;
  signal_key: string;
  season: number;
  n: number;
  wins: number;
  losses: number;
  pushes: number;
  hit_rate: number;
  units: number;
  roi: number;
  last_week?: number | null;
  updated_at?: string | null;
};

export type SignalSeasonRecordDisplay = {
  detail: string;
  tone: 'empty' | 'neutral' | 'positive' | 'negative';
  isSmallSample: boolean;
};

function signedUnits(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded > 0) return `+${rounded.toFixed(1)}u`;
  if (rounded < 0) return `-${Math.abs(rounded).toFixed(1)}u`;
  return '0.0u';
}

export function formatSignalSeasonRecord(
  performance: SignalPerformanceRow | null | undefined,
): SignalSeasonRecordDisplay {
  if (!performance || performance.n <= 0) {
    return {
      detail: '— (no graded picks yet)',
      tone: 'empty',
      isSmallSample: false,
    };
  }

  const record =
    performance.pushes > 0
      ? `${performance.wins}-${performance.losses}-${performance.pushes}`
      : `${performance.wins}-${performance.losses}`;
  const hitStr = `${(performance.hit_rate * 100).toFixed(1)}%`;
  const detail = `${record}  •  ${hitStr}  •  ${signedUnits(Number(performance.units))}`;

  const units = Number(performance.units);
  const tone = units > 0 ? 'positive' : units < 0 ? 'negative' : 'neutral';

  return {
    detail,
    tone,
    isSmallSample: performance.n < 10,
  };
}

export function signalSeasonRecordClassName(tone: SignalSeasonRecordDisplay['tone']): string {
  switch (tone) {
    case 'empty':
      return 'text-muted-foreground';
    case 'neutral':
      return 'text-foreground';
    case 'positive':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'negative':
      return 'text-red-600 dark:text-red-400';
  }
}
