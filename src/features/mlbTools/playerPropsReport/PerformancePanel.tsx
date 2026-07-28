import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GlassCard, WidgetCard } from '@/components/ios';
import {
  usePlayerPropGradeHistory,
  usePlayerPropGradeSummary,
  type GradeRow,
  type GradeSummaryRow,
  type Tier,
} from '@/hooks/usePlayerPropPerformance';
import { cn } from '@/lib/utils';
import { formatPropOdds } from '@/utils/mlbPlayerProps';
import {
  fmtPct,
  fmtUnits,
  STAKE_LEGEND,
  TIER_LABEL,
  TIER_ORDER,
  unitsTone,
} from './format';

function aggregate(rows: GradeSummaryRow[]) {
  const totals = {
    picks: 0,
    won: 0,
    lost: 0,
    push: 0,
    units_staked: 0,
    units_won: 0,
  };
  for (const r of rows) {
    totals.picks += r.picks_total ?? 0;
    totals.won += r.picks_won ?? 0;
    totals.lost += r.picks_lost ?? 0;
    totals.push += r.picks_push ?? 0;
    totals.units_staked += Number(r.units_staked ?? 0);
    totals.units_won += Number(r.units_won ?? 0);
  }
  const settled = totals.won + totals.lost + totals.push;
  return {
    ...totals,
    settled,
    win_pct: totals.won + totals.lost > 0 ? (totals.won / (totals.won + totals.lost)) * 100 : null,
    roi_pct: totals.units_staked > 0 ? (totals.units_won / totals.units_staked) * 100 : null,
  };
}

interface GroupedSummary {
  tier: Tier;
  totals: ReturnType<typeof aggregate>;
  markets: GradeSummaryRow[];
}

function groupByTier(rows: GradeSummaryRow[]): GroupedSummary[] {
  const map = new Map<Tier, GradeSummaryRow[]>();
  for (const r of rows) {
    if (!r.tier) continue;
    const list = map.get(r.tier) ?? [];
    list.push(r);
    map.set(r.tier, list);
  }
  const result: GroupedSummary[] = [];
  for (const tier of TIER_ORDER) {
    const list = (map.get(tier) ?? []).sort(
      (a, b) => (b.units_won ?? 0) - (a.units_won ?? 0),
    );
    if (list.length === 0) continue;
    result.push({ tier, totals: aggregate(list), markets: list });
  }
  return result;
}

