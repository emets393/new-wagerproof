import { useQuery } from '@tanstack/react-query';
import { getAllMarketsData } from '@/services/polymarketService';
import type { GamesSport } from '../types';

/** Static moneyline series for landing-page demos (avoids live Polymarket fetches). */
export interface DemoSparklinePoint {
  awayTeamOdds: number;
  homeTeamOdds: number;
}

export interface DemoSparklineSeries {
  data: DemoSparklinePoint[];
  currentAwayOdds: number;
  currentHomeOdds: number;
}

interface PolymarketSparklineProps {
  awayTeam: string;
  homeTeam: string;
  awayAbbrev: string;
  homeAbbrev: string;
  awayColor: string;
  homeColor: string;
  league: GamesSport;
  width?: number;
  height?: number;
  /** When set, skip the live Polymarket fetch and render this series instead. */
  demoSeries?: DemoSparklineSeries;
}

function parseHexColor(color: string): [number, number, number] | null {
  const hex = color.trim().replace('#', '');
  const expanded = hex.length === 3 ? hex.split('').map((value) => value + value).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16)) as [number, number, number];
}

function readableTeamColor(color: string, mode: 'light' | 'dark'): string {
  const rgb = parseHexColor(color);
  if (!rgb) return mode === 'light' ? '#334155' : '#CBD5E1';

  // Blend extreme team colors toward a neutral foreground. This keeps the hue
  // recognizable while ensuring pale colors work on white and dark colors work
  // on the near-black dark surface.
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  const needsAdjustment = mode === 'light' ? luminance > 0.58 : luminance < 0.42;
  if (!needsAdjustment) return color;

  const target = mode === 'light' ? [15, 23, 42] : [241, 245, 249];
  const strength = mode === 'light'
    ? Math.min(0.62, 0.28 + (luminance - 0.58) * 0.8)
    : Math.min(0.58, 0.3 + (0.42 - luminance) * 0.8);
  const mixed = rgb.map((channel, index) => Math.round(channel * (1 - strength) + target[index] * strength));
  return `rgb(${mixed.join(', ')})`;
}

/**
 * Web port of the iOS PolymarketMoneylineSparkline: dual win-probability
 * lines (leader thicker + full opacity, trailer thin at 55%) with a small
 * "ABBR 62%" leader badge. Shares the React Query cache with the full
 * PolymarketWidget (same query key), so the detail pane costs no extra fetch.
 */
export function PolymarketSparkline({
  awayTeam,
  homeTeam,
  awayAbbrev,
  homeAbbrev,
  awayColor,
  homeColor,
  league,
  width = 98,
  height = 34,
  demoSeries,
}: PolymarketSparklineProps) {
  const { data } = useQuery({
    queryKey: ['polymarket-all', league, awayTeam, homeTeam],
    queryFn: () => getAllMarketsData(awayTeam, homeTeam, league),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !demoSeries,
  });

  const ml = demoSeries ?? data?.moneyline;
  if (!ml || ml.data.length < 2) return null;

  // Downsample dense Polymarket histories so ~300 points don't turn into a
  // noisy audio-waveform when compressed into a ~100px sparkline.
  const rawPoints = ml.data;
  const maxPoints = Math.max(12, Math.floor(width / 3));
  const points =
    rawPoints.length <= maxPoints
      ? rawPoints
      : Array.from({ length: maxPoints }, (_, i) => {
          const idx = Math.round((i / (maxPoints - 1)) * (rawPoints.length - 1));
          return rawPoints[idx];
        });

  const awayLeads = ml.currentAwayOdds >= ml.currentHomeOdds;
  const leaderAbbrev = awayLeads ? awayAbbrev : homeAbbrev;
  const leaderColor = awayLeads ? awayColor : homeColor;
  // Already a 0-100 percentage from polymarketService (see PolymarketWidget,
  // which renders these values with a bare `%`) — scaling by 100 printed "5600%".
  const leaderPct = Math.round(awayLeads ? ml.currentAwayOdds : ml.currentHomeOdds);

  // Win probs are already 0–100. Keep that absolute scale so quiet markets
  // (~48–52%) read as gentle drift instead of filling the chart with noise.
  // Dual away/home lines are mirrors (home = 100 − away), so auto-scaling
  // them to the data range turns coin-flip markets into diamond waveforms.
  const min = 0;
  const max = 100;
  const range = 100;
  const pad = 3;

  const toPath = (pick: (p: (typeof points)[number]) => number) =>
    points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * (width - 2);
        const y = pad + (1 - (pick(p) - min) / range) * (height - pad * 2);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const awayPath = toPath((p) => p.awayTeamOdds);
  const homePath = toPath((p) => p.homeTeamOdds);

  const lightAwayColor = readableTeamColor(awayColor, 'light');
  const lightHomeColor = readableTeamColor(homeColor, 'light');
  const darkAwayColor = readableTeamColor(awayColor, 'dark');
  const darkHomeColor = readableTeamColor(homeColor, 'dark');

  const paths = (mode: 'light' | 'dark') => {
    const visibleAwayColor = mode === 'light' ? lightAwayColor : darkAwayColor;
    const visibleHomeColor = mode === 'light' ? lightHomeColor : darkHomeColor;
    const visibleLeaderColor = awayLeads ? visibleAwayColor : visibleHomeColor;
    return (
      <>
        <path
          d={awayLeads ? homePath : awayPath}
          fill="none"
          stroke={awayLeads ? visibleHomeColor : visibleAwayColor}
          strokeWidth={1.4}
          strokeOpacity={0.78}
          strokeLinecap="round"
        />
        <path
          d={awayLeads ? awayPath : homePath}
          fill="none"
          stroke={visibleLeaderColor}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      </>
    );
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5" style={{ width }}>
      <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-foreground">
        <span className="h-1.5 w-1.5 rounded-full dark:hidden" style={{ backgroundColor: readableTeamColor(leaderColor, 'light') }} />
        <span className="hidden h-1.5 w-1.5 rounded-full dark:block" style={{ backgroundColor: readableTeamColor(leaderColor, 'dark') }} />
        {leaderAbbrev} {leaderPct}%
      </span>
      <svg width={width} height={height} className="overflow-visible">
        <g className="dark:hidden">{paths('light')}</g>
        <g className="hidden dark:block">{paths('dark')}</g>
      </svg>
    </div>
  );
}
