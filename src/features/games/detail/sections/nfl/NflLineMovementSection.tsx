import * as React from 'react';
import { AlertCircle, ArrowRight, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { SegmentedControl, WidgetCard } from '@/components/ios';
import { cn } from '@/lib/utils';
import debug from '@/utils/debug';
import { type NFLPrediction } from '../../../api/nflGames';
import type { GameFeedItem } from '../../../types';
import { TeamMark } from './shared';
import { useNflLineMovement } from './useNflLineMovement';

const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');

    return `${month}/${day} (${displayHours}:${displayMinutes}${ampm})`;
  } catch (error) {
    debug.error('Error formatting timestamp:', error);
    return timestamp;
  }
};

/** Emerald matches the OVER color used on every total in the stack. */
const TOTAL_COLOR = '#10b981';

type Series = 'away' | 'home' | 'total';

interface ChartPoint {
  displayTime: string;
  homeSpread: number | null;
  awaySpread: number | null;
  overLine: number | null;
}

const fmt = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'N/A' : value.toFixed(1);

/**
 * Open, now, and the move between them as three columns. This was a
 * bullet-joined sentence under the chart ("Opening: -3.5 | Current: -6.0"),
 * which made the one number that matters — the move — something to work out.
 */
function MoveSummary({ open, current }: { open: number | null; current: number | null }) {
  const delta = open !== null && current !== null ? current - open : null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          Open
        </span>
        <span className="text-base font-bold tabular-nums text-muted-foreground">{fmt(open)}</span>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      <div className="flex flex-col">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          Now
        </span>
        <span className="text-base font-bold tabular-nums text-foreground">{fmt(current)}</span>
      </div>
      {delta !== null && (
        <div className="ml-auto flex flex-col items-end">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Moved
          </span>
          <span
            className={cn(
              'font-mono text-[13px] font-bold tabular-nums',
              delta === 0
                ? 'text-muted-foreground'
                : delta > 0
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-red-600 dark:text-red-300',
            )}
          >
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}

interface NflLineMovementSectionProps {
  game: GameFeedItem;
  extras: Record<string, unknown>;
}

/**
 * Line Movement, ported from GameDetailsModal's NFL block. The two stacked
 * charts (spread, then total) plus a separate team toggle became one chart with
 * a single picker: which line am I looking at.
 */
export function NflLineMovementSection({ game }: NflLineMovementSectionProps) {
  const raw = game.raw as NFLPrediction;
  const [series, setSeries] = React.useState<Series>('away');
  const { lineData, loading, error } = useNflLineMovement(raw.training_key);

  const away = game.awayTeam;
  const home = game.homeTeam;

  const chartData: ChartPoint[] = lineData.map((item) => ({
    displayTime: formatTimestamp(item.as_of_ts),
    homeSpread: item.home_spread,
    awaySpread: item.away_spread,
    overLine: item.over_line,
  }));

  const config: Record<Series, { key: keyof ChartPoint; color: string; label: string }> = {
    away: { key: 'awaySpread', color: away.colors.primary, label: `${away.abbrev} spread` },
    home: { key: 'homeSpread', color: home.colors.primary, label: `${home.abbrev} spread` },
    total: { key: 'overLine', color: TOTAL_COLOR, label: 'Game total' },
  };
  const active = config[series];

  const values = chartData.map((d) => d[active.key] as number | null);
  const firstValue = values.find((v) => v !== null) ?? null;
  const lastValue = [...values].reverse().find((v) => v !== null) ?? null;

  const CustomTooltip = ({ active: isActive, payload, label }: any) => {
    if (!isActive || !payload || !payload.length) return null;
    return (
      <div className="rounded-lg border border-border bg-card p-2.5 shadow-lg">
        <p className="text-[11px] font-semibold text-card-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-[11px] tabular-nums" style={{ color: entry.color }}>
            {active.label}: {entry.value !== null ? entry.value.toFixed(1) : 'N/A'}
          </p>
        ))}
      </div>
    );
  };

  return (
    <WidgetCard
      icon={<TrendingUp />}
      title="Line Movement"
      subtitle="How the spread and the total have moved since the books opened this game."
      className="@xl:col-span-2"
      accessory={
        !loading && !error && chartData.length > 0 ? (
          <SegmentedControl
            size="sm"
            options={[
              { value: 'away', label: away.abbrev, icon: <TeamMark team={away} size={14} /> },
              { value: 'home', label: home.abbrev, icon: <TeamMark team={home} size={14} /> },
              { value: 'total', label: 'Total' },
            ]}
            value={series}
            // Wrapped: passing the setter directly collapses the generic to string.
            onChange={(value) => setSeries(value as Series)}
          />
        ) : undefined
      }
      contentClassName="space-y-3"
    >
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : chartData.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          No line movement data available for this game.
        </p>
      ) : (
        <>
          <MoveSummary open={firstValue} current={lastValue} />

          {/* Chart sits directly on the card surface — the gradient panel it used
              to live in was a second surface inside the widget. */}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 32 }}>
                <CartesianGrid
                  strokeDasharray="2 4"
                  stroke="currentColor"
                  strokeOpacity={0.15}
                  vertical={false}
                  className="text-muted-foreground"
                />
                <XAxis
                  dataKey="displayTime"
                  tick={{ fontSize: 10, fontWeight: 500, fill: 'currentColor' }}
                  axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                  tickLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 10, fontWeight: 600, fill: 'currentColor' }}
                  axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                  tickLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                  tickFormatter={(value) => Number(value).toFixed(1)}
                  width={44}
                  className="text-muted-foreground"
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="linear"
                  dataKey={active.key as string}
                  stroke={active.color}
                  strokeWidth={2.5}
                  // Dots inherit the line color instead of a hardcoded white ring,
                  // which disappeared on a light surface.
                  dot={{ fill: active.color, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: active.color, strokeWidth: 0 }}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </WidgetCard>
  );
}
