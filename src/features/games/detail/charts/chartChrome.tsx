import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared chrome for the three edge charts. They are one grammar — a threshold
 * you must beat, where the model lands, the gap between them highlighted — so
 * the tick, the caption and the bracket are drawn once here rather than three
 * times with three sets of near-identical Tailwind.
 */

// ---------------------------------------------------------------------------
// Tones
// ---------------------------------------------------------------------------

export type ChartTone = 'win' | 'loss' | 'push' | 'over' | 'under' | 'neutral';

/**
 * Theme-safe pairs only (WIDGET_DESIGN.md rule 11). `fill` is used on bars and
 * ticks where the same hue reads correctly on both surfaces; `text` carries the
 * light/dark split that body copy needs.
 */
export const TONE: Record<ChartTone, { text: string; fill: string }> = {
  win: { text: 'text-emerald-600 dark:text-emerald-300', fill: 'bg-emerald-500' },
  loss: { text: 'text-red-600 dark:text-red-300', fill: 'bg-red-500' },
  push: { text: 'text-amber-600 dark:text-amber-300', fill: 'bg-amber-500' },
  // Over/Under keep the rule-7 pairing: green + up for OVER, blue + down for UNDER.
  over: { text: 'text-emerald-600 dark:text-emerald-300', fill: 'bg-emerald-500' },
  under: { text: 'text-blue-600 dark:text-blue-300', fill: 'bg-blue-500' },
  neutral: { text: 'text-muted-foreground', fill: 'bg-muted-foreground' },
};

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * Width of the chart's own box, measured rather than assumed: the caption row
 * has to know how many pixels it has before it can decide whether two labels
 * would collide.
 */
export function useMeasuredWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    // ResizeObserver is missing in jsdom; the charts still render, just at 0
    // width, which the callers already treat as "don't nudge captions yet".
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/**
 * Push two captions apart when their markers nearly coincide, otherwise a small
 * edge renders both labels stacked on top of each other. The *markers* stay
 * truthful; only the labels move, and the colour pairing keeps them
 * attributable. Positions in and out are pixels from the left edge.
 */
export function separateCaptions(
  leftX: number,
  rightX: number,
  captionWidth: number,
  containerWidth: number,
): [number, number] {
  if (containerWidth <= captionWidth) return [leftX, rightX];
  let left = leftX;
  let right = rightX;
  const minimumSeparation = captionWidth + 6;
  const separation = Math.abs(right - left);
  if (separation < minimumSeparation) {
    const shove = (minimumSeparation - separation) / 2;
    const direction = right >= left ? 1 : -1;
    left -= direction * shove;
    right += direction * shove;
  }
  const lower = captionWidth / 2;
  const upper = containerWidth - captionWidth / 2;
  const clamp = (v: number) => Math.min(Math.max(v, lower), upper);
  return [clamp(left), clamp(right)];
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** A vertical marker on a bar, centred on `fraction` of the track's width. */
export function Tick({
  fraction,
  className,
  width = 3,
  height,
}: {
  /** 0-1 across the track. */
  fraction: number;
  className: string;
  width?: number;
  height: number;
}) {
  return (
    <span
      aria-hidden
      className={cn('absolute top-1/2 rounded-full', className)}
      style={{
        left: `${fraction * 100}%`,
        width,
        height,
        transform: `translate(-${width / 2}px, -50%)`,
      }}
    />
  );
}

/**
 * The label that names a tick, sitting above it and pointing down at it.
 * `x` is a pixel offset from the container's left edge, already de-collided.
 */
export function MarkerCaption({
  label,
  value,
  valueClassName,
  size = 'sm',
  x,
  width,
}: {
  label: string;
  value?: string | null;
  /** COLOUR only — the size comes from `size`, so twMerge never has to pick. */
  valueClassName: string;
  size?: 'sm' | 'lg';
  x: number;
  width: number;
}) {
  return (
    <span
      className="absolute top-0 flex flex-col items-center gap-px"
      style={{ left: x, width, transform: 'translateX(-50%)' }}
    >
      <span className="max-w-full truncate text-[8px] font-black uppercase leading-none tracking-[0.06em] text-muted-foreground/70">
        {label}
      </span>
      {value != null && (
        <span
          className={cn(
            'max-w-full truncate font-black leading-tight tabular-nums',
            size === 'lg' ? 'text-[18px]' : 'text-[12px]',
            valueClassName,
          )}
        >
          {value}
        </span>
      )}
    </span>
  );
}

/**
 * The bracket under the bar spanning threshold → model, with its size printed
 * beneath. Anchored to those two ticks and nothing else, so its drawn length IS
 * the number on it — an earlier cut ran a full-width rule and claimed the whole
 * axis was 6.6 points.
 */
export function GapBracket({
  startFraction,
  endFraction,
  label,
  tone,
  containerWidth,
  labelWidth = 132,
}: {
  startFraction: number;
  endFraction: number;
  label: string;
  tone: ChartTone;
  containerWidth: number;
  labelWidth?: number;
}) {
  const start = Math.min(startFraction, endFraction);
  const end = Math.max(startFraction, endFraction);
  const centre = containerWidth
    ? Math.min(
        Math.max(((start + end) / 2) * containerWidth, labelWidth / 2),
        Math.max(containerWidth - labelWidth / 2, labelWidth / 2),
      )
    : 0;

  return (
    <div className="flex flex-col gap-[3px]">
      <div className="relative h-[7px]" aria-hidden>
        <span
          className={cn('absolute top-0 h-px opacity-60', TONE[tone].fill)}
          style={{ left: `${start * 100}%`, width: `${Math.max((end - start) * 100, 0.4)}%` }}
        />
        <span
          className={cn('absolute top-0 h-[6px] w-px opacity-60', TONE[tone].fill)}
          style={{ left: `${start * 100}%` }}
        />
        <span
          className={cn('absolute top-0 h-[6px] w-px opacity-60', TONE[tone].fill)}
          style={{ left: `${end * 100}%` }}
        />
      </div>
      <div className="relative h-3">
        <span
          className={cn(
            'absolute top-0 truncate text-center text-[10px] font-black uppercase leading-none tracking-[0.05em]',
            TONE[tone].text,
          )}
          style={{ left: centre, width: labelWidth, transform: 'translateX(-50%)' }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

/** The two verdicts that close a bar: what loses on the left, what wins on the right. */
export function ZoneVerdicts({
  loseLabel,
  loseText,
  winLabel,
  winText,
  winTone = 'win',
}: {
  loseLabel: string;
  loseText: string;
  winLabel: string;
  winText: string;
  winTone?: ChartTone;
}) {
  return (
    <div className="flex items-start justify-between gap-2.5">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn('text-[10px] font-black uppercase leading-none', TONE.loss.text)}>
          ✕ {loseLabel}
        </span>
        <span className="text-[11px] font-semibold leading-snug text-muted-foreground">{loseText}</span>
      </span>
      <span className="flex min-w-0 flex-col items-end gap-0.5 text-right">
        <span className={cn('text-[10px] font-black uppercase leading-none', TONE[winTone].text)}>
          ✓ {winLabel}
        </span>
        <span className="text-[11px] font-semibold leading-snug text-muted-foreground">{winText}</span>
      </span>
    </div>
  );
}
