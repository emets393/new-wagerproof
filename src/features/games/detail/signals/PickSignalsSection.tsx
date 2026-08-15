import * as React from 'react';
import { AlertTriangle, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The "Pick Signals" row under a market card's recommendation.
 *
 * Port of `Wagerproof/Features/GameWidgets/PickSignalPills.swift`.
 *
 * ## Why one header instead of two groups
 * The old layout printed "Supports this pick" and "Contradicts this pick" as
 * separate headed groups. That buried the only thing a reader has to do here —
 * open one — under a taxonomy, and read as two unrelated lists. There is now a
 * single labelled affordance, with stance carried by the pill: amber triangle
 * argues against the pick, neutral circle backs it. The legend states that in
 * words so colour isn't load bearing on its own.
 *
 * The web pill approximates iOS's Liquid Glass with a blurred translucent
 * surface — `backdrop-blur` plus a theme-safe tint, never a hardcoded slate.
 */

export interface PickSignalPillModel {
  key: string;
  title: string;
  /** Argues AGAINST the card's pick. Drives the amber tint and the triangle. */
  contradicts: boolean;
}

export function PickSignalsSection({
  signals,
  selectedKey,
  onSelect,
  /** Game-level lists aren't attached to a pick, so they name themselves. */
  title = 'Pick Signals',
  className,
}: {
  signals: PickSignalPillModel[];
  selectedKey?: string | null;
  onSelect: (key: string) => void;
  title?: string;
  className?: string;
}) {
  if (signals.length === 0) return null;
  const hasContradicting = signals.some((s) => s.contradicts);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span className="text-[9px] font-bold text-muted-foreground/70">(click for details)</span>
      </div>

      {/* Stance is otherwise colour-only, which fails for anyone who can't
          separate amber from the neutral pills. */}
      {hasContradicting && (
        <span className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground/80">
          <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-amber-500" aria-hidden />
          Amber signals argue against this pick
        </span>
      )}

      <div className="flex flex-wrap gap-1.5">
        {signals.map((signal) => (
          <PickSignalPill
            key={signal.key}
            signal={signal}
            active={selectedKey === signal.key}
            onSelect={() => onSelect(signal.key)}
          />
        ))}
      </div>
    </div>
  );
}

function PickSignalPill({
  signal,
  active,
  onSelect,
}: {
  signal: PickSignalPillModel;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = signal.contradicts ? AlertTriangle : CircleAlert;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={active}
      aria-label={`${signal.title}. ${
        signal.contradicts ? 'Contradicts this pick' : 'Supports this pick'
      }. Click for backtest.`}
      className={cn(
        'flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-left',
        'backdrop-blur-md transition-all duration-200',
        'active:scale-[0.96] motion-reduce:active:scale-100',
        // Colour rides the ICON, not the fill. Supporting pills take plain glass
        // so the amber ones are the only coloured thing in the row.
        signal.contradicts
          ? 'border-amber-500/45 bg-amber-500/[0.16] hover:bg-amber-500/25'
          : 'border-black/10 bg-black/[0.04] hover:bg-black/[0.07] dark:border-white/15 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]',
        active && (signal.contradicts ? 'ring-1 ring-amber-500/60' : 'ring-1 ring-foreground/25'),
      )}
    >
      <Icon
        className={cn(
          'h-3 w-3 shrink-0',
          signal.contradicts ? 'text-amber-500' : 'text-muted-foreground',
        )}
        aria-hidden
      />
      <span className="min-w-0 truncate text-[11px] font-black leading-tight text-foreground">
        {signal.title}
      </span>
    </button>
  );
}
