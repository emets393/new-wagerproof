import * as React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Corner radius in px. iOS feed cards use 26; inner tiles use 12-16. */
  radius?: number;
  /** Render as an interactive card (hover lift + pointer cursor). */
  interactive?: boolean;
}

/**
 * Translucent "Liquid Glass"-style card: backdrop blur over a thin surface,
 * hairline border, soft shadow. Web stand-in for the iOS glassEffect material.
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, radius = 26, interactive = false, style, ...props }, ref) => (
    <div
      ref={ref}
      style={{ borderRadius: radius, ...style }}
      className={cn(
        'border border-black/5 bg-white/60 shadow-[0_2px_4px_rgba(0,0,0,0.06)] backdrop-blur-xl',
        'dark:border-white/10 dark:bg-white/[0.06]',
        interactive &&
          'cursor-pointer transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]',
        className
      )}
      {...props}
    />
  )
);
GlassCard.displayName = 'GlassCard';
