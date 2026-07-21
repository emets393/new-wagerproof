import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { History, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bottom-left summonable recents panel: a floating glass orb that pops open the last chat
 * queries for this sport. Picking one re-runs it through the NL pipeline; items can be
 * removed individually or all at once. Closes on outside click / Esc.
 */
export function RecentSearchesDock({
  recents,
  onPick,
  onRemove,
  onClear,
  disabled,
}: {
  recents: string[];
  onPick: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (recents.length === 0 && !open) return null;

  return (
    // stays put; recedes to translucent when idle and comes back on hover / keyboard focus
    <div
      ref={rootRef}
      className={cn(
        'relative transition-opacity duration-300',
        open ? 'opacity-100' : 'opacity-40 hover:opacity-100 focus-within:opacity-100',
      )}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            style={{ transformOrigin: 'bottom left' }}
            className={cn(
              'absolute bottom-12 left-0 w-72 overflow-hidden rounded-2xl border p-2 shadow-2xl backdrop-blur-2xl',
              'border-black/[0.07] bg-white/90 dark:border-white/10 dark:bg-[#161618]/95',
            )}
          >
            <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recent searches
              </span>
              {recents.length > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear all
                </button>
              )}
            </div>
            {recents.length === 0 ? (
              <p className="px-2 pb-2 text-xs text-muted-foreground">Nothing yet — ask for a situation below.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {recents.map((q) => (
                  <div
                    key={q}
                    className="group flex items-center gap-1 rounded-xl transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onPick(q);
                        setOpen(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-[13px] text-foreground/85 disabled:opacity-50"
                    >
                      <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{q}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(q)}
                      aria-label={`Remove "${q}"`}
                      className="mr-1 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Recent searches"
        whileTap={{ scale: 0.9 }}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur-xl transition-colors',
          open
            ? 'border-primary/40 bg-primary/15 text-primary'
            : 'border-black/[0.07] bg-white/80 text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-white/[0.08]',
        )}
      >
        <History className="h-[18px] w-[18px]" />
      </motion.button>
    </div>
  );
}
