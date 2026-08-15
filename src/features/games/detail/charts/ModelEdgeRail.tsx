import * as React from 'react';
import { cn } from '@/lib/utils';
import { MarkerCaption, Tick, TONE, separateCaptions, useMeasuredWidth } from './chartChrome';
import { NFL_EDGE_SCALE, type EdgeScale } from './edgeScale';

/**
 * One centred rail that answers "which way does our model disagree with the
 * market, and by how much" before a single number is read.
 *
 * The market number is ALWAYS the centre reference point. The model rides at an
 * offset whose direction is the lean and whose distance is the magnitude, and
 * only the span *between* the two markers is coloured — everything outside it
 * stays muted, so the eye lands on the disagreement rather than on the rail.
 *
 * ## The gap is derived, never passed in
 * The edge shown in the header is `model − market` computed from the two values
 * this view is already rendering, so the three figures on screen cannot disagree
 * with each other (WIDGET_DESIGN.md rule 10). Callers holding a separately
 * stored `edge` column should not pass it — a marginally more "correct" number
 * that contradicts the bar under it is worse than a consistent one.
 *
 * ## Zone widths are equal, not proportional to points
 * The five zones render at equal width so their labels stay legible at 8px, and
 * the gap → x mapping is piecewise-linear across them. A marker therefore always
 * lands inside the zone its label names, but pixel distance is only comparable
 * *within* a zone. That is an acceptable trade because the exact number is
 * printed twice (header + under the marker); nothing here asks you to measure
 * the bar.
 *
 * ## Mirroring
 * Under and Over are symmetric: the band grows leftward with a blue accent for a
 * low lean and rightward with green for a high one, per the Over/Under colour
 * rule (rule 7).
 *
 * Port of `WagerproofDesign/Components/ModelEdgeRail.swift`.
 */
