import React from 'react';
import type { ParkHRFactors } from '@/hooks/usePark';
import type { MatchupGame } from '@/types/mlb-matchups';
import { buildParkTooltip } from '@/utils/parkHr';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ParkBannerProps {
  park: ParkHRFactors | null | undefined;
  game: MatchupGame;
}

export function ParkBanner({ park, game }: ParkBannerProps) {
  if (!park) return null;

  const lhbBoost = park.lhb_hr_factor >= 1.05;
  const rhbBoost = park.rhb_hr_factor >= 1.05;
  const showHrBadge = lhbBoost || rhbBoost;
  const suppressor = park.lhb_hr_factor <= 0.93 && park.rhb_hr_factor <= 0.93;

  let hrBadge: React.ReactNode = null;
  if (showHrBadge) {
    const lhbPct = Math.round((park.lhb_hr_factor - 1) * 100);
    const rhbPct = Math.round((park.rhb_hr_factor - 1) * 100);
    const label =
      park.lhb_hr_factor > park.rhb_hr_factor
        ? `LHB +${lhbPct}% HR`
        : `RHB +${rhbPct}% HR`;
    hrBadge = (
      <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
        {label}
      </Badge>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-wrap items-center gap-2 text-sm cursor-help w-fit">
            <span className="text-muted-foreground">🏟️</span>
            <span className="font-medium text-foreground">{park.venue_name}</span>
            {hrBadge}
            {suppressor ? (
              <Badge variant="outline" className="border-blue-500/40 text-blue-600 dark:text-blue-400">
                Pitcher&apos;s park
              </Badge>
            ) : null}
            {park.has_roof ? (
              <Badge variant="outline" className="text-muted-foreground">
                Roof
              </Badge>
            ) : null}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm text-xs leading-relaxed whitespace-pre-line">
          {buildParkTooltip(park, game)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
