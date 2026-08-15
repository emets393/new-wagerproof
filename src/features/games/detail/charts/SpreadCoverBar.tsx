import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  GapBracket,
  MarkerCaption,
  Tick,
  TONE,
  ZoneVerdicts,
  separateCaptions,
  useMeasuredWidth,
} from './chartChrome';
import { NFL_EDGE_SCALE, type EdgeScale } from './edgeScale';
import { formatMargin, pushMarginLabel, spreadCoverOutcome, spreadCoverSummary } from './spreadCover';

/**
 * The spread pick drawn on a **score-differential axis anchored at a tie**.
 *
 * ## Why zero is the centre, not the break-even
 * The first cut centred the bar on the betting threshold. That put an
 * abstraction at the anchor point and left a tied game — the one number every
 * reader already understands — off the chart entirely. Worse, it hid the fact
 * this widget exists to teach: on a dog, **the cover zone starts on the losing
 * side of zero**. You can lose and still cash. With TIE at the centre and the
 * green beginning to its left, that reads without a caption.
 *
 * It also separates two situations that looked identical before: "model has them
 * winning by 2" and "model has them losing by 3 but still covering" now sit on
 * opposite sides of the tie mark.
 *
 * ## No number on the break-even tick
 * On a half-point line the threshold sits between two whole margins, so there is
 * no outcome to name — the zone captions carry it ("Lose by 4 or less" / "Lose
 * by 5+"). Printing the LINE there (`+4.5`) is what the whole component was
 * built to avoid: a spread number on a margin axis. On a whole-point line the
 * tick becomes the push, which IS a real outcome, and gets named.
 *
 * Port of `WagerproofDesign/Components/SpreadCoverBar.swift`.
 */
export function SpreadCoverBar({
  line,
  modelMargin,
  scale = NFL_EDGE_SCALE,
  pickAbbrev,
  opponentAbbrev,
  className,
}: {
  /** The pick team's line from its own perspective: `+4.5` = receiving 4.5. */
  line: number;
  /** The pick team's projected final margin. On a dryrun row this is `-model_line`. */
  modelMargin: number;
  scale?: EdgeScale;
  pickAbbrev?: string | null;
  opponentAbbrev?: string | null;
  className?: string;
}) {
  const [rootRef, width] = useMeasuredWidth<HTMLDivElement>();
  const outcome = React.useMemo(() => spreadCoverOutcome(line, modelMargin), [line, modelMargin]);

  const window = scale.spreadWindow;
  /** Margin → 0-1 across the bar, with a tie at dead centre. */
  const fraction = React.useCallback(
    (margin: number) => Math.min(Math.max(margin / (window * 2) + 0.5, 0.008), 0.992),
    [window],
  );

  // A pushing margin is one whole number, so on a continuous axis it occupies the
  // half-point either side of itself. On a half-point line the two zones meet at
  // a hairline instead — nothing can land there.
  const loseEnd = fraction(outcome.threshold - (outcome.hasPush ? 0.5 : 0));
  const coverStart = fraction(outcome.threshold + (outcome.hasPush ? 0.5 : 0));
  const breakEvenF = fraction(outcome.threshold);
  const modelF = fraction(outcome.modelMargin);
  const tone = outcome.covers ? 'win' : 'loss';

  const captionWidth = 84;
  const [breakEvenCaptionX, modelCaptionX] = separateCaptions(
    breakEvenF * width,
    modelF * width,
    captionWidth,
    width,
  );

  const cushionText = formatMargin(Math.abs(outcome.cushion));
  const gradations = scale.spreadTicks.flatMap((t) => [-t, t]);

  return (
    <div
      ref={rootRef}
      className={cn('flex flex-col gap-2', className)}
      role="img"
      aria-label={spreadCoverSummary(outcome)}
    >
      {/* Markers name themselves ABOVE the bar so each label points down at its
          own tick, then the scale and the span it measures sit under it. */}
      <div className="relative h-[30px]">
        <MarkerCaption
          label={outcome.hasPush ? 'Push' : 'Break-even'}
          // Half-point line: no whole margin lands here, so there is no outcome
          // to name and the line number would be a category error.
          value={pushMarginLabel(outcome)}
          valueClassName="text-foreground"
          x={breakEvenCaptionX}
          width={captionWidth}
        />
        <MarkerCaption
          label="Model"
          value={outcome.modelCondition}
          valueClassName={TONE[tone].text}
          x={modelCaptionX}
          width={captionWidth}
        />
      </div>

      <div className="relative h-8" aria-hidden>
        {/* Flat fills, not gradients: every outcome inside a zone pays the same,
            so brightening toward one end would imply a better win. */}
        <span className="absolute inset-x-0 top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-red-500/20" />
        <span
          className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-emerald-500/85"
          style={{ left: `${coverStart * 100}%`, right: 0 }}
        />
        {outcome.hasPush && (
          <span
            className="absolute top-1/2 h-3.5 -translate-y-1/2 bg-amber-500/90"
            style={{
              left: `${loseEnd * 100}%`,
              width: `${Math.max((coverStart - loseEnd) * 100, 0.5)}%`,
            }}
          />
        )}

        {gradations.map((margin) => (
          <span
            key={margin}
            className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-foreground/[0.16]"
            style={{ left: `${fraction(margin) * 100}%` }}
          />
        ))}

        {/* A tie is the reference the whole axis hangs off, so it reads as part of
            the scale rather than as a third marker. */}
        <span
          className="absolute top-1/2 h-3.5 w-[1.5px] -translate-y-1/2 bg-foreground/45"
          style={{ left: `${fraction(0) * 100}%` }}
        />

        <Tick fraction={breakEvenF} className="bg-foreground" width={3} height={26} />
        <Tick fraction={modelF} className={TONE[tone].fill} width={3.5} height={30} />
      </div>

      {/* `OPP ← 10 7 3 TIE 3 7 10 → PICK`, so the bar has a ruler and the bracket
          below it measures against something. */}
      <div className="relative h-3" aria-hidden>
        {opponentAbbrev && (
          <span className="absolute left-0 top-0 text-[8px] font-black uppercase tracking-[0.04em] text-muted-foreground/70">
            ← {opponentAbbrev}
          </span>
        )}
        {gradations.map((margin) => (
          <span
            key={margin}
            // Signed, because the axis is a margin: −7 is the pick team losing by
            // a touchdown, +7 is them winning by one.
            className="absolute top-0 w-7 text-center text-[8px] font-black leading-none text-muted-foreground/70"
            style={{ left: `${fraction(margin) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {margin < 0 ? '−' : '+'}
            {formatMargin(Math.abs(margin))}
          </span>
        ))}
        <span
          className="absolute top-0 w-8 text-center text-[8px] font-black leading-none tracking-[0.05em] text-muted-foreground"
          style={{ left: `${fraction(0) * 100}%`, transform: 'translateX(-50%)' }}
        >
          TIE
        </span>
        {pickAbbrev && (
          <span className="absolute right-0 top-0 text-[8px] font-black uppercase tracking-[0.04em] text-muted-foreground/70">
            {pickAbbrev} →
          </span>
        )}
      </div>

      <GapBracket
        startFraction={breakEvenF}
        endFraction={modelF}
        tone={tone}
        containerWidth={width}
        label={outcome.covers ? `${cushionText} pts of room` : `${cushionText} pts short`}
      />

      <ZoneVerdicts
        loseLabel="Loses"
        loseText={outcome.loseCondition}
        winLabel="Covers"
        winText={outcome.coverCondition}
      />
    </div>
  );
}
