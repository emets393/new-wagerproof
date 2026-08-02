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
import { nflLineMovementHeadline } from '../../headlines/nfl';
import {
  LINE_GROUP_LABELS,
  canChartMarket,
  distinctSeriesValues,
  formatLineValue,
  groupsPresent,
  isSlateCloseFallback,
  type LineMarket,
  type LineMarketGroup,
  type LineMarketId,
  type LineValueFormat,
} from './lineMovement';
import type { TeamRef } from '../../../types';

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
    return `${month}/${day} ${displayHours}:${displayMinutes} ${ampm}`;
  } catch (error) {
    debug.error('Error formatting timestamp:', error);
    return timestamp;
  }
};

const formatTimestampTick = (timestamp: string): { date: string; time: string } => {
  const formatted = formatTimestamp(timestamp);
  const [date, time, ampm] = formatted.split(' ');
  return {
    date: date ?? formatted,
    time: time && ampm ? `${time} ${ampm}` : '',
  };
};

/**
 * Sparse histories should not stretch two points across a desktop-width card.
 * The plot grows by one point-width per snapshot until it naturally fills the
 * available card; `maxWidth: 100%` keeps larger histories responsive.
 */
export function lineChartWidth(pointCount: number): number {
  return Math.max(340, pointCount * 120 + 100);
}

/**
 * Tick steps a real betting line can actually land on. Spreads and totals move
 * in half-points; American prices move in fives. Larger steps are for series
 * wide enough that the finest increment would crowd the axis.
 */
const TICK_STEPS: Record<LineValueFormat, number[]> = {
  signed: [0.5, 1, 2, 5, 10, 25, 50, 100],
  unsigned: [0.5, 1, 2, 5, 10, 25, 50, 100],
  american: [5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
};

const MAX_TICKS = 6;

export interface LineChartScale {
  domain: [number, number];
  ticks: number[];
}

/**
 * Y scale zoomed to the observed market range, with ticks only on values a book
 * could actually post.
 *
 * Supplying explicit ticks is the point: given only a domain, Recharts divides
 * it into equal intervals and happily labels a spread 28.4. Two rules apply —
 * every tick sits on a legal increment, and no American tick falls in the
 * (-100, +100) dead zone, where no price exists.
 */
export function lineChartScale(values: number[], format: LineValueFormat): LineChartScale {
  if (values.length === 0) return { domain: [0, 1], ticks: [] };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const steps = TICK_STEPS[format];
  const finestStep = steps[0]!;
  // A flat series would otherwise be drawn flush against the axis edge.
  const padding = Math.max(finestStep, (max - min) * 0.15);

  const clampToLegalRange = (lo: number, hi: number): [number, number] => {
    if (format !== 'american') return [lo, hi];
    // Padding a favorite toward zero would cross into impossible prices.
    if (max <= -100) return [lo, Math.min(hi, -100)];
    if (min >= 100) return [Math.max(lo, 100), hi];
    return [lo, hi];
  };

  // Snap the bounds to the finest legal increment, never to the tick step —
  // rounding out to a coarse step balloons the axis far past the real movement.
  const [paddedLo, paddedHi] = clampToLegalRange(min - padding, max + padding);
  const [lo, hi] = clampToLegalRange(
    Math.floor(paddedLo / finestStep) * finestStep,
    Math.ceil(paddedHi / finestStep) * finestStep,
  );

  const ticksForStep = (step: number): number[] => {
    const out: number[] = [];
    const first = Math.ceil(lo / step - 1e-9) * step;
    for (let tick = first; tick <= hi + 1e-9; tick += step) {
      // Accumulated float drift would otherwise render as 28.499999.
      const value = Number(tick.toFixed(2));
      if (format === 'american' && value > -100 && value < 100) continue;
      out.push(value);
    }
    return out;
  };

  const step = steps.find((candidate) => (hi - lo) / candidate <= MAX_TICKS) ?? steps.at(-1)!;
  let ticks = ticksForStep(step);
  // A narrow band can round down to a single tick; drop to a finer increment.
  for (let i = steps.indexOf(step) - 1; ticks.length < 2 && i >= 0; i -= 1) {
    ticks = ticksForStep(steps[i]!);
  }

  return { domain: [lo, hi], ticks };
}

function TimestampTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const { date, time } = formatTimestampTick(String(payload?.value ?? ''));
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text
        textAnchor="middle"
        fill="currentColor"
        className="text-muted-foreground"
        fontSize={10}
        fontWeight={500}
      >
        <tspan x={0} dy={14}>
          {date}
        </tspan>
        <tspan x={0} dy={13}>
          {time}
        </tspan>
      </text>
    </g>
  );
}

