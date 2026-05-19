import React from 'react';
import type { LeagueBenchmarkPercentiles } from '@/types/mlb-matchups';
import { bucketToClass, bucketTooltip, getStatBucket } from '@/utils/statShading';
import { computeTrend, trendArrow, trendClass } from '@/utils/trendIndicator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface StatWithRecentProps {
  label: string;
  seasonValue: number | null | undefined;
  recentValue: number | null | undefined;
  formatted: (v: number | null | undefined) => string;
  benchmark?: LeagueBenchmarkPercentiles | null;
  higherIsBetter?: boolean;
  windowLabel?: string;
}

export function StatWithRecent({
  label,
  seasonValue,
  recentValue,
  formatted,
  benchmark,
  higherIsBetter = true,
  windowLabel = 'L10',
}: StatWithRecentProps) {
  const trend = computeTrend(recentValue, seasonValue, higherIsBetter);
  const seasonBucket =
    benchmark && seasonValue != null && Number.isFinite(seasonValue)
      ? getStatBucket(
          seasonValue,
          benchmark.p10,
          benchmark.p25,
          benchmark.p75,
          benchmark.p90,
          higherIsBetter,
        )
      : null;

  const showRecent =
    recentValue != null && Number.isFinite(recentValue) && trend !== 'na';

  const seasonDisplay = (
    <span className={cn('text-sm font-semibold tabular-nums', bucketToClass(seasonBucket))}>
      {formatted(seasonValue)}
    </span>
  );

  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        {seasonBucket && benchmark ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span className="cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {seasonDisplay}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="z-[100] text-xs">
              {bucketTooltip(seasonBucket)}
            </TooltipContent>
          </Tooltip>
        ) : (
          seasonDisplay
        )}
        {showRecent ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild touchTapMode="toggle">
              <span
                className={cn(
                  'text-xs tabular-nums cursor-help touch-manipulation',
                  trendClass(trend),
                )}
              >
                {windowLabel}: {formatted(recentValue)} {trendArrow(trend)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="z-[100] max-w-xs">
              <p className="text-sm">Last 10 games vs this pitcher hand</p>
              <p className="text-xs text-muted-foreground mt-1">
                Season: {formatted(seasonValue)} → {windowLabel}: {formatted(recentValue)}
              </p>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
