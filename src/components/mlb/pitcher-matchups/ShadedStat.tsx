import React from 'react';
import type { LeagueBenchmarkPercentiles } from '@/types/mlb-matchups';
import { bucketToClass, bucketTooltip, getStatBucket } from '@/utils/statShading';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ShadedStatProps {
  label: string;
  value: string;
  raw: number | null | undefined;
  benchmark: LeagueBenchmarkPercentiles | null | undefined;
  higherIsBetter?: boolean;
}

export function ShadedStat({ label, value, raw, benchmark, higherIsBetter = true }: ShadedStatProps) {
  if (!benchmark) {
    return (
      <div className="space-y-0.5">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
      </div>
    );
  }

  const bucket =
    raw != null && Number.isFinite(raw)
      ? getStatBucket(raw, benchmark.p10, benchmark.p25, benchmark.p75, benchmark.p90, higherIsBetter)
      : null;

  if (!bucket) {
    return (
      <div className="space-y-0.5">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
      </div>
    );
  }

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div className="space-y-0.5 cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <p className="text-[10px] text-muted-foreground">{label}</p>
          <p className={cn('text-sm font-semibold tabular-nums', bucketToClass(bucket))}>{value}</p>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[100] text-xs">
        {bucketTooltip(bucket)}
      </TooltipContent>
    </Tooltip>
  );
}
