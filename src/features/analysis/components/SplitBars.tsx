import * as React from 'react';
import { motion } from 'motion/react';
import type { Bar, Opt } from './adapters/types';
import { DIM_LABEL, SIDE_CHIP_LABEL, type SideSlice } from './adapters/shared';

/**
 * Baseline-tick split bars. `OptionRow` = one labeled option with an animated hit-rate track +
 * a baseline tick; `VersusRow` = mirrored two-sided bar with a 50% midline; `ResultBar` = a
 * dimension (Over/Under, Home vs Away…) with its options. Fills animate on value change.
 */

const FILL_EASE = { duration: 0.55, ease: [0.32, 0.72, 0, 1] } as const;

export function OptionRow({
  betType,
  opt,
  baseline,
  sideLabel,
  showsROI,
}: {
  betType: string;
  opt: Opt;
  baseline: number;
  sideLabel: (bt: string, side: string) => string;
  showsROI: boolean;
}) {
  const good = opt.hit_pct >= 52.4; // break-even at -110
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{sideLabel(betType, opt.side)}</span>
        <span
          className={
            good ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-foreground/80'
          }
        >
          {opt.hit_pct}%{' '}
          <span className="text-xs font-normal text-muted-foreground">
            ({opt.wins} of {opt.n})
          </span>
        </span>
      </div>
      <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${
            good ? 'from-emerald-400/70 to-emerald-500' : 'from-slate-400/50 to-slate-400/80 dark:from-slate-500/50 dark:to-slate-400/70'
          }`}
          initial={false}
          animate={{ width: `${Math.min(opt.hit_pct, 100)}%` }}
          transition={FILL_EASE}
        />
        <div
          className="absolute inset-y-[-2px] w-[2px] rounded-full bg-foreground/60"
          style={{ left: `${baseline}%` }}
          title={`${baseline}% baseline`}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>vs {baseline}% baseline</span>
        {showsROI && opt.roi != null && (
          <span
            className={
              opt.roi >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }
          >
            {opt.roi >= 0 ? '+' : ''}
            {opt.roi}% ROI
          </span>
        )}
      </div>
    </div>
  );
}

/** Mirrored two-side bar: the weaker side fills from the left in slate, the stronger from the right in emerald, 50% midline. */
export function VersusRow({
  slice,
  betType,
  sideLabel,
  onFocus,
}: {
  slice: SideSlice;
  betType: string;
  sideLabel: (bt: string, side: string) => string;
  onFocus?: (dimension: string, side: string) => void;
}) {
  const otherLbl = `${sideLabel(betType, slice.other.side)} ${slice.other.hit_pct}%`;
  const extremeLbl = `${sideLabel(betType, slice.extreme.side)} ${slice.extreme.hit_pct}%`;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        {onFocus ? (
          <button
            type="button"
            className="text-foreground/70 transition-colors hover:text-foreground hover:underline"
            onClick={() => onFocus(slice.dimension, slice.other.side)}
          >
            {otherLbl}
          </button>
        ) : (
          <span className="text-foreground/70">{otherLbl}</span>
        )}
        {onFocus ? (
          <button
            type="button"
            className="font-semibold transition-colors hover:underline"
            onClick={() => onFocus(slice.dimension, slice.extreme.side)}
          >
            {extremeLbl}
          </button>
        ) : (
          <span className="font-semibold">{extremeLbl}</span>
        )}
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
        {/* the two sides of one market sum to ~100, so the fills meet near their true boundary */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-slate-400/40 to-slate-400/70 dark:from-slate-500/40 dark:to-slate-400/60"
          initial={false}
          animate={{ width: `${Math.min(slice.other.hit_pct, 100)}%` }}
          transition={FILL_EASE}
        />
        <motion.div
          className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-emerald-500 to-emerald-400/70"
          initial={false}
          animate={{ width: `${Math.min(slice.extreme.hit_pct, 100)}%` }}
          transition={FILL_EASE}
        />
        <div className="absolute inset-y-[-2px] left-1/2 w-[2px] rounded-full bg-foreground/50" />
      </div>
    </div>
  );
}

export function ResultBar({
  betType,
  bar,
  baseline,
  sideLabel,
  showsROI,
  onFocus,
}: {
  betType: string;
  bar: Bar;
  baseline: number;
  sideLabel: (bt: string, side: string) => string;
  showsROI: boolean;
  onFocus?: (dimension: string, side: string) => void;
}) {
  if (bar.dimension === 'home_away' || bar.dimension === 'fav_dog') {
    const opts = (bar.options || []).filter((o) => o.n > 0 && SIDE_CHIP_LABEL[o.side]);
    if (opts.length >= 2) {
      const sorted = [...opts].sort((a, b) => b.hit_pct - a.hit_pct);
      return (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {DIM_LABEL[bar.dimension]}
          </div>
          <VersusRow
            slice={{ dimension: bar.dimension, extreme: sorted[0], other: sorted[1] }}
            betType={betType}
            sideLabel={sideLabel}
            onFocus={onFocus}
          />
        </div>
      );
    }
  }
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {DIM_LABEL[bar.dimension] || bar.dimension}
      </div>
      {bar.options.map((opt, i) => (
        <OptionRow
          key={i}
          betType={betType}
          opt={opt}
          baseline={baseline}
          sideLabel={sideLabel}
          showsROI={showsROI}
        />
      ))}
    </div>
  );
}
