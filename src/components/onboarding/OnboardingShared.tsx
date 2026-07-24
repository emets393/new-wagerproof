/**
 * Shared UI primitives for the iOS-style onboarding flow: step headers,
 * option lists, pills, labeled 1–5 sliders, toggle rows, segmented pickers
 * and the rolling number used by the cost/reclaim reveals.
 */
import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useOnboarding } from '@/contexts/OnboardingContext';
import type { Scale1To5 } from '@/types/agent';

export function StepHeader({ title, subtitle }: { title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-6 text-center">
      <motion.h1
        className="text-2xl font-bold text-white sm:text-3xl"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {title}
      </motion.h1>
      {subtitle && (
        <motion.p
          className="mx-auto mt-2 max-w-md text-sm text-white/70 sm:text-base"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

interface OptionItem<T extends string> {
  value: T;
  label: string;
  detail?: string;
}

export function OptionList<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: readonly OptionItem<T>[] | OptionItem<T>[];
  value: T | undefined;
  onSelect: (value: T) => void;
}) {
  const { accent } = useOnboarding();
  return (
    <div className="flex w-full flex-col gap-3">
      {options.map((option, index) => {
        const selected = value === option.value;
        return (
          <motion.button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 * index }}
            className={cn(
              'w-full rounded-2xl border px-5 py-4 text-left transition-all duration-150',
              selected
                ? 'border-transparent bg-white/10 ring-2'
                : 'border-white/15 bg-white/5 hover:bg-white/10'
            )}
            style={selected ? ({ '--tw-ring-color': accent } as React.CSSProperties) : undefined}
          >
            <span className="block text-base font-semibold text-white">{option.label}</span>
            {option.detail && <span className="mt-0.5 block text-sm text-white/60">{option.detail}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}

export function PillGrid({
  items,
  selected,
  onToggle,
}: {
  items: readonly string[];
  selected: string[];
  onToggle: (item: string) => void;
}) {
  const { accent } = useOnboarding();
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      {items.map((item, index) => {
        const isOn = selected.includes(item);
        return (
          <motion.button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            initial={{ opacity: 0, scale: 0.6, y: -18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 22, delay: 0.045 * index }}
            whileTap={{ scale: 0.94 }}
            className={cn(
              'rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors',
              isOn ? 'border-transparent text-black' : 'border-white/20 bg-white/5 text-white hover:bg-white/10'
            )}
            style={isOn ? { background: accent } : undefined}
          >
            {item}
          </motion.button>
        );
      })}
    </div>
  );
}

export function SectionCard({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('w-full rounded-2xl border border-white/12 bg-white/[0.06] p-4 sm:p-5', className)}>
      {title && (
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">{title}</p>
      )}
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function LabeledSlider({
  label,
  description,
  value,
  onChange,
  labels,
  min = 1,
  max = 5,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (value: Scale1To5) => void;
  labels: readonly string[];
  min?: number;
  max?: number;
}) {
  const { accent } = useOnboarding();
  const idx = Math.min(Math.max(value - min, 0), labels.length - 1);
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          {description && <p className="text-xs text-white/55">{description}</p>}
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: `${accent}22`, color: accent }}>
          {labels[idx]}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as Scale1To5)}
        className="onboarding-range mt-3 w-full"
        style={{ accentColor: accent }}
        aria-label={label}
      />
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        {description && <p className="text-xs text-white/55">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function SegmentedPicker<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { accent } = useOnboarding();
  return (
    <div className="flex w-full flex-wrap gap-1.5 rounded-xl bg-white/5 p-1.5">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              selected ? 'text-black' : 'text-white/70 hover:text-white'
            )}
            style={selected ? { background: accent } : undefined}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Rolling count-up number for the cost/reclaim reveals. Respects
 * prefers-reduced-motion by snapping straight to the target.
 */
export function RollingNumber({
  value,
  prefix = '',
  suffix = '',
  duration = 1.4,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      motionValue.set(value);
      if (ref.current) ref.current.textContent = `${prefix}${value.toLocaleString('en-US')}${suffix}`;
      return;
    }
    const controls = animate(motionValue, value, { duration, ease: [0.16, 1, 0.3, 1] });
    const unsubscribe = motionValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = `${prefix}${Math.round(latest).toLocaleString('en-US')}${suffix}`;
      }
    });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, prefix, suffix, duration, motionValue]);

  return (
    <span ref={ref} className={className}>
      {prefix}0{suffix}
    </span>
  );
}
