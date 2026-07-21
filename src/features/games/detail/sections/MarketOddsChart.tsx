// Prediction-market odds for the detail pane: a HeroUI-chromed replacement for
// the legacy PolymarketWidget's chart block.
//
// HeroUI ships no chart primitives (286 exports, none chart-related, and
// @heroui/chart / @heroui/charts do not exist on npm) — the "charts" in its docs
// are Recharts examples wearing HeroUI chrome. This does the same: Recharts for
// the plot, HeroUI Tabs/Chip/Tooltip for everything around it.
import * as React from 'react';
import { Chip, Tab, Tabs, Tooltip as HeroTooltip } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAllMarketsData } from '@/services/polymarketService';
import type { PolymarketTimeSeriesData } from '@/types/polymarket';
import type { GameFeedItem } from '../../types';

type MarketKey = 'moneyline' | 'spread' | 'total';

const MARKET_LABELS: Record<MarketKey, string> = {
  moneyline: 'Moneyline',
  spread: 'Spread',
  total: 'Total',
};

/** Over/Under rather than team names — the two series aren't teams on a total. */
function seriesLabels(market: MarketKey, awayAbbrev: string, homeAbbrev: string) {
  if (market === 'total') return { a: 'Over', b: 'Under' };
  return { a: awayAbbrev, b: homeAbbrev };
}

function formatTick(ts: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric' }).format(ts);
}

interface ChartPoint {
  t: number;
  a: number;
  b: number;
}

function ChartTooltip({
  active,
  payload,
  label,
  labels,
  colorA,
  colorB,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: number;
  labels: { a: string; b: string };
  colorA: string;
  colorB: string;
}) {
  if (!active || !payload?.length) return null;
  const a = payload.find((p) => p.dataKey === 'a')?.value;
  const b = payload.find((p) => p.dataKey === 'b')?.value;
  return (
    <div className="rounded-lg border border-black/10 bg-background/95 px-2.5 py-1.5 shadow-md backdrop-blur-md dark:border-white/15">
      <div className="mb-1 text-[10px] font-semibold text-muted-foreground">
        {label ? new Date(label).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' }) : ''}
      </div>
      {a !== undefined && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold tabular-nums">
          <span className="h-2 w-2 rounded-full" style={{ background: colorA }} />
          {labels.a} {a.toFixed(1)}%
        </div>
      )}
      {b !== undefined && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold tabular-nums">
          <span className="h-2 w-2 rounded-full" style={{ background: colorB }} />
          {labels.b} {b.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

/** Current implied probability for each side, as the chart's headline. */
function OddsHeadline({
  labels,
  a,
  b,
  colorA,
  colorB,
}: {
  labels: { a: string; b: string };
  a: number;
  b: number;
  colorA: string;
  colorB: string;
}) {
  const aLeads = a >= b;
  return (
    <div className="flex items-stretch gap-2">
      {([
        { label: labels.a, value: a, color: colorA, leads: aLeads },
        { label: labels.b, value: b, color: colorB, leads: !aLeads },
      ] as const).map((side) => (
        <div
          key={side.label}
          className={cn(
            'flex flex-1 flex-col gap-0.5 rounded-xl border px-3 py-2 transition-colors',
            side.leads
              ? 'border-black/10 bg-muted/60 dark:border-white/15'
              : 'border-transparent bg-muted/25',
          )}
        >
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: side.color }} />
            <span className="truncate">{side.label}</span>
          </span>
          <span
            className={cn(
              'text-xl font-bold tabular-nums',
              side.leads ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {side.value.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function MarketOddsChart({ game }: { game: GameFeedItem }) {
  const [market, setMarket] = React.useState<MarketKey>('moneyline');

  // Same query key as PolymarketSparkline, so the feed card's fetch is reused.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['polymarket-all', game.sport, game.awayTeam.name, game.homeTeam.name],
    queryFn: () => getAllMarketsData(game.awayTeam.name, game.homeTeam.name, game.sport),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const available = React.useMemo(
    () =>
      (['moneyline', 'spread', 'total'] as MarketKey[]).filter(
        (k) => (data?.[k] as PolymarketTimeSeriesData | undefined)?.data?.length,
      ),
    [data],
  );

  // The selected market can vanish between refreshes; fall back to the first live one.
  const activeKey = available.includes(market) ? market : available[0];
  const active = activeKey ? (data?.[activeKey] as PolymarketTimeSeriesData | undefined) : undefined;

  const colorA = game.awayTeam.colors.primary;
  const colorB = game.homeTeam.colors.primary;

  const points = React.useMemo<ChartPoint[]>(
    () =>
      (active?.data ?? []).map((p) => ({
        t: p.timestamp,
        a: p.awayTeamOdds,
        b: p.homeTeamOdds,
      })),
    [active],
  );

  if (isLoading) {
    return <div className="h-[232px] animate-pulse rounded-xl bg-muted/50" />;
  }
  if (isError || !active || !activeKey || points.length < 2) {
    return (
      <p className="py-6 text-center text-[13px] text-muted-foreground">
        No prediction-market data for this game yet.
      </p>
    );
  }

  const labels = seriesLabels(activeKey, game.awayTeam.abbrev, game.homeTeam.abbrev);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {available.length > 1 && (
          <Tabs
            aria-label="Market"
            size="sm"
            radius="md"
            selectedKey={activeKey}
            onSelectionChange={(key) => setMarket(key as MarketKey)}
          >
            {available.map((k) => (
              <Tab key={k} title={MARKET_LABELS[k]} />
            ))}
          </Tabs>
        )}
        <HeroTooltip
          content="Live implied probability from Polymarket traders, not a sportsbook line."
          placement="top"
          size="sm"
        >
          <Chip
            size="sm"
            variant="flat"
            startContent={<Info className="h-3 w-3" />}
            classNames={{ content: 'font-semibold' }}
          >
            Polymarket
          </Chip>
        </HeroTooltip>
      </div>

      <OddsHeadline
        labels={labels}
        a={active.currentAwayOdds}
        b={active.currentHomeOdds}
        colorA={colorA}
        colorB={colorB}
      />

      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
            <defs>
              {/* Fills fade out downward so the two bands stay readable where they overlap. */}
              <linearGradient id="mo-a" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colorA} stopOpacity={0.35} />
                <stop offset="100%" stopColor={colorA} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="mo-b" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colorB} stopOpacity={0.35} />
                <stop offset="100%" stopColor={colorB} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="currentColor" className="text-muted-foreground/15" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatTick}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground/60"
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground/60"
              tickLine={false}
              axisLine={false}
              width={44}
            />
            {/* 50% is the coin-flip line — where the market is undecided. */}
            <ReferenceLine y={50} stroke="currentColor" strokeDasharray="3 3" className="text-muted-foreground/30" />
            <Tooltip
              content={<ChartTooltip labels={labels} colorA={colorA} colorB={colorB} />}
              cursor={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
            />
            <Area type="monotone" dataKey="a" stroke={colorA} strokeWidth={2} fill="url(#mo-a)" isAnimationActive={false} />
            <Area type="monotone" dataKey="b" stroke={colorB} strokeWidth={2} fill="url(#mo-b)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
