import React from 'react';
import type { TopPlayEntry } from '@/types/mlb-matchups';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TopPlayColumnProps {
  title: string;
  emoji: string;
  entries: TopPlayEntry[];
  onSelect: (entry: TopPlayEntry) => void;
  scoreLabel?: string;
}

export function TopPlayColumn({
  title,
  emoji,
  entries,
  onSelect,
  scoreLabel = 'Score',
}: TopPlayColumnProps) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 space-y-2 min-w-0">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {emoji} {title}
      </h3>
      <TooltipProvider delayDuration={200}>
        <ul className="space-y-1.5">
          {entries.map(entry => (
            <li key={`${entry.game_pk}-${entry.player_id}-${entry.score}`}>
              <Tooltip>
                <TooltipTrigger asChild touchTapMode="open-then-action">
                  <button
                    type="button"
                    onClick={() => onSelect(entry)}
                    className="w-full text-left rounded-md border border-border/60 px-2 py-1.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {entry.player_name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] shrink-0 tabular-nums">
                        {entry.score}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {entry.context}
                    </p>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm text-xs space-y-2">
                  <p className="font-semibold">
                    {scoreLabel}: {entry.score}
                  </p>
                  {entry.breakdown.map(b => (
                    <div key={b.component} className="space-y-0.5">
                      <div className="flex justify-between gap-3">
                        <span>{b.component}</span>
                        <span className="font-medium tabular-nums">
                          {b.component === 'Park' && b.value > 0 ? '+' : ''}
                          {b.value}
                        </span>
                      </div>
                      {b.detail ? (
                        <p className="text-muted-foreground leading-snug whitespace-pre-line">
                          {b.detail}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      </TooltipProvider>
    </div>
  );
}
