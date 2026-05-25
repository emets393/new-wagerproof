import React from 'react';
import type { BatterSplitRow, LeagueBenchmarks } from '@/types/mlb-matchups';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { BarChart3 } from 'lucide-react';
import { formatPct, formatRate, hasEnoughPa } from '@/utils/mlbPitcherMatchups';
import { resolveBenchmark } from '@/hooks/useLeagueBenchmarks';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SeasonStatsAccordionProps {
  split: BatterSplitRow | undefined;
  benchmarks: LeagueBenchmarks;
  opposingStarterHand?: string | null;
}

interface BenchTilesProps {
  label: string;
  seasonValue: number | null | undefined;
  recentValue: number | null | undefined;
  formatted: (v: number | null | undefined) => string;
  benchmark?: { p10?: number; p25?: number; p50?: number; p75?: number; p90?: number } | null;
  /** Higher is better unless this is K% etc. */
  lowerIsBetter?: boolean;
  tooltip: string;
}

function percentileBucket(
  value: number | null | undefined,
  bench: BenchTilesProps['benchmark'],
  lowerIsBetter = false,
): 'elite' | 'good' | 'neutral' | 'poor' | null {
  if (value == null || !Number.isFinite(value) || !bench) return null;
  const { p10, p25, p75, p90 } = bench;
  const order = (a?: number, b?: number) => (a == null || b == null ? null : a < b);
  if (lowerIsBetter) {
    if (p10 != null && value <= p10) return 'elite';
    if (p25 != null && value <= p25) return 'good';
    if (p75 != null && value >= p75) return 'poor';
    return 'neutral';
  }
  if (p90 != null && value >= p90) return 'elite';
  if (p75 != null && value >= p75) return 'good';
  if (p25 != null && value <= p25) return 'poor';
  if (order(value, p10)) return 'poor';
  return 'neutral';
}

function deltaTone(
  delta: number | null,
  lowerIsBetter: boolean,
  threshold = 0.005,
): 'good' | 'bad' | 'neutral' {
  if (delta == null) return 'neutral';
  if (Math.abs(delta) < threshold) return 'neutral';
  const isPositive = delta > 0;
  if (lowerIsBetter) return isPositive ? 'bad' : 'good';
  return isPositive ? 'good' : 'bad';
}