function Kpi({
  title,
  value,
  sub,
  tone,
}: {
  title: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-black/5 bg-muted/30 px-3 py-2.5 dark:border-white/10">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className={cn('text-xl font-bold leading-tight tabular-nums sm:text-2xl', tone)}>
        {value}
      </p>
      {sub ? <p className="text-[11px] tabular-nums text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function MarketTable({ rows }: { rows: GradeSummaryRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/5 dark:border-white/10">
      <table className="w-full text-xs tabular-nums">
        <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">Market</th>
            <th className="px-2 py-1.5 text-right font-medium">Picks</th>
            <th className="px-2 py-1.5 text-right font-medium">W-L-P</th>
            <th className="px-2 py-1.5 text-right font-medium">Win%</th>
            <th className="px-2 py-1.5 text-right font-medium">Stake</th>
            <th className="px-2 py-1.5 text-right font-medium">Units</th>
            <th className="px-2 py-1.5 text-right font-medium">ROI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.market} className="border-t border-black/5 dark:border-white/10">
              <td className="px-2 py-1.5 font-medium">{r.market_label}</td>
              <td className="px-2 py-1.5 text-right">{r.picks_total}</td>
              <td className="px-2 py-1.5 text-right">
                {r.picks_won}-{r.picks_lost}-{r.picks_push}
              </td>
              <td className="px-2 py-1.5 text-right">{fmtPct(r.win_pct)}</td>
              <td className="px-2 py-1.5 text-right">{fmtUnits(r.units_staked, false)}</td>
              <td className={cn('px-2 py-1.5 text-right', unitsTone(r.units_won))}>
                {fmtUnits(r.units_won)}
              </td>
              <td className={cn('px-2 py-1.5 text-right', unitsTone(r.units_won))}>
                {fmtPct(r.roi_pct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTable({ rows }: { rows: GradeRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No graded picks yet. Results appear after games settle.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto overflow-hidden rounded-xl border border-black/5 dark:border-white/10">
      <table className="w-full min-w-[640px] text-xs tabular-nums">
        <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">Date</th>
            <th className="px-2 py-1.5 text-left font-medium">Player</th>
            <th className="px-2 py-1.5 text-left font-medium">Market</th>
            <th className="px-2 py-1.5 text-left font-medium">Tier</th>
            <th className="px-2 py-1.5 text-right font-medium">Odds</th>
            <th className="px-2 py-1.5 text-right font-medium">Actual</th>
            <th className="px-2 py-1.5 text-left font-medium">Result</th>
            <th className="px-2 py-1.5 text-right font-medium">Units</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.report_date}-${r.game_pk}-${r.player_id}-${r.market}`}
              className="border-t border-black/5 dark:border-white/10"
            >
              <td className="px-2 py-1.5">{r.report_date}</td>
              <td className="px-2 py-1.5">
                <span className="font-medium">{r.player_name ?? '—'}</span>{' '}
                <span className="text-[10px] text-muted-foreground">{r.team_name ?? ''}</span>
              </td>
              <td className="px-2 py-1.5">
                {r.market_label ?? r.market} {r.side === 'under' ? 'U' : 'O'} {r.line}
              </td>
              <td className="px-2 py-1.5">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    r.tier === 'elite' && 'border-primary text-primary',
                    r.tier === 'strong' && 'border-primary/60 text-primary',
                    r.tier === 'lean' && 'border-border text-muted-foreground',
                  )}
                >
                  {r.tier ? TIER_LABEL[r.tier] : '—'}
                </Badge>
              </td>
              <td className="px-2 py-1.5 text-right">
                {formatPropOdds(r.side === 'under' ? r.under_odds : r.over_odds)}
              </td>
              <td className="px-2 py-1.5 text-right">{r.actual_value ?? '—'}</td>
              <td className="px-2 py-1.5">
                <span
                  className={cn(
                    'text-[11px] font-semibold uppercase tracking-wide',
                    r.result === 'won' && 'text-emerald-600 dark:text-emerald-300',
                    r.result === 'lost' && 'text-red-600 dark:text-red-300',
                    (r.result === 'push' || r.result === 'pending') && 'text-muted-foreground',
                    r.result === 'pending' && 'italic',
                  )}
                >
                  {r.result ?? '—'}
                </span>
              </td>
              <td className={cn('px-2 py-1.5 text-right', unitsTone(r.units_won))}>
                {fmtUnits(r.units_won)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PerformancePanel() {
  const { data: summary = [], isLoading: summaryLoading } = usePlayerPropGradeSummary();
  const { data: history = [], isLoading: historyLoading } = usePlayerPropGradeHistory(200);

  const overall = React.useMemo(() => aggregate(summary), [summary]);
  const grouped = React.useMemo(() => groupByTier(summary), [summary]);
  const hasData = summary.length > 0;

  if (summaryLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <GlassCard radius={20} className="px-4 py-12 text-center">
        <p className="text-lg font-semibold text-foreground">No graded picks yet</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          Picks lock when their games start. The morning grader writes results here after games
          settle. Stakes: {STAKE_LEGEND}.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-5">
      <WidgetCard
        title="Algorithm performance"
        subtitle={`Graded results of every locked Best Picks pick. Stakes: ${STAKE_LEGEND}.`}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <Kpi
            title="Settled picks"
            value={String(overall.settled)}
            sub={`${overall.won}-${overall.lost}-${overall.push} W-L-P`}
          />
          <Kpi title="Win rate" value={fmtPct(overall.win_pct)} sub="excludes pushes" />
          <Kpi
            title="Units won"
            value={fmtUnits(overall.units_won)}
            sub={`on ${fmtUnits(overall.units_staked, false)} staked`}
            tone={unitsTone(overall.units_won)}
          />
          <Kpi
            title="ROI"
            value={fmtPct(overall.roi_pct)}
            sub="units ÷ stake"
            tone={unitsTone(overall.units_won)}
          />
        </div>
      </WidgetCard>

      {grouped.map((g) => (
        <section key={g.tier} className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold tracking-tight sm:text-lg">
              {TIER_LABEL[g.tier]}
            </h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {g.totals.settled} settled · {g.totals.won}-{g.totals.lost}-{g.totals.push} ·{' '}
              <span className={unitsTone(g.totals.units_won)}>{fmtUnits(g.totals.units_won)}</span>{' '}
              ({fmtPct(g.totals.roi_pct)} ROI)
            </span>
          </div>
          <MarketTable rows={g.markets} />
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="text-base font-bold tracking-tight sm:text-lg">Recent graded picks</h2>
        {historyLoading ? <Skeleton className="h-40 w-full rounded-2xl" /> : <HistoryTable rows={history} />}
      </section>
    </div>
  );
}
