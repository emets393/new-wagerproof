import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  usePlayerPropGradeSummary,
  usePlayerPropGradeHistory,
  type GradeRow,
  type GradeSummaryRow,
  type Tier,
} from '@/hooks/usePlayerPropPerformance';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPropOdds } from '@/utils/mlbPlayerProps';
import { cn } from '@/lib/utils';

const TIER_LABEL: Record<Tier, string> = {
  elite: '🔥 Elite',
  strong: '⭐ Strong',
  lean: '👍 Lean',
};
const TIER_ORDER: Tier[] = ['elite', 'strong', 'lean'];

function fmtUnits(v: number | null | undefined, signed = true): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const n = Number(v);
  const s = (Math.round(n * 100) / 100).toFixed(2);
  if (!signed) return `${s}u`;
  return `${n >= 0 ? '+' : ''}${s}u`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const n = Number(v);
  return `${n >= 0 ? '' : ''}${n.toFixed(1)}%`;
}

function toneOf(units: number | null | undefined): string {
  if (units == null || !Number.isFinite(units)) return 'text-muted-foreground';
  if (units > 0) return 'text-primary font-bold';
  if (units < 0) return 'text-red-500 font-bold';
  return 'text-muted-foreground';
}

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
    const list = (map.get(tier) ?? []).sort((a, b) =>
      (b.units_won ?? 0) - (a.units_won ?? 0),
    );
    if (list.length === 0) continue;
    result.push({ tier, totals: aggregate(list), markets: list });
  }
  return result;
}

function TopRow({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{title}</p>
      <p className={cn('text-xl sm:text-2xl font-bold tabular-nums leading-tight', tone)}>
        {value}
      </p>
      {sub ? <p className="text-[11px] text-muted-foreground tabular-nums">{sub}</p> : null}
    </div>
  );
}

