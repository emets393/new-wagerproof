import * as React from 'react';
import { cn } from '@/lib/utils';

// iOS edge tiering: bigger model-vs-market edge = greener.
function edgeColors(magnitude: number): { text: string; bg: string } {
  if (magnitude >= 5) return { text: '#22C55E', bg: 'rgba(34,197,94,0.14)' };
  if (magnitude >= 3) return { text: '#84CC16', bg: 'rgba(132,204,22,0.14)' };
  if (magnitude >= 2) return { text: '#F59E0B', bg: 'rgba(245,158,11,0.14)' };
  return { text: '#F97316', bg: 'rgba(249,115,22,0.14)' };
}

interface EdgePillProps {
  text: string;
  /** Absolute edge magnitude driving the color tier. */
  magnitude: number;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Model edge pill (e.g. "ML +6.2%", "O/U +3.5") with magnitude-tiered color.
 */
export function EdgePill({ text, magnitude, icon, className }: EdgePillProps) {
  const { text: color, bg } = edgeColors(Math.abs(magnitude));
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold',
        className
      )}
      style={{ color, backgroundColor: bg }}
    >
      {icon}
      {text}
    </span>
  );
}
