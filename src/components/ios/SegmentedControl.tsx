import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  /** Stable id so multiple controls on a page don't share thumb animations. */
  layoutId?: string;
}

/**
 * iOS-style segmented picker inside a glass capsule with a sliding thumb.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  layoutId,
}: SegmentedControlProps<T>) {
  const autoId = React.useId();
  const thumbId = layoutId ?? autoId;

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-full border border-black/5 bg-white/60 p-1 backdrop-blur-xl',
        'dark:border-white/10 dark:bg-white/[0.06]',
        className
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-[13px]',
              selected
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {selected && (
              <motion.span
                layoutId={thumbId}
                className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-white/15"
                transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
              />
            )}
            {opt.icon && <span className="relative z-10">{opt.icon}</span>}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
