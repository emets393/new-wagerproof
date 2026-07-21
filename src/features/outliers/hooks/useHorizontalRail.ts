// Scroll controller for a HorizontalCardRail, hoisted out of the rail so the
// band's SectionHeader can own the ‹ › buttons instead of overlaying them on
// the cards. The rail renders the scroller + edge fades; the header renders the
// controls; this hook is the shared state between them.
import { useCallback, useEffect, useRef, useState } from 'react';

/** One rail card (300px) + the 12px gap. Kept in sync with the card widths. */
const SCROLL_STEP_PX = 312;

/** Ignore sub-pixel/elastic-bounce slop when deciding if an edge is reachable. */
const EDGE_EPSILON_PX = 4;

export interface HorizontalRail {
  ref: React.RefObject<HTMLDivElement>;
  /** Content is wider than the viewport — worth showing controls at all. */
  hasOverflow: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scrollPrev: () => void;
  scrollNext: () => void;
}

/**
 * Tracks a scroller's overflow/edge state and exposes stepped scrolling.
 * Deliberately does NOT intercept the wheel — vertical page scrolling always
 * wins over the rail, so a wheel/trackpad gesture over a rail never traps the
 * page. Horizontal movement is the buttons (desktop) or a swipe (touch).
 */
export function useHorizontalRail(deps: unknown = null): HorizontalRail {
  const ref = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + EDGE_EPSILON_PX;
    setHasOverflow(overflow);
    setCanScrollLeft(overflow && scrollLeft > EDGE_EPSILON_PX);
    setCanScrollRight(overflow && scrollLeft < scrollWidth - clientWidth - EDGE_EPSILON_PX);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(el);
    // Cards mount/unmount as filters change — watch children, not just the box.
    const mo = new MutationObserver(sync);
    mo.observe(el, { childList: true });
    el.addEventListener('scroll', sync, { passive: true });

    return () => {
      ro.disconnect();
      mo.disconnect();
      el.removeEventListener('scroll', sync);
    };
  }, [sync, deps]);

  const scrollByStep = useCallback((direction: -1 | 1) => {
    ref.current?.scrollBy({ left: direction * SCROLL_STEP_PX, behavior: 'smooth' });
  }, []);

  return {
    ref,
    hasOverflow,
    canScrollLeft,
    canScrollRight,
    scrollPrev: () => scrollByStep(-1),
    scrollNext: () => scrollByStep(1),
  };
}
