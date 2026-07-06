import { Flame, Snowflake } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Flame W-streak / snowflake L-streak capsule; hidden at streak 0. */
export function StreakBadge({ streak, className }: { streak: number; className?: string }) {
  if (!streak) return null;
  const hot = streak > 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold',
        hot ? 'bg-orange-500/15 text-orange-500' : 'bg-sky-500/15 text-sky-400',
        className
      )}
    >
      {hot ? <Flame className="h-3 w-3" /> : <Snowflake className="h-3 w-3" />}
      {hot ? `W${streak}` : `L${Math.abs(streak)}`}
    </span>
  );
}
