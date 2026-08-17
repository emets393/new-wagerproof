import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  GapBracket,
  MarkerCaption,
  Tick,
  TONE,
  ZoneVerdicts,
  captionsNeedStack,
  separateCaptions,
  useMeasuredWidth,
} from './chartChrome';
import { NFL_EDGE_SCALE, type EdgeScale } from './edgeScale';
import {
  formatMargin,
  marginLabel,
  spreadCoverOutcome,
  spreadCoverSummary,
  spreadMarginAxisDomain,
  spreadTickLabel,
} from './spreadCover';

/**
 * The spread pick drawn on a **margin axis** — what happens on the scoreboard.
 *
 * ## Left is the opponent, right is the pick
 * The axis runs from the opponent winning big, through TIE, to the pick team
 * winning big. Axis ticks write the pick team's line at that score (`LA −4`
 * when they lead by 4, `LA +4` when they trail by 4).
 *
 * ## The colours are the bet
 * The break-even sits where the market's number puts it. Everything to its
 * right covers, everything to its left loses, and on a whole-number line the
 * single margin that pushes gets its own amber sliver between them. The
 * cover/lose captions underneath are the same sentences, in the same unit,
 * under the same halves.
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
  const domain = React.useMemo(
    () => spreadMarginAxisDomain(outcome.threshold, modelMargin, scale.spreadWindow),
    [outcome.threshold, modelMargin, scale.spreadWindow],
  );

  const fraction = React.useCallback(
    (margin: number) => {
      const span = domain.max - domain.min;
      if (span <= 0) return 0.5;
      return Math.min(Math.max((margin - domain.min) / span, 0.008), 0.992);
    },
    [domain.min, domain.max],
  );

  // On a whole-number line the push owns a half-point either side of the
  // threshold, so cover starts above it and loss ends below it.
  const coverStartMargin = outcome.threshold + (outcome.hasPush ? 0.5 : 0);
  const loseEndMargin = outcome.threshold - (outcome.hasPush ? 0.5 : 0);
  const marketF = fraction(outcome.threshold);
  const modelF = fraction(outcome.modelMargin);
  const coverStartF = fraction(coverStartMargin);
  const loseEndF = fraction(loseEndMargin);
  const tone = outcome.covers ? 'win' : 'loss';

  const captionWidth = 96;
  const [marketCaptionX, modelCaptionX] = separateCaptions(
    marketF * width,
    modelF * width,
    captionWidth,
    width,
  );
  const stackCaptions = captionsNeedStack(marketCaptionX, modelCaptionX, captionWidth);
  // Keep the left-er caption on top when stacking so the pair still reads L→R.
  const marketOnTop = !stackCaptions || marketCaptionX <= modelCaptionX;

  const cushionText = formatMargin(Math.abs(outcome.cushion));
  const label = (margin: number, verbose = false) =>
    marginLabel(margin, pickAbbrev, opponentAbbrev, verbose);

  return (
    <div
      ref={rootRef}
      className={cn('flex flex-col gap-2', className)}
      role="img"
      aria-label={spreadCoverSummary(outcome, pickAbbrev, opponentAbbrev)}
    >
      <div className={cn('relative', stackCaptions ? 'h-[52px]' : 'h-[30px]')}>
        <MarkerCaption
          label={outcome.hasPush ? 'Push' : 'Break-even'}
          value={label(outcome.threshold, true)}
          valueClassName="text-foreground"
          x={marketCaptionX}
          width={captionWidth}
          stackOffset={stackCaptions ? (marketOnTop ? 0 : 22) : 0}
        />
        <MarkerCaption
          label="Model"
          value={label(outcome.modelMargin, true)}
          valueClassName={TONE[tone].text}
          x={modelCaptionX}
          width={captionWidth}
          stackOffset={stackCaptions ? (marketOnTop ? 22 : 0) : 0}
        />
      </div>

      <div className="relative h-8" aria-hidden>
        <span className="absolute inset-x-0 top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-emerald-500/20" />
        <span
          className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-red-500/75"
          style={{ left: 0, width: `${loseEndF * 100}%` }}
        />
        <span
          className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-emerald-500/85"
          style={{ left: `${coverStartF * 100}%`, right: 0 }}
        />
        {outcome.hasPush && (
          <span
            className="absolute top-1/2 h-3.5 -translate-y-1/2 bg-amber-500/90"
            style={{
              left: `${loseEndF * 100}%`,
              width: `${Math.max((coverStartF - loseEndF) * 100, 0.5)}%`,
            }}
          />
        )}

        {domain.ticks
          .filter((t) => t !== 0)
          .map((margin) => (
            <span
              key={margin}
              className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-foreground/[0.16]"
              style={{ left: `${fraction(margin) * 100}%` }}
            />
          ))}

        {domain.ticks.includes(0) && (
          <span
            className="absolute top-1/2 h-3.5 w-[1.5px] -translate-y-1/2 bg-foreground/45"
            style={{ left: `${fraction(0) * 100}%` }}
          />
        )}

        <Tick fraction={marketF} className="bg-foreground" width={3} height={26} />
        <Tick fraction={modelF} className={TONE[tone].fill} width={3.5} height={30} />
      </div>

      {/* Ticks are the pick team's line at that score (`LA −4`, `LA +4`). */}
      <div className="relative h-3" aria-hidden>
        {domain.ticks.map((margin) => (
          <span
            key={margin}
            className={cn(
              'absolute top-0 w-[52px] truncate text-center text-[8px] font-black leading-none',
              margin === 0 ? 'tracking-[0.05em] text-muted-foreground' : 'text-muted-foreground/70',
            )}
            style={{ left: `${fraction(margin) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {spreadTickLabel(margin, pickAbbrev)}
          </span>
        ))}
      </div>

      <GapBracket
        startFraction={marketF}
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
