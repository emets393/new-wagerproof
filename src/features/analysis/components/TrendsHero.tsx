import * as React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { GlassCard } from '@/components/ios';
import type { AnalysisResponse, Overall } from './adapters/types';
import { significance, type SideSlice } from './adapters/shared';
import { HeroGauge, useCountUp } from './HeroGauge';
import { VersusRow } from './SplitBars';

/** Decorative aura behind the hero — tinted by whether the trend clears its baseline. */
function HeroAura({ good }: { good: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full opacity-[0.14] blur-3xl transition-colors duration-700"
      style={{ background: good ? '#10b981' : '#64748b' }}
    />
  );
}

/**
 * Narrative hero — the page's headline result. Left = HeroGauge ring, right = "When X, Y covered
 * Z%" with coverage / baseline delta / significance. On the two-sided-market tautology, renders
 * the SymmetricSplitHero (real side splits) instead — never headlines the forced ~50%.
 */
export function TrendsHero({
  betType,
  overall,
  data,
  subject,
  scopeNote,
  verb,
  nounFor,
  outcomeWord,
  showsROI,
  limited,
}: {
  betType: string;
  overall: Overall;
  data: AnalysisResponse;
  subject: string;
  scopeNote: string;
  verb: string;
  nounFor: string;
  outcomeWord: string;
  showsROI: boolean;
  limited: boolean;
}) {
  const cov = data.coverage;
  const delta = overall.hit_pct - data.baseline_pct;
  const sig = significance(overall.n, overall.hit_pct);
  const good = overall.hit_pct >= Math.max(data.baseline_pct, 50);
  const shownPct = useCountUp(overall.hit_pct);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
    >
      <GlassCard radius={24} className="relative overflow-hidden p-6">
        <HeroAura good={good} />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <HeroGauge hit={overall.hit_pct} baseline={data.baseline_pct} outcomeWord={outcomeWord} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-lg font-semibold leading-snug sm:text-xl">
                {subject} {verb}{' '}
                <span className="bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-4xl font-bold tabular-nums text-transparent sm:text-5xl">
                  {shownPct.toFixed(Number.isInteger(overall.hit_pct) ? 0 : 1)}%
                </span>
              </p>
              {showsROI && overall.roi != null && (
                <span
                  className={`text-lg font-semibold tabular-nums ${overall.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {overall.roi >= 0 ? '+' : ''}
                  {overall.roi}% ROI
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {overall.wins} of {overall.n} {nounFor}
              {cov ? ` · ${cov.season_min}–${cov.season_max}` : ''}
              {limited && (
                <span className="text-amber-600 dark:text-amber-400"> · Limited history (2023+)</span>
              )}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-sm">
              {overall.hit_pct >= 50 ? (
                <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <TrendingDown className="h-4 w-4 shrink-0 text-red-500" />
              )}
              <span className="font-medium">
                {delta >= 0 ? '+' : ''}
                {delta.toFixed(1)} pts vs {data.baseline_pct}% baseline
              </span>
              <span className="text-muted-foreground">· {sig.label}</span>
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground/80">{scopeNote}</p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

export function SymmetricSplitHero({
  betType,
  slices,
  data,
  sideLabel,
  isMoneyline,
  showsROI,
  limited,
  onFocus,
}: {
  betType: string;
  slices: SideSlice[];
  data: AnalysisResponse;
  sideLabel: (bt: string, side: string) => string;
  isMoneyline: boolean;
  showsROI: boolean;
  limited: boolean;
  onFocus: (dimension: string, side: string) => void;
}) {
  const head = slices[0];
  const cov = data.coverage;
  const shownPct = useCountUp(head.extreme.hit_pct);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
    >
      <GlassCard radius={24} className="relative overflow-hidden p-6">
        <HeroAura good />
        <div className="relative flex items-start gap-4">
          <TrendingUp className="mt-1 h-6 w-6 shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-4xl font-bold leading-none tracking-tight tabular-nums text-transparent sm:text-5xl">
                {shownPct.toFixed(Number.isInteger(head.extreme.hit_pct) ? 0 : 1)}%
              </span>
              {showsROI && head.extreme.roi != null && (
                <span
                  className={`text-lg font-semibold tabular-nums ${head.extreme.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {head.extreme.roi >= 0 ? '+' : ''}
                  {head.extreme.roi}% ROI
                </span>
              )}
            </div>
            <p className="mt-2 text-sm font-medium leading-snug">
              {sideLabel(betType, head.extreme.side)}{' '}
              <span className="text-primary">{head.extreme.hit_pct}%</span>{' '}
              <span className="font-normal text-muted-foreground">
                ({head.extreme.wins} of {head.extreme.n} bets
                {cov ? ` · ${cov.season_min}–${cov.season_max}` : ''}) ·{' '}
                {significance(head.extreme.n, head.extreme.hit_pct).label}
                {limited && (
                  <span className="text-amber-600 dark:text-amber-400"> · Limited history</span>
                )}
              </span>
            </p>
            <div className="mt-3 max-w-md space-y-2.5">
              {slices.map((sl) => (
                <VersusRow
                  key={sl.dimension}
                  slice={sl}
                  betType={betType}
                  sideLabel={sideLabel}
                  onFocus={onFocus}
                />
              ))}
            </div>
            <p className="mt-2.5 text-[11px] text-muted-foreground/80">
              Every game here has one side that{' '}
              {isMoneyline ? 'wins and one that loses' : "covers and one that doesn't"}, so “all teams”
              is always ~50% on this market — these are the real splits. Tap a side to focus on it.
            </p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
