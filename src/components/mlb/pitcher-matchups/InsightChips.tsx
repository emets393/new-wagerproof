import React from 'react';
import type { Insight } from './insightEngine';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function toneClass(tone: Insight['tone']) {
  switch (tone) {
    case 'danger':
      return 'bg-red-500/10 text-red-800 dark:text-red-300 border-red-500/30';
    case 'warn':
      return 'bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/30';
    case 'positive':
      return 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 border-emerald-500/30';
    default:
      return 'bg-muted/80 text-muted-foreground border-border';
  }
}

interface InsightChipsProps {
  insights: Insight[];
  className?: string;
  size?: 'sm' | 'md';
}

export function InsightChips({ insights, className, size = 'md' }: InsightChipsProps) {
  if (insights.length === 0) return null;

  const textSize = size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs sm:text-sm px-2 py-1';

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('flex flex-wrap gap-1.5', className)}>
        {insights.map(insight => (
          <Tooltip key={insight.id}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn('cursor-help font-normal leading-snug max-w-full', textSize, toneClass(insight.tone))}
              >
                {insight.headline}
                {import.meta.env.DEV ? (
                  <span className="ml-1 opacity-50 text-[9px]">({insight.priority})</span>
                ) : null}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs leading-relaxed">
              {insight.detail}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
