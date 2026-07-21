import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

/**
 * Trends-only slider: hairline track, gradient range fill, glow thumbs that scale on grab,
 * and a floating value bubble while dragging. Scoped here (not ui/slider) so the rest of
 * the app keeps the stock control.
 */
export function FancySlider({
  className,
  value,
  onValueChange,
  formatValue,
  ...props
}: React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  value: number[];
  /** Bubble text for a thumb value (defaults to the raw number). */
  formatValue?: (v: number) => string;
}) {
  const [dragging, setDragging] = React.useState(false);
  const fmt = formatValue ?? ((v: number) => String(v));

  return (
    <SliderPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      onPointerDown={() => setDragging(true)}
      onPointerUp={() => setDragging(false)}
      className={cn('relative flex w-full touch-none select-none items-center py-1.5', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-[5px] w-full grow overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/[0.1]">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-gradient-to-r from-primary/70 to-primary" />
      </SliderPrimitive.Track>
      {value.map((v, i) => (
        <SliderPrimitive.Thumb
          key={i}
          aria-label="Slider thumb"
          className={cn(
            'group relative block h-4 w-4 rounded-full border border-black/10 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.25)]',
            'transition-transform duration-150 hover:scale-110 active:scale-125',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            'dark:border-white/20 dark:bg-zinc-100',
          )}
        >
          {/* value bubble — only while grabbing so idle rows stay quiet */}
          <span
            className={cn(
              'pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5',
              'bg-foreground text-[10px] font-semibold tabular-nums text-background shadow-md',
              'transition-all duration-150',
              dragging ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
            )}
          >
            {fmt(v)}
          </span>
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  );
}
