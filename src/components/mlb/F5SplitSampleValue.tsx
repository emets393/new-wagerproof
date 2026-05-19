import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { splitSampleTier } from '@/utils/mlbF5Splits';

function NotEnoughData() {
  return (
    <span className="text-xs sm:text-sm text-muted-foreground italic whitespace-nowrap">
      Not enough data
    </span>
  );
}

function smallSampleTooltip(games: number, vsLhp: boolean): string {
  const base =
    `Small sample (${games} game${games === 1 ? '' : 's'}). Numbers are real but may not stabilize until ` +
    'mid-summer when this split gets more reps.';
  if (vsLhp) {
    return `${base} Left-handed starters are scarce — this split rarely exceeds 15–20 games even in a full season.`;
  }
  return base;
}

function adequateSampleTooltip(games: number): string {
  return `Early-season sample (${games} games). Useful trend, but this split may shift as more games accumulate.`;
}

interface F5SplitSampleValueProps {
  games: number;
  children: React.ReactNode;
  /** Opposing starter is left-handed (scarce split). */
  vsLhp?: boolean;
}

export function F5SplitSampleValue({ games, children, vsLhp = false }: F5SplitSampleValueProps) {
  const tier = splitSampleTier(games);

  if (tier === 'hide') {
    return <NotEnoughData />;
  }

  if (tier === 'small') {
    return (
      <Tooltip>
        <TooltipTrigger asChild touchTapMode="toggle">
          <span className="opacity-70 italic inline-flex items-center gap-0.5 cursor-help touch-manipulation">
            {children}
            <span className="text-xs" aria-hidden>
              *
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {smallSampleTooltip(games, vsLhp)}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (tier === 'adequate') {
    return (
      <Tooltip>
        <TooltipTrigger asChild touchTapMode="toggle">
          <span className="cursor-help touch-manipulation">{children}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {adequateSampleTooltip(games)}
        </TooltipContent>
      </Tooltip>
    );
  }

  return <>{children}</>;
}

export function F5SplitGamesSubtext({
  games,
  suffix,
}: {
  games: number;
  suffix?: string;
}) {
  const tier = splitSampleTier(games);
  if (tier === 'hide') return null;

  const gamesLabel = `${games} game${games === 1 ? '' : 's'}`;
  const text = suffix ? `${suffix} · ${gamesLabel}` : gamesLabel;

  return (
    <span className={tier === 'small' ? 'text-amber-600 dark:text-amber-500' : undefined}>
      {text}
      {tier === 'small' ? ' *' : tier === 'robust' ? ' ✓' : null}
    </span>
  );
}
