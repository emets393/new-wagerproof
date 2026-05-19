import React from 'react';
import type { PowerStackAlert as PowerStack } from '@/types/mlb-matchups';
import { SCORE_CONSTANTS } from './topPlaysScoring';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PowerStackAlertProps {
  stacks: PowerStack[];
}

export function PowerStackAlert({ stacks }: PowerStackAlertProps) {
  const displayed = stacks.slice(0, SCORE_CONSTANTS.POWER_STACK_MAX_DISPLAYED);
  if (displayed.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-2">
        {displayed.map(stack => (
          <Tooltip key={`${stack.game_pk}-${stack.team_name}`}>
            <TooltipTrigger asChild>
              <div className="border border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/5 p-3 rounded-md flex items-center gap-3 cursor-help text-sm">
                <span aria-hidden>⚡</span>
                <p className="text-foreground">
                  <strong>{stack.team_name}</strong>: {stack.hr_count} hitters with elite HR threat
                  scores vs <strong>{stack.opp_pitcher}</strong>
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="space-y-1 text-sm">
                <p className="font-medium mb-1">Top HR threats:</p>
                {stack.top_hitters.map(h => (
                  <p key={h.player_name}>
                    {h.player_name}: <span className="font-bold tabular-nums">{h.score}</span>
                  </p>
                ))}
                <p className="text-xs text-muted-foreground mt-2">
                  Total stack strength: {stack.stack_strength}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