export function ModelEdgeRail({
  market,
  model,
  lowWord = 'Under',
  highWord = 'Over',
  marketCaption = 'Market',
  modelCaption = 'Model',
  scale = NFL_EDGE_SCALE,
  format = defaultFormat,
  formatGap = defaultGapFormat,
  className,
}: {
  /** The book's number. Pinned to the centre of the rail. */
  market: number;
  /** WagerProof's projection for the same market. */
  model: number;
  /** Word for a model-below-market lean. */
  lowWord?: string;
  /** Word for a model-above-market lean. */
  highWord?: string;
  marketCaption?: string;
  modelCaption?: string;
  /**
   * Per-sport thresholds. MUST match the sport — an NFL scale on MLB runs reads
   * STRONG OVER on every game. See `edgeScale.ts`.
   */
  scale?: EdgeScale;
  format?: (value: number) => string;
  /**
   * Renders the header's gap MAGNITUDE. One decimal is right for points; MLB
   * passes two, because 0.33 runs and 0.5 runs are different verdicts and "0.3"
   * would round away the difference the card's own copy quotes.
   */
  formatGap?: (magnitude: number) => string;
  className?: string;
}) {
  const [rootRef, width] = useMeasuredWidth<HTMLDivElement>();

  // Clamp in ascending order so a caller can't invert the bands and produce a
  // rail whose zones read backwards or divide by zero.
  const lean = Math.max(scale.totalLean, 0.1);
  const strong = Math.max(scale.totalStrong, lean + 0.1);
  const cap = Math.max(scale.totalCap, strong + 0.1);

  const gap = model - market;
  const magnitude = Math.abs(gap);

  /** 0 = strong low … 2 = no edge … 4 = strong high. */
  const zoneIndex = (() => {
    if (magnitude < lean) return 2;
    const isStrong = magnitude >= strong;
    if (gap < 0) return isStrong ? 0 : 1;
    return isStrong ? 4 : 3;
  })();

  const zoneTitles = [
    `Strong ${lowWord}`,
    `${lowWord} Lean`,
    'No Edge',
    `${highWord} Lean`,
    `Strong ${highWord}`,
  ];
  const tone = zoneIndex <= 1 ? 'under' : zoneIndex >= 3 ? 'over' : 'neutral';
  const hasEdge = zoneIndex !== 2;

  /**
   * Signed gap → 0-1 across the rail, piecewise-linear so each of the five
   * equal-width zones spans exactly the point range its label claims.
   */
  const modelFraction = (() => {
    const m = Math.min(magnitude, cap);
    let half: number;
    if (m <= lean) half = (m / lean) * 0.1;
    else if (m <= strong) half = 0.1 + ((m - lean) / (strong - lean)) * 0.2;
    else half = 0.3 + ((m - strong) / (cap - strong)) * 0.2;
    // Keep a pinned marker inside the track instead of half-clipped by it.
    return Math.min(Math.max(0.5 + (gap < 0 ? -half : half), 0.015), 0.985);
  })();

  const captionWidth = 78;
  const [marketCaptionX, modelCaptionX] = separateCaptions(
    0.5 * width,
    modelFraction * width,
    captionWidth,
    width,
  );

  // Always signed, including inside "No Edge" — the direction is still real
  // there, it just isn't big enough to act on, and an unsigned number would read
  // as if the model and the market agreed exactly.
  const signedGapText = `${gap < 0 ? '−' : '+'}${formatGap(magnitude)}`;

  const bandLeft = Math.min(0.5, modelFraction);
  const bandWidth = Math.abs(modelFraction - 0.5);

  return (
    <div
      ref={rootRef}
      className={cn('flex flex-col gap-2', className)}
      role="img"
      aria-label={
        hasEdge
          ? `${zoneTitles[zoneIndex]}. Market ${format(market)}, model ${format(model)} — ${formatGap(magnitude)} toward the ${gap >= 0 ? highWord : lowWord}.`
          : `No edge. Market ${format(market)}, model ${format(model)}.`
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn('text-[11px] font-black uppercase tracking-[0.07em]', TONE[tone].text)}>
          {zoneTitles[zoneIndex]}
        </span>
        <span className={cn('shrink-0 text-[17px] font-black tabular-nums', TONE[tone].text)}>
          {signedGapText}
        </span>
      </div>

      <div className="flex gap-0.5" aria-hidden>
        {zoneTitles.map((title, index) => (
          <span
            key={title}
            className={cn(
              'min-w-0 flex-1 truncate text-center text-[8px] font-black uppercase tracking-[0.04em]',
              index === zoneIndex ? TONE[tone].text : 'text-muted-foreground/50',
            )}
          >
            {title}
          </span>
        ))}
      </div>

      <div className="relative h-6" aria-hidden>
        <span className="absolute inset-x-0 top-1/2 h-[7px] -translate-y-1/2 rounded-full bg-muted-foreground/[0.16]" />

        {/* Zone boundaries, so the labels above are anchored to something. */}
        {[1, 2, 3, 4].map((boundary) => (
          <span
            key={boundary}
            className="absolute top-1/2 h-[7px] w-px -translate-y-1/2 bg-foreground/20"
            style={{ left: `${(boundary / 5) * 100}%` }}
          />
        ))}

        {/* The answer: only the span between market and model is coloured. */}
        <span
          className={cn(
            'absolute top-1/2 h-[7px] -translate-y-1/2 rounded-full',
            hasEdge ? TONE[tone].fill : 'bg-muted-foreground/40',
          )}
          style={{ left: `${bandLeft * 100}%`, width: `${Math.max(bandWidth * 100, 0.6)}%` }}
        />

        <Tick fraction={0.5} className="bg-muted-foreground" width={2.5} height={17} />
        <Tick
          fraction={modelFraction}
          className={hasEdge ? TONE[tone].fill : 'bg-muted-foreground'}
          width={3.5}
          height={23}
        />
      </div>

      <div className="relative h-8">
        <MarkerCaption
          label={marketCaption}
          value={format(market)}
          valueClassName="text-foreground"
          size="lg"
          x={marketCaptionX}
          width={captionWidth}
        />
        <MarkerCaption
          label={modelCaption}
          value={format(model)}
          valueClassName={TONE[tone].text}
          size="lg"
          x={modelCaptionX}
          width={captionWidth}
        />
      </div>
    </div>
  );
}

/** One decimal with a trailing `.0` dropped. */
export function defaultFormat(value: number): string {
  return Math.round(value) === value ? String(Math.round(value)) : value.toFixed(1);
}

/** Always one decimal — the gap keeps its `.0` so the header column doesn't jump. */
function defaultGapFormat(magnitude: number): string {
  return magnitude.toFixed(1);
}
