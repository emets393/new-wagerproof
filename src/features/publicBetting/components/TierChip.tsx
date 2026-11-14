import { cn } from '@/lib/utils';
import type { MarketRead } from '../types';

interface TierChipProps {
  read: MarketRead;
  /** Set on sharp_money so the chip ring matches the wedge and the arrow. */
  ringColor?: string;
}

export function TierChip({ read, ringColor }: TierChipProps) {
  if (read.emphasis === 'none' || !read.chip) return null;
  const loud = read.emphasis === 'loud';
  const medium = read.emphasis === 'medium';
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none',
        loud && 'bg-foreground text-background',
        medium && 'border border-foreground/25 bg-foreground/10 text-foreground',
        read.emphasis === 'quiet' &&
          'border border-black/10 bg-transparent font-semibold text-muted-foreground dark:border-white/10',
      )}
      style={
        loud && ringColor
          ? { boxShadow: `0 0 0 ${read.strong ? 2 : 1.5}px ${ringColor}, 0 0 0 ${read.strong ? 5 : 4}px ${ringColor}33` }
          : undefined
      }
    >
      <span className="truncate">{read.chip}</span>
    </span>
  );
}
