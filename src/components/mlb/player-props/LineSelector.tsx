import React from 'react';
import type { MlbPlayerPropLineEntry } from '@/types/mlb-player-props';
import { formatPropOdds } from '@/utils/mlbPlayerProps';
import { cn } from '@/lib/utils';

interface LineSelectorProps {
  lines: MlbPlayerPropLineEntry[];
  selectedLine: number;
  onSelect: (line: number) => void;
}

export function LineSelector({ lines, selectedLine, onSelect }: LineSelectorProps) {
  if (lines.length === 0) return null;

  return (
    <div className="space-y-1">
      <p
        className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium"
        title="Sportsbooks post alternate prop lines (e.g. 0.5 / 1.5 / 2.5 hits). Tap a line to recalc the hit rate, bar chart and odds for that line."
      >
        Alternate lines
      </p>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        {lines.map(entry => {
          const active = entry.line === selectedLine;
          return (
            <button
              key={entry.line}
              type="button"
              onClick={() => onSelect(entry.line)}
              title={`Recalculate using the ${entry.line} line.`}
              className={cn(
                'shrink-0 min-h-[40px] px-3 py-1.5 rounded-full border text-xs tabular-nums',
                'motion-reduce:transition-none transition-colors duration-150 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50',
              )}
            >
              <span className="font-semibold">{entry.line}</span>
              {entry.over != null ? (
                <span className={cn('ml-1.5', active ? 'opacity-90' : 'opacity-70')}>
                  O {formatPropOdds(entry.over)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
