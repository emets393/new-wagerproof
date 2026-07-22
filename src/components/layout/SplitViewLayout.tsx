import * as React from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';

const DESKTOP_BREAKPOINT = 1024;

/** True at ≥1024px — the split view collapses to a single column below this. */
export function useIsDesktopSplit() {
  const [isDesktop, setIsDesktop] = React.useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

interface SplitViewLayoutProps {
  list: React.ReactNode;
  detail: React.ReactNode;
  /** Mobile only: when true the detail replaces the list (iOS push). */
  showDetailOnMobile: boolean;
  onBackFromDetail: () => void;
  /** Title shown next to the mobile back button. */
  detailBackLabel?: string;
  /** Persists the user's panel-size drag per surface (localStorage key). */
  storageId?: string;
  /** Desktop sizing can be tuned when the master pane is itself a detail view. */
  listDefaultSize?: number;
  listMinSize?: number;
  listMaxSize?: number;
  className?: string;
}

/**
 * iOS-style master/detail shell. Desktop: resizable side-by-side panels, each
 * with its own scroll. Below 1024px: single column, detail swaps in with a
 * back bar. Parent must give this a bounded height (flex column with min-h-0).
 */
export function SplitViewLayout({
  list,
  detail,
  showDetailOnMobile,
  onBackFromDetail,
  detailBackLabel = 'Back',
  storageId = 'wagerproof-split-view',
  listDefaultSize = 32,
  listMinSize = 24,
  listMaxSize = 44,
  className,
}: SplitViewLayoutProps) {
  const isDesktop = useIsDesktopSplit();

  if (!isDesktop) {
    return (
      <div className={cn('flex h-full min-h-0 flex-col', className)}>
        {showDetailOnMobile ? (
          <>
            <div className="flex shrink-0 items-center border-b border-border/50 bg-background/80 px-2 py-1.5 backdrop-blur-md">
              <button
                type="button"
                onClick={onBackFromDetail}
                className="flex items-center gap-0.5 rounded-full px-2 py-1 text-sm font-semibold text-primary hover:bg-primary/10"
              >
                <ChevronLeft className="h-4 w-4" />
                {detailBackLabel}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{detail}</div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
        )}
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      direction="horizontal"
      autoSaveId={storageId}
      className={cn('h-full min-h-0', className)}
    >
      <ResizablePanel defaultSize={listDefaultSize} minSize={listMinSize} maxSize={listMaxSize}>
        <div className="h-full min-h-0 overflow-y-auto">{list}</div>
      </ResizablePanel>
      <ResizableHandle className="bg-border/40 hover:bg-primary/40" />
      <ResizablePanel defaultSize={100 - listDefaultSize}>
        <div className="h-full min-h-0 overflow-y-auto">{detail}</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
