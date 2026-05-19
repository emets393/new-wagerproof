import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { PitcherArchetypeProfile } from '@/utils/mlbPitcherArchetypes';
import {
  ARCHETYPE_META,
  archetypeDescription,
  isDisplayArchetype,
} from '@/utils/mlbPitcherArchetypes';

interface PitcherArchetypeBadgeProps {
  archetype: PitcherArchetypeProfile | null | undefined;
}

export function PitcherArchetypeBadge({ archetype }: PitcherArchetypeBadgeProps) {
  if (!archetype || !isDisplayArchetype(archetype.archetype)) return null;

  const meta = ARCHETYPE_META[archetype.archetype];

  return (
    <Tooltip>
      <TooltipTrigger asChild touchTapMode="toggle">
        <Badge variant="outline" className={`${meta.color} text-xs shrink-0`}>
          {meta.icon} {meta.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="text-sm space-y-1">
          <p className="font-semibold">{meta.label}</p>
          <p className="text-xs text-muted-foreground">
            {archetype.k_pct != null ? `K% ${archetype.k_pct.toFixed(1)}` : 'K% —'}
            {' · '}
            {archetype.bb_pct != null ? `BB% ${archetype.bb_pct.toFixed(1)}` : 'BB% —'}
            {' · '}
            {archetype.gb_pct != null ? `GB% ${archetype.gb_pct.toFixed(1)}` : 'GB% —'}
            {' · '}
            {archetype.fb_pct != null ? `FB% ${archetype.fb_pct.toFixed(1)}` : 'FB% —'}
          </p>
          {archetype.max_fb_velo != null ? (
            <p className="text-xs text-muted-foreground">
              Max FB velo: {archetype.max_fb_velo.toFixed(1)} mph
            </p>
          ) : null}
          <p className="text-xs">{archetypeDescription(archetype.archetype)}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
