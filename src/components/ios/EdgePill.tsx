import * as React from 'react';
import { cn } from '@/lib/utils';

// iOS edge tiering: bigger model-vs-market edge = greener.
function edgeColors(magnitude: number): { text: string; bg: string } {
  if (magnitude >= 5) return { text: '#22C55E', bg: 'rgba(34,197,94,0.14)' };
  if (magnitude >= 3) return { text: '#84CC16', bg: 'rgba(132,204,22,0.14)' };
  if (magnitude >= 2) return { text: '#F59E0B', bg: 'rgba(245,158,11,0.14)' };
  return { text: '#F97316', bg: 'rgba(249,115,22,0.14)' };
}

const TONE_COLORS = {
  over: { text: '#22C55E', bg: 'rgba(34,197,94,0.14)' },
  under: { text: '#EF4444', bg: 'rgba(239,68,68,0.14)' },
} as const;

interface EdgePillProps {
  text: string;
  /** Absolute edge magnitude driving the color tier (ignored when tone is over/under). */
  magnitude: number;
  /** Total lean: green up / red down. Defaults to magnitude-tiered edge colors. */
  tone?: 'edge' | 'over' | 'under';
  icon?: React.ReactNode;
  className?: string;
  title?: string;
  'aria-label'?: string;
}

/**
 * Model edge pill (e.g. "ML" + team logo, "O/U" + arrow) with magnitude-tiered
 * or Over/Under tone colors.
 */
export function EdgePill({
  text,
  magnitude,
  tone = 'edge',
  icon,
  className,
  title,
  'aria-label': ariaLabel,
}: EdgePillProps) {
  const { text: color, bg } =
    tone === 'over' || tone === 'under' ? TONE_COLORS[tone] : edgeColors(Math.abs(magnitude));
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-mono text-[11px] font-bold',
        className
      )}
      style={{ color, backgroundColor: bg }}
      title={title}
      aria-label={ariaLabel}
    >
      {icon}
      {text}
    </span>
  );
}
