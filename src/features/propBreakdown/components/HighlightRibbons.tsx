import { cn } from '@/lib/utils';
import type { PropHighlight } from '../types';

export function HighlightRibbons({
  highlights,
  expanded,
  onExpand,
}: {
  highlights: PropHighlight[];
  expanded: boolean;
  onExpand: () => void;
}) {
  if (highlights.length === 0) return null;
  const visible = expanded ? highlights : highlights.slice(0, 2);
  const more = highlights.length - 2;

  return (
    <div className="space-y-2">
      {visible.map((h, i) => (
        <div
          key={`${h.kind}-${i}-${h.text.slice(0, 24)}`}
          className={cn(
            'rounded-xl border px-3 py-2 text-[13px] leading-snug backdrop-blur-xl',
            h.direction === 'up'
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
              : 'border-rose-500/35 bg-rose-500/10 text-rose-950 dark:text-rose-100'
          )}
        >
          <span
            className={cn(
              'mr-1.5 inline-block text-[9px] font-bold uppercase tracking-[0.1em]',
              h.direction === 'up'
                ? 'text-emerald-600 dark:text-emerald-300'
                : 'text-rose-600 dark:text-rose-300'
            )}
          >
            {h.direction === 'up' ? 'Edge up' : 'Edge down'}
          </span>
          {h.text}
        </div>
      ))}
      {!expanded && more > 0 && (
        <button
          type="button"
          onClick={onExpand}
          className="text-[12px] font-bold text-primary hover:underline"
        >
          +{more} more
        </button>
      )}
    </div>
  );
}