function MoveSummary({ market }: { market: LineMarket }) {
  const { open, current, format } = market;
  // A slate-close fallback isn't the live line, so a delta against it is meaningless.
  const isLive = !isSlateCloseFallback(market);
  // American odds aren't linear points — skip a signed "Moved" delta.
  const delta =
    open !== null && current !== null && format !== 'american' && isLive
      ? current - open
      : null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          Open
        </span>
        <span className="text-base font-bold tabular-nums text-muted-foreground">
          {formatLineValue(open, format)}
        </span>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      <div className="flex flex-col">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {market.currentLabel ?? 'Now'}
        </span>
        <span
          className={cn(
            'text-base font-bold tabular-nums',
            isLive ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {formatLineValue(current, format)}
        </span>
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

function NoMovementNote({ market }: { market: LineMarket }) {
  if (market.notPosted) {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {market.label} hasn&apos;t been posted by the books yet for this game.
        It will appear here once Odds-API starts returning this market.
      </p>
    );
  }

  const snaps = market.history.filter((p) => p.value !== null).length;
  const distinct = distinctSeriesValues(market.history).length;
  const firstTs = market.history.find((p) => p.value !== null)?.as_of_ts;

  if (snaps === 0) {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {market.seriesNote ??
          `No archived snapshots for ${market.label} yet — the value shown is the slate close, not a live price.`}
      </p>
    );
  }

  if (snaps >= 2 && distinct < 2) {
    const since = firstTs ? ` since ${formatTimestamp(firstTs)}` : '';
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        No movement across {snaps} snapshots{since}. The chart will appear once the
        consensus line actually moves.
      </p>
    );
  }

  return (
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      Only one snapshot recorded so far — movement will chart once more line pulls
      are archived.
    </p>
  );
}

export interface LineMovementWidgetProps {
  markets: LineMarket[];
  loading: boolean;
  error: string | null;
  /** False when the sport hook never had enough identity to fetch. */
  hasDataSource: boolean;
  subtitle: string;
  /** Re-runs the movement query after a cold-cache timeout. */
  onRetry?: () => void;
  /** Sport-specific team mark (NFL TeamMark / CFB CollegeTeamMark). */
  renderTeamMark?: (team: TeamRef, size: number) => React.ReactNode;
}

/**
 * Shared Line Movement card: two-level market toggle (group → side), Open→Now
 * summary, and a recharts series only when the selected market has ≥2 distinct
 * consensus values.
 */
