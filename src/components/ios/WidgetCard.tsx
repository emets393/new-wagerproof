import * as React from 'react';
import { cn } from '@/lib/utils';
import { GlassCard } from './GlassCard';

interface WidgetCardProps {
  icon?: React.ReactNode;
  title: string;
  /** Right-aligned header accessory (badge, toggle, "info" chip...). */
  accessory?: React.ReactNode;
  /** One plain-language line saying what this card is showing and why. */
  subtitle?: string;
  /**
   * The card's answer, in one sentence — rendered large and bold above the body.
   * AI-generated and quality-checked daily; see the `ai_completions` table.
   *
   * This is the literal enforcement of WIDGET_DESIGN.md's "one card = one
   * question, recommendation first": a user who reads only this line should get
   * the point of the widget. When absent the card just renders as it always did.
   */
  headline?: string;
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
  subtitle,
  headline,
  children,
  className,
  contentClassName,
}: WidgetCardProps) {
  return (
    <GlassCard
      radius={20}
      className={cn(
        'overflow-hidden border-[color:var(--widget-card-border,rgba(0,0,0,0.05))] bg-[var(--widget-card-bg,rgba(255,255,255,0.6))]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
          <span className="text-[13px] font-semibold uppercase tracking-wide">{title}</span>
        </div>
        {accessory}
      </div>
      {headline && (
        <p className="px-4 pt-2 text-[17px] font-semibold leading-[1.3] tracking-[-0.01em] text-foreground">
          {headline}
        </p>
      )}
      {subtitle && (
        <p
          className={cn(
            'px-4 text-[11px] leading-snug text-muted-foreground/80',
            // Sits under the headline as its caption when both are present.
            headline ? 'pt-1.5' : 'pt-1',
          )}
        >
          {subtitle}
        </p>
      )}
      <div className={cn('px-4 pb-4 pt-2.5', contentClassName)}>{children}</div>
    </GlassCard>
  );
}
