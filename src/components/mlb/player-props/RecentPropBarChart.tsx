import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface ChartBar {
  value: number;
  cleared: boolean;
  isDay: boolean;
  archetype: string | null;
  date: string | null;
}

interface RecentPropBarChartProps {
  bars: ChartBar[];
  line: number;
  valueLabel?: string;
  className?: string;
}

function formatBarValue(v: number): string {
  if (!Number.isFinite(v)) return '0';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// Render an ISO date "2026-05-22" as "5/22" — terse enough to fit under a bar
// when rotated. Returns empty string if the input isn't parseable.
function formatShortDate(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  return `${Number(m[2])}/${Number(m[3])}`;
}

export function RecentPropBarChart({
  bars,
  line,
  valueLabel = 'Val',
  className,
}: RecentPropBarChartProps) {
  // Anchor so the threshold line stays at a stable height across line changes.
  const maxVal = useMemo(() => {
    const vals = bars.map(b => b.value);
    return Math.max(line * 1.5, ...vals, line + 1, 1);
  }, [bars, line]);

  const thresholdPct = (line / maxVal) * 100;

  if (bars.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic py-6 text-center">No recent games</p>
    );
  }

  return (
    <div className={cn('relative w-full', className)}>
      <div className="relative h-36 sm:h-44">
        <div
          className="absolute left-0 right-0 border-t border-dashed border-primary/60 z-10 pointer-events-none"
          style={{ bottom: `${thresholdPct}%` }}
          aria-hidden
        />
        <span
          className="absolute right-0 z-10 text-[10px] font-semibold text-primary tabular-nums bg-background/80 px-1.5 py-0.5 rounded pointer-events-none"
          style={{ bottom: `calc(${thresholdPct}% + 2px)` }}
          aria-hidden
        >
          Line {formatBarValue(line)}
        </span>
        <div className="flex items-end gap-1 sm:gap-1.5 h-full">
          {bars.map((bar, i) => {
            const rawPct = (bar.value / maxVal) * 100;
            const heightPct = Math.max(10, rawPct);
            return (
              <div
                key={i}
                className="flex-1 flex flex-col justify-end h-full min-w-[12px] relative"
                title={`${valueLabel}: ${formatBarValue(bar.value)}${bar.date ? ` · ${bar.date}` : ''} · ${bar.isDay ? 'Day' : 'Night'}${bar.archetype ? ` · vs ${bar.archetype}` : ''}`}
              >
                <span
                  className={cn(
                    'absolute left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-bold tabular-nums leading-none',
                    bar.cleared ? 'text-primary' : 'text-red-500',
                  )}
                  style={{ bottom: `calc(${heightPct}% + 2px)` }}
                >
                  {formatBarValue(bar.value)}
                </span>
                <div
                  className={cn(
                    'w-full rounded-t-sm transition-all duration-150 ease-out motion-reduce:transition-none',
                    bar.cleared ? 'bg-primary' : 'bg-red-500/70',
                  )}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
      {/* Slanted date labels. Fixed-height row + tilted origin so labels can sit
          on their own line under each bar without colliding with each other. */}
      <div className="flex gap-1 sm:gap-1.5 mt-1 h-7">
        {bars.map((bar, i) => (
          <div key={i} className="flex-1 min-w-[12px] flex items-start justify-center overflow-visible">
            <span
              className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap origin-top-left"
              style={{ transform: 'rotate(-45deg) translateY(2px)' }}
            >
              {formatShortDate(bar.date)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-1 tabular-nums">
        Last {bars.length} games · oldest left → most recent right
      </p>
    </div>
  );
}