export function LineMovementWidget({
  markets,
  loading,
  error,
  hasDataSource,
  subtitle,
  onRetry,
  renderTeamMark,
}: LineMovementWidgetProps) {
  const availableGroups = React.useMemo(() => groupsPresent(markets), [markets]);
  const [group, setGroup] = React.useState<LineMarketGroup>('spread');
  const [marketId, setMarketId] = React.useState<LineMarketId | null>(null);

  // Keep selection valid as markets load / change.
  React.useEffect(() => {
    if (markets.length === 0) {
      setMarketId(null);
      return;
    }
    const groupOk = availableGroups.includes(group);
    const nextGroup = groupOk ? group : availableGroups[0]!;
    if (!groupOk) setGroup(nextGroup);

    const inGroup = markets.filter((m) => m.group === nextGroup);
    if (inGroup.length === 0) {
      setMarketId(null);
      return;
    }
    if (!marketId || !inGroup.some((m) => m.id === marketId)) {
      setMarketId(inGroup[0]!.id);
    }
  }, [markets, availableGroups, group, marketId]);

  const groupMarkets = markets.filter((m) => m.group === group);
  const active = markets.find((m) => m.id === marketId) ?? groupMarkets[0] ?? null;
  const showChart = active ? canChartMarket(active) : false;
  const snapshotCount = active
    ? active.history.filter((p) => p.value !== null).length
    : 0;

  const chartData = React.useMemo(() => {
    if (!active || !showChart) return [];
    return active.history
      .filter((p) => p.value !== null)
      .map((p) => ({
        timestamp: p.as_of_ts,
        value: p.value as number,
      }));
  }, [active, showChart]);
  const chartScale = React.useMemo(
    () => lineChartScale(chartData.map((point) => point.value), active?.format ?? 'signed'),
    [active?.format, chartData],
  );

  // The headline reads "… to X now", which would be a lie over a slate close.
  const headline = !active
    ? null
    : isSlateCloseFallback(active)
    ? `No live ${active.label} snapshot yet — showing the slate close.`
    : nflLineMovementHeadline({
        loading,
        error,
        hasTrainingKey: hasDataSource,
        pointCount: Math.max(
          snapshotCount,
          active.open !== null || active.current !== null ? 1 : 0,
        ),
        seriesLabel: active.label,
        isTotal: active.format === 'unsigned',
        valueFormat: active.format,
        openValue: active.open,
        currentValue: active.current,
        snapshotCount,
      });

  const CustomTooltip = ({ active: isActive, payload, label }: any) => {
    if (!isActive || !payload?.length || !active) return null;
    return (
      <div className="rounded-lg border border-border bg-card p-2.5 shadow-lg">
        <p className="text-[11px] font-semibold text-card-foreground">
          {formatTimestamp(String(label))}
        </p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-[11px] tabular-nums" style={{ color: entry.color }}>
            {active.label}: {formatLineValue(entry.value, active.format)}
          </p>
        ))}
        {active.splitsLabel ? (
          <p className="mt-1 text-[10px] text-muted-foreground">{active.splitsLabel}</p>
        ) : null}
      </div>
    );
  };

  const groupAccessory =
    !loading && !error && availableGroups.length > 0 ? (
      <div className="max-w-full overflow-x-auto">
        <SegmentedControl
          size="sm"
          layoutId="line-move-group"
          options={availableGroups.map((g) => ({
            value: g,
            label: LINE_GROUP_LABELS[g],
          }))}
          value={group}
          onChange={(value) => setGroup(value as LineMarketGroup)}
        />
      </div>
    ) : undefined;

  return (
    <WidgetCard
      icon={<TrendingUp />}
      title="Line Movement"
      headline={headline ?? undefined}
      subtitle={subtitle}
      className="@xl:col-span-2"
      accessory={groupAccessory}
      contentClassName="space-y-3"
    >
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : markets.length === 0 || !active ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          No line movement data available for this game.
        </p>
      ) : (
        <>
          {error ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{error}</span>
                {onRetry ? (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="font-semibold underline underline-offset-2"
                  >
                    Retry
                  </button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          {groupMarkets.length > 1 && (
            <SegmentedControl
              size="sm"
              layoutId="line-move-side"
              className="w-fit max-w-full overflow-x-auto"
              options={groupMarkets.map((m) => ({
                value: m.id,
                label: m.shortLabel,
                icon:
                  m.team && renderTeamMark
                    ? renderTeamMark(m.team, 14)
                    : undefined,
              }))}
              value={active.id}
              onChange={(value) => setMarketId(value as LineMarketId)}
            />
          )}

          <div className="space-y-1.5">
            {!active.notPosted ? <MoveSummary market={active} /> : null}
            {active.latestBookCount != null && !active.notPosted ? (
              <p className="text-[10px] text-muted-foreground">
                Latest consensus across {active.latestBookCount}{' '}
                {active.latestBookCount === 1 ? 'book' : 'books'}
              </p>
            ) : null}
          </div>

          {active.splitsLabel && !showChart ? (
            <p className="text-[11px] text-muted-foreground">{active.splitsLabel}</p>
          ) : null}

          {showChart ? (
            <div
              className="h-64"
              style={{
                width: lineChartWidth(chartData.length),
                maxWidth: '100%',
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 28, left: 8, bottom: 24 }}>
                  <CartesianGrid
                    strokeDasharray="2 4"
                    stroke="currentColor"
                    strokeOpacity={0.15}
                    vertical={false}
                    className="text-muted-foreground"
                  />
                  <XAxis
                    dataKey="timestamp"
                    tick={<TimestampTick />}
                    axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                    tickLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                    minTickGap={28}
                    height={48}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fontWeight: 600, fill: 'currentColor' }}
                    axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                    tickLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                    tickFormatter={(value) => formatLineValue(Number(value), active.format)}
                    domain={chartScale.domain}
                    ticks={chartScale.ticks}
                    width={active.format === 'american' ? 56 : 48}
                    className="text-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="linear"
                    dataKey="value"
                    stroke={active.color}
                    strokeWidth={2.5}
                    dot={{ fill: active.color, r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: active.color, strokeWidth: 0 }}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <NoMovementNote market={active} />
          )}
        </>
      )}
    </WidgetCard>
  );
}
