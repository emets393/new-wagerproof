import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentStatTileProps {
  label: string;
  value: string;
  /** Blur-locks the value behind a Pro badge (Net Units for non-Pro viewers). */
  locked?: boolean;
  positive?: boolean;
  negative?: boolean;
  className?: string;
}

/**
 * One tile of the iOS 2×2 agent stat quadrant: tiny secondary label over a
 * heavy monospaced value on a glass tile.
 */
export function AgentStatTile({
  label,
  value,
  locked,
  positive,
  negative,
  className,
}: AgentStatTileProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start justify-center gap-0.5 rounded-2xl border border-black/5 bg-white/50 px-3 py-2.5 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.07]',
        className
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {locked ? (
        <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Pro
        </span>
      ) : (
        <span
          className={cn(
            'font-mono text-[16px] font-extrabold text-foreground',
            positive && 'text-emerald-500',
            negative && 'text-red-500'
          )}
        >
          {value}
        </span>
      )}
    </div>
  );
}
