import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** One trend card (300px) + the 12px gap between cards. */
const SCROLL_STEP_PX = 312;

/**
 * Horizontally scrolling card row. Touch/trackpad swipe on mobile; on md+
 * desktop, left/right chevrons scroll the rail because mouse wheels scroll
 * the page vertically and hidden scrollbars give no affordance.
 */
export function HorizontalCardRail({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + 4;
    setHasOverflow(overflow);
    setCanScrollLeft(overflow && scrollLeft > 4);
    setCanScrollRight(overflow && scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    updateScrollState();

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    el.addEventListener('scroll', updateScrollState, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', updateScrollState);
      el.removeEventListener('wheel', onWheel);
    };
  }, [updateScrollState, children]);

  const scrollByStep = (direction: -1 | 1) => {
    ref.current?.scrollBy({ left: direction * SCROLL_STEP_PX, behavior: 'smooth' });
  };

  return (
    <div className="relative w-full min-w-0 overflow-hidden">
      {hasOverflow && (
        <>
          <RailArrow
            direction="left"
            disabled={!canScrollLeft}
            onClick={() => scrollByStep(-1)}
          />
          <RailArrow
            direction="right"
            disabled={!canScrollRight}
            onClick={() => scrollByStep(1)}
          />
        </>
      )}

      <div
        ref={ref}
        className={cn(
          'flex w-full max-w-full snap-x flex-nowrap gap-3 overflow-x-auto overscroll-x-contain pb-1',
          hasOverflow && 'md:scroll-px-10 md:px-10',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

function RailArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  const side = direction === 'left' ? 'left-0' : 'right-0';

  return (
    <button
      type="button"
      aria-label={direction === 'left' ? 'Scroll cards left' : 'Scroll cards right'}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'absolute top-1/2 z-10 hidden -translate-y-1/2 md:flex',
        side,
        'h-9 w-9 items-center justify-center rounded-full',
        'border border-border/70 bg-background/95 text-foreground shadow-md backdrop-blur-sm',
        'transition-opacity hover:bg-accent disabled:pointer-events-none disabled:opacity-0',
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
