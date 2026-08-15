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
import { moneylineOutcome } from './moneyline';

/**
 * Break-even win rate against the model's win rate on a 0-100% axis, with a
 * coin-flip reference at the centre.
 *
 * Anchored at 50% for the same reason `SpreadCoverBar` anchors at a tie: the
 * axis needs a real-world reference a reader already understands, not a betting
 * abstraction. Everything right of the break-even marker is +EV.
 *
 * The break-even is the price's RAW implied probability — see `moneyline.ts` for
 * why nothing here de-vigs.
 *
 * Port of `WagerproofDesign/Components/MoneylineEdgeBar.swift`.
 */
export function MoneylineEdgeBar({
  price,
  modelProbability,
  scale = NFL_EDGE_SCALE,
  teamAbbrev,
  className,
}: {
  /** American odds for the side being bet. */
  price: number;
  /** The model's win probability for that side, 0-1. */
  modelProbability: number;
  scale?: EdgeScale;
  teamAbbrev?: string | null;
  className?: string;
}) {
  const [rootRef, width] = useMeasuredWidth<HTMLDivElement>();
  const outcome = React.useMemo(
    () => moneylineOutcome(price, modelProbability, scale),
    [price, modelProbability, scale],
  );

  const fraction = (percent: number) => Math.min(Math.max(percent / 100, 0.008), 0.992);
  const breakEvenF = fraction(outcome.breakEvenPercent);
  const modelF = fraction(outcome.modelPercent);
  const tone = outcome.isPositiveValue ? 'win' : 'loss';

  const captionWidth = 84;
  const [breakEvenCaptionX, modelCaptionX] = separateCaptions(
    breakEvenF * width,
    modelF * width,
    captionWidth,
    width,
  );

  const breakEvenText = `${outcome.breakEvenPercent.toFixed(1)}%`;
  const edgeText = Math.abs(outcome.edge).toFixed(1);
  const gradations = [25, 50, 75];

  return (
    <div
      ref={rootRef}
      className={cn('flex flex-col gap-2', className)}
      role="img"
      aria-label={`Break-even ${breakEvenText}, model ${outcome.modelPercent.toFixed(1)}%. ${outcome.zoneTitle}.`}
    >
      <div className="relative h-[30px]">
        <MarkerCaption
          label="Break-even"
          value={breakEvenText}
          valueClassName="text-foreground"
          x={breakEvenCaptionX}
          width={captionWidth}
        />
        <MarkerCaption
          label={teamAbbrev ? `${teamAbbrev} model` : 'Model'}
          value={`${outcome.modelPercent.toFixed(1)}%`}
          valueClassName={TONE[tone].text}
          x={modelCaptionX}
          width={captionWidth}
        />
      </div>

      <div className="relative h-8" aria-hidden>
        <span className="absolute inset-x-0 top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-red-500/20" />
        {/* Everything past the required win rate is profitable at this price. */}
        <span
          className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-emerald-500/85"
          style={{ left: `${breakEvenF * 100}%`, right: 0 }}
        />
        {gradations.map((mark) => (
          <span
            key={mark}
            className={cn(
              'absolute top-1/2 h-3.5 -translate-y-1/2',
              mark === 50 ? 'w-[1.5px] bg-foreground/45' : 'w-px bg-foreground/[0.16]',
            )}
            style={{ left: `${fraction(mark) * 100}%` }}
          />
        ))}

        <Tick fraction={breakEvenF} className="bg-foreground" width={3} height={26} />
        <Tick fraction={modelF} className={TONE[tone].fill} width={3.5} height={30} />
      </div>

      <div className="relative h-3" aria-hidden>
        {gradations.map((mark) => (
          <span
            key={mark}
            className={cn(
              'absolute top-0 w-14 text-center text-[8px] font-black leading-none',
              mark === 50 ? 'tracking-[0.05em] text-muted-foreground' : 'text-muted-foreground/70',
            )}
            style={{ left: `${fraction(mark) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {mark === 50 ? 'COIN FLIP' : `${mark}%`}
          </span>
        ))}
      </div>

      <GapBracket
        startFraction={breakEvenF}
        endFraction={modelF}
        tone={tone}
        containerWidth={width}
        label={outcome.isPositiveValue ? `${edgeText} pts of value` : `${edgeText} pts short`}
      />

      <ZoneVerdicts
        loseLabel="Loses long-term"
        loseText={`Wins under ${breakEvenText} of the time`}
        winLabel={outcome.zoneTitle}
        winText={`Wins over ${breakEvenText} of the time`}
      />
    </div>
  );
}
