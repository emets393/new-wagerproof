import * as React from 'react';
import { cn } from '@/lib/utils';
import { BREAK_EVEN_RATE, hitRateFraction, hitRateWindow, parseHitRate } from './hitRate';

/**
 * A signal's backtest, drawn against the break-even it has to clear.
 *
 * Port of `Wagerproof/Features/GameWidgets/SignalBacktestChart.swift`.
 *
 * A signal's whole claim is "this hits often enough to beat the vig", so the
 * chart is a rate measured against that threshold, not a bare percentage. The
 * old web card printed the backtest and the season record as two text columns,
 * which left the reader to decide whether 53% was good.
 */

export interface SignalPerformanceLike {
  n: number;
  wins: number;
  losses: number;
  pushes: number;
  /** 0–1. */
  hit_rate: number;
}

/**
 * One rate on a losing→winning track with the break-even between the zones.
 *
 * A zone chart, not a fill bar: a fill growing from the window's left edge
 * implied 35% was "zero" and left a losing signal as a sliver that read as a
 * rendering fault. Same grammar as `charts/SpreadCoverBar` — the bar you must
 * clear, where you are, the gap between.
 */
export function SignalHitRateMeter({
  label,
  caption,
  rate,
  lowConfidence = false,
}: {
  label: string;
  caption: string;
  /** 0–1. */
  rate: number;
  lowConfidence?: boolean;
}) {
  const window = hitRateWindow(rate);
  const breakEvenPct = hitRateFraction(BREAK_EVEN_RATE, window) * 100;
  const markerPct = hitRateFraction(rate, window) * 100;
  const beats = rate >= BREAK_EVEN_RATE;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="ml-auto text-lg font-black tabular-nums">
          <span className={beats ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
            {(rate * 100).toFixed(1)}%
          </span>
        </span>
        <span
          className={cn(
            'text-[9px] font-black',
            beats ? 'text-emerald-600/85 dark:text-emerald-400/85' : 'text-red-600/85 dark:text-red-400/85',
          )}
        >
          {beats ? 'beats the vig' : 'loses to the vig'}
        </span>
      </div>

      <div className="relative h-6" role="img" aria-label={`${(rate * 100).toFixed(1)} percent, break-even 52.4 percent`}>
        {/* Flat zone fills: every rate inside a zone means the same thing. */}
        <span className="absolute inset-x-0 top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-red-500/20" />
        <span
          className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-emerald-500/30"
          style={{ left: `${breakEvenPct}%`, right: 0 }}
        />
        <span
          className="absolute top-1/2 w-0.5 -translate-y-1/2 bg-foreground/85"
          style={{ left: `${breakEvenPct}%`, height: 22 }}
        />
        <span
          className={cn(
            'absolute top-1/2 w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full',
            beats ? 'bg-emerald-500' : 'bg-red-500',
            lowConfidence && 'opacity-65',
          )}
          style={{ left: `${markerPct}%`, height: 26 }}
        />
      </div>

      <div className="flex items-start justify-between gap-3">
        <span className="text-[9px] font-black text-muted-foreground/80">Break-even 52.4%</span>
        <span className="text-right text-[9px] font-bold text-muted-foreground/80">{caption}</span>
      </div>
    </div>
  );
}

/** Wins / pushes / losses as one divided bar (WIDGET_DESIGN rule 5). */
export function SignalRecordBar({
  wins,
  losses,
  pushes,
}: {
  wins: number;
  losses: number;
  pushes: number;
}) {
  const total = Math.max(wins + losses + pushes, 1);
  const pct = (n: number) => (n / total) * 100;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-3 overflow-hidden rounded-full">
        {wins > 0 && <span className="bg-emerald-500" style={{ width: `${pct(wins)}%` }} />}
        {pushes > 0 && <span className="bg-muted-foreground/55" style={{ width: `${pct(pushes)}%` }} />}
        {losses > 0 && <span className="bg-red-500" style={{ width: `${pct(losses)}%` }} />}
      </div>
      <div className="flex items-center gap-3">
        <Legend className="bg-emerald-500" label={`${wins}W`} />
        {pushes > 0 && <Legend className="bg-muted-foreground/55" label={`${pushes}P`} />}
        <Legend className="bg-red-500" label={`${losses}L`} />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('h-1.5 w-1.5 rounded-full', className)} />
      <span className="text-[10px] font-black tabular-nums text-muted-foreground">{label}</span>
    </span>
  );
}

/**
 * Backtest meter, live-season meter, and the season record bar. Renders the raw
 * `typical_hit` string when it carries no parseable percentage, which is honest
 * rather than inventing a number to chart.
 */
export function SignalBacktestChart({
  backtestRaw,
  performance,
  className,
}: {
  backtestRaw?: string | null;
  performance?: SignalPerformanceLike | null;
  className?: string;
}) {
  const backtestRate = parseHitRate(backtestRaw);
  const graded = performance && performance.n > 0 ? performance : null;

  if (!backtestRate && !backtestRaw && !graded) return null;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {backtestRate !== null ? (
        <SignalHitRateMeter
          label="Historical backtest"
          caption="Multi-season, not this year"
          rate={backtestRate}
        />
      ) : (
        backtestRaw && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Historical backtest
            </span>
            <span className="text-sm font-bold text-foreground">{backtestRaw}</span>
          </div>
        )
      )}

      {/* Nothing when the season has no graded picks — offseason and early weeks
          are the common case, and an empty-state line there is noise under a
          chart that already answered the question. */}
      {graded && (
        <>
          <SignalHitRateMeter
            label="This season"
            caption={
              graded.n < 10
                ? `Only ${graded.n} graded — too few to trust`
                : `${graded.n} graded picks`
            }
            rate={graded.hit_rate}
            lowConfidence={graded.n < 10}
          />
          <SignalRecordBar wins={graded.wins} losses={graded.losses} pushes={graded.pushes} />
        </>
      )}
    </div>
  );
}
