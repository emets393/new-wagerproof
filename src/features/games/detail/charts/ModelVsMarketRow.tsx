import * as React from 'react';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE, type ChartTone } from './chartChrome';

/**
 * Model number, the gap, and the market number, in three columns with the lean
 * spelled out underneath.
 *
 * This is the ONE copy of a row that existed four times over — `CompareRow`
 * (nfl), `ModelVsVegas` (cfb), `ModelVsMarket` (nba), `ModelVsVegas` /
 * `TotalCompare` (mlb) — with the same layout and slightly different props each
 * time. Most of those call sites now render a chart instead; this stays for the
 * places where there is no threshold to plot (MLB's first-five moneyline has no
 * book price on the row at all, so there is nothing to anchor a bar to).
 *
 * Values arrive PRE-FORMATTED. Callers derive whichever of model/market is
 * missing from the gap so the three figures reconcile exactly
 * (WIDGET_DESIGN.md rule 10); this component never subtracts anything itself.
 */
export function ModelVsMarketRow({
  model,
  modelLabel = 'Our model',
  modelAccessory,
  market,
  marketLabel = 'Vegas',
  gapDisplay,
  gapUnit,
  tone,
  lean,
}: {
  /** Already formatted, e.g. "-6.5", "8.17", "56.4%". */
  model: string;
  modelLabel?: string;
  /** Team mark or similar, rendered left of the model figure. */
  modelAccessory?: React.ReactNode;
  market: string;
  marketLabel?: string;
  /** The centre figure, already signed and formatted. */
  gapDisplay: string;
  /** Caption under the gap: "pts", "runs", "value". */
  gapUnit: string;
  /** Drives the gap's colour, and the arrow on over/under rows (rule 7). */
  tone: ChartTone;
  /** Spelled-out conclusion — a signed gap alone never says which way to bet. */
  lean?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {modelLabel}
          </span>
          <span className="flex items-center gap-1.5">
            {modelAccessory}
            <span className="text-xl font-bold tabular-nums text-foreground">{model}</span>
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-center">
          <span
            className={cn(
              'flex items-center gap-0.5 font-mono text-[13px] font-bold tabular-nums',
              TONE[tone].text,
            )}
          >
            {tone === 'over' ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : tone === 'under' ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : null}
            {gapDisplay}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {gapUnit}
          </span>
        </div>

        <div className="flex min-w-0 flex-col items-end gap-0.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {marketLabel}
          </span>
          <span className="text-xl font-bold tabular-nums text-muted-foreground">{market}</span>
        </div>
      </div>

      {lean && (
        <div className="flex items-center gap-1.5 border-t border-black/5 pt-2 text-[11px] dark:border-white/10">
          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="min-w-0 text-muted-foreground">{lean}</span>
        </div>
      )}
    </div>
  );
}