function StatTile({
  label,
  seasonValue,
  recentValue,
  formatted,
  benchmark,
  lowerIsBetter = false,
  tooltip,
}: BenchTilesProps) {
  const bucket = percentileBucket(
    seasonValue == null ? null : Number(seasonValue),
    benchmark,
    lowerIsBetter,
  );
  const delta =
    recentValue != null && seasonValue != null
      ? Number(recentValue) - Number(seasonValue)
      : null;
  const tone = deltaTone(delta, lowerIsBetter);
  return (
    <div
      title={tooltip}
      className={cn(
        'rounded-md border px-2.5 py-2 cursor-help',
        bucket === 'elite' && 'border-primary/60 bg-primary/10',
        bucket === 'good' && 'border-primary/40 bg-primary/5',
        bucket === 'neutral' && 'border-border/50 bg-card/40',
        bucket === 'poor' && 'border-red-500/40 bg-red-500/5',
        !bucket && 'border-border/50 bg-card/40',
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-bold tabular-nums leading-tight mt-0.5">
        {formatted(seasonValue)}
      </p>
      {delta != null && Number.isFinite(delta) ? (
        <p
          className={cn(
            'text-[10px] tabular-nums leading-tight',
            tone === 'good' && 'text-primary font-semibold',
            tone === 'bad' && 'text-red-500 font-semibold',
            tone === 'neutral' && 'text-muted-foreground',
          )}
        >
          L10 {delta >= 0 ? '+' : ''}{formatted(delta).replace(/^[-+]/, '')}
          {tone === 'good' ? ' ▲' : tone === 'bad' ? ' ▼' : ''}
        </p>
      ) : recentValue != null ? (
        <p className="text-[10px] text-muted-foreground tabular-nums leading-tight">
          L10 {formatted(recentValue)}
        </p>
      ) : null}
    </div>
  );
}

function bench(benchmarks: LeagueBenchmarks, key: string) {
  return resolveBenchmark(benchmarks, key) as
    | { p10?: number; p25?: number; p50?: number; p75?: number; p90?: number }
    | null;
}

export function SeasonStatsAccordion({
  split,
  benchmarks,
  opposingStarterHand,
}: SeasonStatsAccordionProps) {
  if (!split || !hasEnoughPa(split.pa)) return null;
  const recent = split.recent_form;
  const opp = opposingStarterHand === 'L' ? 'LHP' : opposingStarterHand === 'R' ? 'RHP' : null;

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="bstats" className="border-0">
        <AccordionTrigger
          className={cn(
            'w-full rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20',
            'px-3 py-2.5 text-sm font-semibold text-foreground hover:no-underline',
            'data-[state=open]:bg-primary/15 transition-colors',
          )}
        >
          <span className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span>Batter stats &amp; recent form</span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="pt-3 pb-1 space-y-3">
          <TooltipProvider delayDuration={200}>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>
                Split vs <span className="text-foreground font-semibold">{opp ?? 'opposing SP hand'}</span>
              </span>
              <span>·</span>
              <span className="tabular-nums">{split.pa} PA this season</span>
              {recent && recent.games_used > 0 ? (
                <>
                  <span>·</span>
                  <span className="tabular-nums">L10 form from {recent.games_used} games</span>
                </>
              ) : null}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <StatTile
                label="xwOBA"
                seasonValue={split.xwoba}
                recentValue={recent?.xwoba ?? null}
                formatted={formatRate}
                benchmark={bench(benchmarks, 'xwoba')}
                tooltip="Expected weighted on-base average — quality of contact. Higher is better. Shaded green if elite (top quartile this season vs this hand)."
              />
              <StatTile
                label="Barrel%"
                seasonValue={split.barrel_pct}
                recentValue={recent?.barrel_pct ?? null}
                formatted={formatPct}
                benchmark={bench(benchmarks, 'barrel_pct')}
                tooltip="Percent of batted balls hit with 'barrel' contact — the high-launch / high-exit-velo combo that turns into XBH at the highest rate."
              />
              <StatTile
                label="Hard-hit%"
                seasonValue={split.hard_hit_pct}
                recentValue={recent?.hard_hit_pct ?? null}
                formatted={formatPct}
                benchmark={bench(benchmarks, 'hard_hit_pct')}
                tooltip="Percent of batted balls hit at 95+ mph. Higher means more authority on contact."
              />
              <StatTile
                label="Exit velo"
                seasonValue={split.avg_exit_velo}
                recentValue={recent?.avg_exit_velo ?? null}
                formatted={v => (v == null ? '—' : `${Number(v).toFixed(1)} mph`)}
                benchmark={bench(benchmarks, 'avg_exit_velo')}
                tooltip="Average exit velocity off the bat. Higher is better contact quality."
              />
              <StatTile
                label="Pull-air%"
                seasonValue={split.pull_air_pct}
                recentValue={recent?.pull_air_pct ?? null}
                formatted={formatPct}
                benchmark={bench(benchmarks, 'pull_air_pct')}
                tooltip="Share of batted balls pulled in the air — the kind of contact that produces home runs."
              />
              <StatTile
                label="K%"
                seasonValue={split.k_pct}
                recentValue={recent?.k_pct ?? null}
                formatted={formatPct}
                benchmark={bench(benchmarks, 'k_pct')}
                lowerIsBetter
                tooltip="Strikeout rate. Lower is better. ▼ in red on L10 means more strikeouts than season norm; ▲ in green means trending up (striking out less)."
              />
              <StatTile
                label="ISO"
                seasonValue={split.iso}
                recentValue={null}
                formatted={formatRate}
                benchmark={bench(benchmarks, 'iso')}
                tooltip="Isolated power (SLG − AVG). Pure power output, independent of singles."
              />
              <StatTile
                label="OPS"
                seasonValue={split.ops}
                recentValue={null}
                formatted={formatRate}
                benchmark={bench(benchmarks, 'ops')}
                tooltip="On-base plus slugging — the catch-all rate for overall offensive value."
              />
              <StatTile
                label="BB%"
                seasonValue={split.bb_pct}
                recentValue={recent?.bb_pct ?? null}
                formatted={formatPct}
                benchmark={bench(benchmarks, 'bb_pct')}
                tooltip="Walk rate. Higher is better — sign of plate discipline."
              />
            </div>

            {split.ops_delta_vs_other_hand != null && split.platoon_signal ? (
              <div
                className="text-[11px] text-muted-foreground"
                title="Platoon delta compares this batter's OPS vs this hand to his OPS vs the other hand. Strong positive deltas indicate matchups where he hits this hand notably better."
              >
                Platoon signal:{' '}
                <span className="font-semibold text-foreground">
                  {split.platoon_signal.replace(/_/g, ' ')}
                </span>{' '}
                · OPS Δ vs other hand{' '}
                <span className="tabular-nums">{split.ops_delta_vs_other_hand >= 0 ? '+' : ''}{split.ops_delta_vs_other_hand.toFixed(3)}</span>
              </div>
            ) : null}

            <p
              className="text-[10px] text-muted-foreground italic px-1"
              title="Green-shaded tiles = top quartile (or top decile if 'elite') this season at the opposing pitcher's hand. Red = bottom quartile. ▲ / ▼ next to L10 means recent form is better / worse than season."
            >
              Hover any tile for what the stat means. Shading reflects this batter's percentile vs the league at this matchup hand.
            </p>
          </TooltipProvider>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
