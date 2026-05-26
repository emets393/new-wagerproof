// Compact performance summary — KPI tiles + per-tier rollup line. Used at the
// top of the Best Picks Report so users see how the algo has performed without
// leaving the page. The full graded history lives on /mlb/picks-performance.
import React from 'react';
import {
  usePlayerPropGradeSummary,
  type GradeSummaryRow,
  type Tier,
} from '@/hooks/usePlayerPropPerformance';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const TIER_ORDER: Tier[] = ['elite', 'strong', 'lean'];
const TIER_LABEL: Record<Tier, string> = {
  elite: '🔥 Elite',
  strong: '⭐ Strong',
  lean: '👍 Lean',
};

function fmtUnits(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}${(Math.round(n * 100) / 100).toFixed(2)}u`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${Number(v).toFixed(1)}%`;
}

function tone(units: number | null | undefined): string {
  if (units == null || !Number.isFinite(units)) return 'text-muted-foreground';
  if (units > 0) return 'text-primary';
  if (units < 0) return 'text-red-500';
  return 'text-muted-foreground';
}

function aggregate(rows: GradeSummaryRow[]) {
  let picks = 0, won = 0, lost = 0, push = 0;
  let units_staked = 0, units_won = 0;
  for (const r of rows) {
    picks += r.picks_total ?? 0;
    won += r.picks_won ?? 0;
    lost += r.picks_lost ?? 0;
    push += r.picks_push ?? 0;
    units_staked += Number(r.units_staked ?? 0);
    units_won += Number(r.units_won ?? 0);
  }
  return {
    picks, won, lost, push,
    settled: won + lost + push,
    units_staked, units_won,
    win_pct: won + lost > 0 ? (won / (won + lost)) * 100 : null,
    roi_pct: units_staked > 0 ? (units_won / units_staked) * 100 : null,
  };
}

function Kpi({ label, value, sub, valueTone }: { label: string; value: string; sub?: string; valueTone?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p className={cn('text-lg sm:text-xl font-bold tabular-nums leading-tight', valueTone)}>
        {value}
      </p>
      {sub ? <p className="text-[11px] text-muted-foreground tabular-nums">{sub}</p> : null}
    </div>
  );
}

export function PerformanceSummary() {
  const { data: rows = [], isLoading } = usePlayerPropGradeSummary();

  const overall = aggregate(rows);
  const byTier = TIER_ORDER.map(t => ({
    tier: t,
    totals: aggregate(rows.filter(r => r.tier === t)),
  }));

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (overall.settled === 0) {
    return (
      <Card>
        <CardContent className="py-4 text-center text-xs text-muted-foreground">
          📊 Performance tracking is live. Once a few picks settle, win-rate and ROI numbers will show up here.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-3 pb-3 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            📊 Algorithm performance to date
          </p>
          <a
            href="/mlb/picks-performance"
            className="text-[11px] text-primary hover:underline tabular-nums"
          >
            full history →
          </a>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Kpi
            label="Settled picks"
            value={String(overall.settled)}
            sub={`${overall.won}-${overall.lost}-${overall.push} W-L-P`}
          />
          <Kpi
            label="Win rate"
            value={fmtPct(overall.win_pct)}
            sub="excludes pushes"
          />
          <Kpi
            label="Units won"
            value={fmtUnits(overall.units_won)}
            sub={`on ${overall.units_staked.toFixed(2)}u staked`}
            valueTone={tone(overall.units_won)}
          />
          <Kpi
            label="ROI"
            value={fmtPct(overall.roi_pct)}
            sub="units ÷ stake"
            valueTone={tone(overall.units_won)}
          />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums pt-1">
          {byTier
            .filter(t => t.totals.settled > 0)
            .map(t => (
              <span key={t.tier}>
                {TIER_LABEL[t.tier]}{' '}
                <span className="text-foreground font-semibold">
                  {t.totals.won}-{t.totals.lost}-{t.totals.push}
                </span>{' '}
                <span className={tone(t.totals.units_won)}>{fmtUnits(t.totals.units_won)}</span>
                {t.totals.roi_pct != null ? (
                  <span className={tone(t.totals.units_won)}> ({fmtPct(t.totals.roi_pct)} ROI)</span>
                ) : null}
              </span>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
