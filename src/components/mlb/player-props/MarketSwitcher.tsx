import React from 'react';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import { marketLabel } from '@/utils/mlbPlayerProps';
import { cn } from '@/lib/utils';

interface MarketSwitcherProps {
  props: MlbPlayerPropRow[];
  selectedMarket: string;
  onSelect: (market: string) => void;
}

export function MarketSwitcher({ props, selectedMarket, onSelect }: MarketSwitcherProps) {
  if (props.length <= 1) return null;

  return (
    <div
      className="flex flex-wrap gap-1 p-1 rounded-lg bg-muted/30 border border-border/60"
      role="tablist"
    >
      {props.map(p => {
        const active = p.market === selectedMarket;
        return (
          <button
            key={p.market}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(p.market)}
            className={cn(
              'min-h-[40px] px-2.5 py-1 rounded-md text-xs font-medium',
              'motion-reduce:transition-none transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {marketLabel(p.market).replace(/\s*\([^)]*\)/, '')}
          </button>
        );
      })}
    </div>
  );
}
