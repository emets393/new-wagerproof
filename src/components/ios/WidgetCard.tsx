import * as React from 'react';
import { cn } from '@/lib/utils';
import { GlassCard } from './GlassCard';

interface WidgetCardProps {
  icon?: React.ReactNode;
  title: string;
  /** Right-aligned header accessory (badge, toggle, "info" chip...). */
  accessory?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Detail-page widget section: glass card with the iOS uppercase section header
 * (icon + 13px semibold tracking title) above the body.
 */
export function WidgetCard({
  icon,
  title,
  accessory,
  children,
  className,
  contentClassName,
}: WidgetCardProps) {
  return (
    <GlassCard radius={20} className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
          <span className="text-[13px] font-semibold uppercase tracking-wide">{title}</span>
        </div>
        {accessory}
      </div>
      <div className={cn('px-4 pb-4 pt-2.5', contentClassName)}>{children}</div>
    </GlassCard>
  );
}
