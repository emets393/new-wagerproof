import { cn } from '@/lib/utils';
import type { PropHighlight } from '@/features/propBreakdown/types';
import { leanStrength } from './model';

/** Direction of a one-way highlight lean. Not a betting side. */
export function LeanMark({ highlights }: { highlights: PropHighlight[] | null | undefined }) {
  const lean = leanStrength(highlights);
  if (!lean) return null;
  const up = lean.direction === 'up';
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
        up
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
      )}
    >
      {up ? 'Up' : 'Down'}
    </span>
  );
}
