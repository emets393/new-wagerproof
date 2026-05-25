import React from 'react';
import { cn } from '@/lib/utils';

interface PropMiniVizProps {
  strip: { cleared: boolean; value: number }[];
  className?: string;
}

export function PropMiniViz({ strip, className }: PropMiniVizProps) {
  if (strip.length === 0) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }

  return (
    <div className={cn('flex items-end gap-px h-4 shrink-0', className)} aria-hidden>
      {strip.map((g, i) => (
        <span
          key={i}
          className={cn(
            'w-[5px] sm:w-[6px] rounded-t-[1px]',
            g.cleared ? 'bg-primary h-full' : 'bg-primary/20',
            g.cleared ? 'min-h-[10px]' : 'min-h-[4px]',
          )}
          style={{ height: g.cleared ? `${Math.min(100, 40 + g.value * 8)}%` : '25%' }}
        />
      ))}
    </div>
  );
}
