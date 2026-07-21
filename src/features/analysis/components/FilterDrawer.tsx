import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronsDownUp, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActiveChips } from './ActiveChips';
import type { ActiveChip } from './adapters/types';
import { FilterSectionsCtx, dirtyTitles, type FilterSectionsMeta } from './filterSections';

const SPRING = { type: 'spring', stiffness: 380, damping: 36 } as const;

/** xl breakpoint gate — inline panel above, modal sheet below. */
export function useIsXl(): boolean {
  const [xl, setXl] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches,
  );
  React.useEffect(() => {
    const m = window.matchMedia('(min-width: 1280px)');
    const onChange = (e: MediaQueryListEvent) => setXl(e.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);
  return xl;
}

/**
 * Mounted fresh on every summon (AnimatePresence unmounts on close), so the float order is
 * captured once per open — live edits update badges but never teleport a section mid-drag.
 */
function DrawerSections({
  meta,
  collapseSignal,
  children,
}: {
  meta: FilterSectionsMeta;
  collapseSignal: number;
  children: React.ReactNode;
}) {
  const [floatTitles] = React.useState<ReadonlySet<string>>(() => dirtyTitles(meta));
  const value = React.useMemo(
    () => ({ ...meta, floatTitles, collapseSignal }),
    [meta, floatTitles, collapseSignal],
  );
  return <FilterSectionsCtx.Provider value={value}>{children}</FilterSectionsCtx.Provider>;
}

interface PanelProps {
  meta: FilterSectionsMeta;
  chips: ActiveChip[];
  onClearChip: (patch: Record<string, unknown>) => void;
  onResetAll: () => void;
  children: React.ReactNode;
}

/** Shared panel interior: header (count, reset, close) + pinned chips + self-ordering sections. */
function PanelBody({
  meta,
  chips,
  onClearChip,
  onResetAll,
  onClose,
  titleAsDialog,
  children,
}: PanelProps & { onClose: () => void; titleAsDialog?: boolean }) {
  const TitleTag = titleAsDialog ? DialogPrimitive.Title : 'div';
  // Bumped by "Minimize all" — DrawerSections passes it to each FilterGroup, which collapses on change.
  const [collapseSignal, setCollapseSignal] = React.useState(0);
  return (
    <>
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <TitleTag className="flex items-center gap-2 text-base font-bold">
          Filters
          {chips.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground">
              {chips.length}
            </span>
          )}
        </TitleTag>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapseSignal((s) => s + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            aria-label="Minimize all filter sections"
            title="Minimize all"
          >
            <ChevronsDownUp className="h-4 w-4" />
          </button>
          {chips.length > 0 && (
            <button
              type="button"
              onClick={onResetAll}
              className="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset all
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            aria-label="Close filters"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mx-5 mb-3 max-h-32 shrink-0 overflow-y-auto rounded-2xl border border-primary/20 bg-primary/[0.06] px-3.5 py-3">
          <ActiveChips chips={chips} onClear={onClearChip} onResetAll={onResetAll} />
        </div>
      )}

      {/* flex column so FilterGroup's CSS `order` floats active sections to the top;
          scrollbar hidden (matches the app-wide treatment) — scrolling still works */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <DrawerSections meta={meta} collapseSignal={collapseSignal}>
          {children}
        </DrawerSections>
      </div>
    </>
  );
}

/**
 * xl+: the filter panel opens INLINE beside the results — content shifts over instead of being
 * covered, so filter tweaks and the live data sit side by side. Sticky within the page scroll,
 * own internal scroll for the long section list.
 */
export function InlineFilterPanel({
  open,
  onOpenChange,
  ...panel
}: PanelProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="inline-filters"
          initial={{ width: 0, opacity: 0, x: 24 }}
          animate={{ width: 372, opacity: 1, x: 0 }}
          exit={{ width: 0, opacity: 0, x: 24 }}
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          className="sticky top-2 shrink-0 self-start overflow-hidden"
        >
          <div
            className={cn(
              'flex max-h-[calc(100vh-13rem)] w-[360px] flex-col rounded-3xl border shadow-xl backdrop-blur-2xl',
              'border-black/5 bg-white/75 dark:border-white/10 dark:bg-white/[0.04]',
            )}
          >
            <PanelBody {...panel} onClose={() => onOpenChange(false)} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** Below xl: the same panel as a right-hand modal sheet (no room to split the viewport). */
export function FilterDrawer({
  open,
  onOpenChange,
  ...panel
}: PanelProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              asChild
              forceMount
              onOpenAutoFocus={(e) => e.preventDefault()}
              aria-describedby={undefined}
            >
              <motion.div
                className={cn(
                  'fixed inset-y-0 right-0 z-50 flex w-full flex-col sm:w-[430px]',
                  'border-l border-black/5 bg-white/90 backdrop-blur-2xl dark:border-white/10 dark:bg-[#101013]/95',
                  'sm:my-2 sm:mr-2 sm:h-[calc(100%-1rem)] sm:rounded-3xl sm:border sm:shadow-2xl',
                )}
                initial={{ x: '104%' }}
                animate={{ x: 0 }}
                exit={{ x: '104%' }}
                transition={SPRING}
              >
                <PanelBody {...panel} onClose={() => onOpenChange(false)} titleAsDialog />
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
