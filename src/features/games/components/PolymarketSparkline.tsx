import { useQuery } from '@tanstack/react-query';
import { getAllMarketsData } from '@/services/polymarketService';
import type { GamesSport } from '../types';

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
}: PolymarketSparklineProps) {
  const { data } = useQuery({
    queryKey: ['polymarket-all', league, awayTeam, homeTeam],
    queryFn: () => getAllMarketsData(awayTeam, homeTeam, league),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const ml = data?.moneyline;
  if (!ml || ml.data.length < 2) return null;

  const points = ml.data;
  const awayLeads = ml.currentAwayOdds >= ml.currentHomeOdds;
  const leaderAbbrev = awayLeads ? awayAbbrev : homeAbbrev;
  const leaderColor = awayLeads ? awayColor : homeColor;
  const leaderPct = Math.round((awayLeads ? ml.currentAwayOdds : ml.currentHomeOdds) * 100);

  // Normalize both series into the sparkline box with a little padding.
  const values = points.flatMap((p) => [p.awayTeamOdds, p.homeTeamOdds]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
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

  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5" style={{ width }}>
      <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-foreground">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: leaderColor }} />
        {leaderAbbrev} {leaderPct}%
      </span>
      <svg width={width} height={height} className="overflow-visible">
        <path
          d={awayLeads ? homePath : awayPath}
          fill="none"
          stroke={awayLeads ? homeColor : awayColor}
          strokeWidth={1}
          strokeOpacity={0.55}
          strokeLinecap="round"
        />
        <path
          d={awayLeads ? awayPath : homePath}
          fill="none"
          stroke={leaderColor}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
