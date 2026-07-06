import * as React from 'react';
import { cn } from '@/lib/utils';

interface StatCapsuleProps {
  label: string;
  value: string;
  valueClassName?: string;
  className?: string;
}

/**
 * Small line pill from the iOS game card: tiny uppercase label over a bold
 * monospaced value (e.g. SPREAD / "BAL -1.5").
 */
export function StatCapsule({ label, value, valueClassName, className }: StatCapsuleProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-full border border-black/5 bg-muted/60 px-3 py-1 dark:border-white/10',
        className
      )}
    >
      <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn('font-mono text-[11px] font-bold leading-tight', valueClassName)}>
        {value}
      </span>
    </div>
  );
}
