import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useHorizontalRail, type HorizontalRail } from '../hooks/useHorizontalRail';

/**
 * Horizontally scrolling card row. Cards run flush to both edges of the
 * container — no inset — because the ‹ › controls live in the band's
 * SectionHeader rather than floating over the cards.
 *
 * Scroll model: touch swipes natively; on desktop the header buttons step it.
 * The wheel is never intercepted, so vertical page scrolling always takes
 * precedence over the rail.
 */
export function HorizontalCardRail({
  children,
  className,
  rail,
}: {
  children: ReactNode;
  className?: string;
  /** Controller from `useHorizontalRail`. Omit for a rail with no header controls. */
  rail?: HorizontalRail;
}) {
  const fallback = useHorizontalRail();
  const active = rail ?? fallback;

  return (
    <div className="relative w-full min-w-0">
      {/* Edge fades — only on the side that can still scroll. Painted with the
          real page background (light: --background, dark: the layout's black
          SidebarInset) so the cards dissolve into the page instead of into a
          mismatched slate tint. Fade to a fully transparent *same-hue* stop —
          bare `transparent` fades through rgba(0,0,0,0) and reads gray. */}
      {active.canScrollLeft && (
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 z-[5] w-12',
            'bg-[linear-gradient(to_right,hsl(var(--background))_0%,hsl(var(--background)/0)_100%)]',
            'dark:bg-[linear-gradient(to_right,#000_0%,rgba(0,0,0,0)_100%)]',
          )}
        />
      )}
      {active.canScrollRight && (
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 z-[5] w-12',
            'bg-[linear-gradient(to_left,hsl(var(--background))_0%,hsl(var(--background)/0)_100%)]',
            'dark:bg-[linear-gradient(to_left,#000_0%,rgba(0,0,0,0)_100%)]',
          )}
        />
      )}

      <div
        ref={active.ref}
        className={cn(
          'flex w-full max-w-full snap-x flex-nowrap gap-3 overflow-x-auto overscroll-x-contain pb-1',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