function MarketTable({ rows }: { rows: GradeSummaryRow[] }) {
  return (
    <div className="rounded-md border border-border/50 overflow-hidden">
      <table className="w-full text-xs tabular-nums">
        <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left px-2 py-1.5 font-medium">Market</th>
            <th className="text-right px-2 py-1.5 font-medium">Picks</th>
            <th className="text-right px-2 py-1.5 font-medium">W-L-P</th>
            <th className="text-right px-2 py-1.5 font-medium">Win%</th>
            <th className="text-right px-2 py-1.5 font-medium">Stake</th>
            <th className="text-right px-2 py-1.5 font-medium">Units</th>
            <th className="text-right px-2 py-1.5 font-medium">ROI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={`${r.market}`} className="border-t border-border/40">
              <td className="px-2 py-1.5">
                <span className="font-medium">{r.market_label}</span>{' '}
                <span className="text-muted-foreground text-[10px]">
                  ({r.kind === 'pitcher' ? '⚾' : '🥎'})
                </span>
              </td>
              <td className="px-2 py-1.5 text-right">{r.picks_total}</td>
              <td className="px-2 py-1.5 text-right">
                {r.picks_won}-{r.picks_lost}-{r.picks_push}
              </td>
              <td className="px-2 py-1.5 text-right">{fmtPct(r.win_pct)}</td>
              <td className="px-2 py-1.5 text-right">{fmtUnits(r.units_staked, false)}</td>
              <td className={cn('px-2 py-1.5 text-right', toneOf(r.units_won))}>
                {fmtUnits(r.units_won)}
              </td>
              <td className={cn('px-2 py-1.5 text-right', toneOf(r.units_won))}>
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
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No graded picks yet. The morning cron will populate this once games settle.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="rounded-md border border-border/50 overflow-hidden">
      <table className="w-full text-xs tabular-nums">
        <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left px-2 py-1.5 font-medium">Date</th>
            <th className="text-left px-2 py-1.5 font-medium">Player</th>
            <th className="text-left px-2 py-1.5 font-medium">Market</th>
            <th className="text-left px-2 py-1.5 font-medium">Tier</th>
            <th className="text-right px-2 py-1.5 font-medium" title="American odds at lock time. Negative = favorite, positive = underdog.">Odds</th>
            <th className="text-right px-2 py-1.5 font-medium">Actual</th>
            <th className="text-left px-2 py-1.5 font-medium">Result</th>
            <th className="text-right px-2 py-1.5 font-medium">Units</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr
              key={`${r.report_date}-${r.game_pk}-${r.player_id}-${r.market}`}
              className="border-t border-border/40"
            >
              <td className="px-2 py-1.5">{r.report_date}</td>
              <td className="px-2 py-1.5">
                <span className="font-medium">{r.player_name ?? '—'}</span>{' '}
                <span className="text-muted-foreground text-[10px]">
                  {r.team_name ?? ''}
                </span>
              </td>
              <td className="px-2 py-1.5">
                {r.market_label ?? r.market} O {r.line}
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
              <td className="px-2 py-1.5 text-right">{formatPropOdds(r.over_odds)}</td>
              <td className="px-2 py-1.5 text-right">{r.actual_value ?? '—'}</td>
              <td className="px-2 py-1.5">
                <span
                  className={cn(
                    'text-[11px] font-semibold uppercase tracking-wide',
                    r.result === 'won' && 'text-primary',
                    r.result === 'lost' && 'text-red-500',
                    r.result === 'push' && 'text-muted-foreground',
                    r.result === 'pending' && 'text-muted-foreground italic',
                  )}
                >
                  {r.result ?? '—'}
                </span>
              </td>
              <td className={cn('px-2 py-1.5 text-right', toneOf(r.units_won))}>
                {fmtUnits(r.units_won)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PlayerPropsPerformance() {
  const { data: summary = [], isLoading: summaryLoading } = usePlayerPropGradeSummary();
  const { data: history = [], isLoading: historyLoading } = usePlayerPropGradeHistory(200);

  const overall = useMemo(() => aggregate(summary), [summary]);
  const grouped = useMemo(() => groupByTier(summary), [summary]);
  const hasData = summary.length > 0;

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl space-y-5 sm:space-y-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold leading-tight">
            📊 Best Picks Performance
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Graded results of every locked Best Picks Report pick. Stakes:{' '}
            <span className="text-foreground font-semibold">Lean 0.5u · Strong 1.0u · Elite 1.5u</span>.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button asChild size="sm" variant="outline">
            <Link to="/mlb/picks-report">🎯 Today&apos;s picks</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/mlb/pitcher-matchups">Matchups</Link>
          </Button>
        </div>
      </div>

      {summaryLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !hasData ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-1">
            <p className="text-lg">No graded picks yet.</p>
            <p className="text-xs">
              Picks lock automatically when their games start, and the morning grader writes results
              to this page after games settle.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <TopRow
              title="Settled picks"
              value={String(overall.settled)}
              sub={`${overall.won}-${overall.lost}-${overall.push} W-L-P`}
            />
            <TopRow
              title="Win rate"
              value={fmtPct(overall.win_pct)}
              sub="excludes pushes"
            />
            <TopRow
              title="Units won"
              value={fmtUnits(overall.units_won)}
              sub={`on ${fmtUnits(overall.units_staked, false)} staked`}
              tone={toneOf(overall.units_won)}
            />
            <TopRow
              title="ROI"
              value={fmtPct(overall.roi_pct)}
              sub="units_won ÷ stake"
              tone={toneOf(overall.units_won)}
            />
          </div>

          {grouped.map(g => (
            <section key={g.tier} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg sm:text-xl font-bold">{TIER_LABEL[g.tier]}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {g.totals.settled} settled · {g.totals.won}-{g.totals.lost}-{g.totals.push} ·{' '}
                  <span className={toneOf(g.totals.units_won)}>
                    {fmtUnits(g.totals.units_won)}
                  </span>{' '}
                  ({fmtPct(g.totals.roi_pct)} ROI)
                </span>
              </div>
              <MarketTable rows={g.markets} />
            </section>
          ))}

          <section className="space-y-2">
            <h2 className="text-lg sm:text-xl font-bold">Recent graded picks</h2>
            {historyLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <HistoryTable rows={history} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
