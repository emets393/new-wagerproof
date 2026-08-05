import { cn } from '@/lib/utils';
import { formatPctile } from '../format';
import { StatTip } from './StatTip';

/** Circular percentile ring — fill arc = served pctile. No derived math. */
export function PctileRing({
  label,
  value,
  pctile,
  descriptive = false,
  tip,
  size = 68,
}: {
  label: string;
  value: string;
  pctile: number | null;
  descriptive?: boolean;
  tip?: string;
  size?: number;
}) {
  const stroke = 4.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const hasRank = !descriptive && pctile != null && !Number.isNaN(Number(pctile));
  const clamped = hasRank ? Math.max(0, Math.min(100, Number(pctile))) : 0;
  const offset = c * (1 - clamped / 100);
  const tone = !hasRank
    ? 'stroke-muted-foreground/40'
    : clamped >= 70
      ? 'stroke-emerald-500'
      : clamped <= 30
        ? 'stroke-rose-500'
        : 'stroke-amber-500';

  return (
    <div className="flex w-[76px] flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-black/10 dark:text-white/10"
          />
          {hasRank && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
              className={cn(tone, 'transition-[stroke-dashoffset] duration-300')}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[12px] font-bold leading-none">{value}</span>
          {hasRank && (
            <span className="mt-0.5 text-[9px] font-semibold text-muted-foreground">
              {formatPctile(pctile)}
            </span>
          )}
        </div>
      </div>
      <span className="inline-flex items-center gap-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
        {tip ? <StatTip tip={tip} label={label} /> : label}
      </span>
    </div>
  );
}
