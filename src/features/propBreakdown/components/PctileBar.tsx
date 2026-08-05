import { cn } from '@/lib/utils';
import { formatPctile, formatRatePct } from '../format';
import { StatTip } from './StatTip';

/** Compact defense mix row — bar fill = served rate (how often they play it). */
export function PctileBar({
  label,
  rate,
  pctile,
  tip,
  emphasized = false,
  className,
}: {
  label: string;
  rate: number;
  pctile: number;
  tip?: string;
  emphasized?: boolean;
  className?: string;
}) {
  const ratePct = Math.max(0, Math.min(100, Math.round(rate * 100)));
  const tone =
    ratePct >= 45 ? 'bg-foreground/70' : ratePct >= 25 ? 'bg-foreground/45' : 'bg-foreground/25';

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[12px]',
            emphasized ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'
          )}
        >
          {tip ? <StatTip tip={tip} label={label} /> : label}
          {emphasized && (
            <span className="rounded bg-primary/15 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-primary">
              key
            </span>
          )}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          <span className={cn(emphasized && 'font-bold text-foreground')}>{formatRatePct(rate)}</span>
          <span className="opacity-60"> · {formatPctile(pctile)}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', tone)}
          style={{ width: `${ratePct}%` }}
          title={`${formatRatePct(rate)} of snaps · ${formatPctile(pctile)} league`}
        />
      </div>
    </div>
  );
}
