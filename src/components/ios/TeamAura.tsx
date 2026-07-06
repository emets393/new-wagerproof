import * as React from 'react';
import { cn } from '@/lib/utils';

interface TeamAuraProps {
  /** Away team color — glows from the left edge. */
  awayColor: string;
  /** Home team color — glows from the right edge. Omit for a single-tint aura. */
  homeColor?: string;
  className?: string;
}

/**
 * Soft team-color glow behind detail content (web take on the iOS
 * TeamAuraBackground): two blurred radial blobs anchored top-left/top-right.
 * Parent must be `relative`; this layer never captures pointer events.
 */
export function TeamAura({ awayColor, homeColor, className }: TeamAuraProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <div
        className="absolute -left-24 -top-24 h-[380px] w-[380px] rounded-full opacity-35 blur-3xl dark:opacity-45"
        style={{
          background: `radial-gradient(circle, ${awayColor} 0%, transparent 70%)`,
        }}
      />
      <div
        className="absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full opacity-35 blur-3xl dark:opacity-45"
        style={{
          background: `radial-gradient(circle, ${homeColor ?? awayColor} 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}
