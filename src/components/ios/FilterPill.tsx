import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const pillBase = cn(
  'flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-black/5 bg-white/60 px-3.5',
  'text-[13px] font-bold text-foreground backdrop-blur-xl transition-colors',
  'dark:border-white/10 dark:bg-white/[0.06]',
  'hover:bg-white/80 dark:hover:bg-white/[0.1]'
);

export interface FilterPillOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface FilterPillProps<T extends string> {
  icon?: React.ReactNode;
  /** Label when no non-default value is chosen (e.g. "Sport"). */
  label: string;
  options: FilterPillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Value considered "unset" — pill shows `label` instead of the option label. */
  defaultValue?: T;
  className?: string;
}

/**
 * iOS floating filter pill: 36px translucent capsule with icon + label + chevron,
 * opening a dropdown of options.
 */
export function FilterPill<T extends string>({
  icon,
  label,
  options,
  value,
  onChange,
  defaultValue,
  className,
}: FilterPillProps<T>) {
  const selected = options.find((o) => o.value === value);
  const isSet = defaultValue !== undefined && value !== defaultValue;
  const display = isSet && selected ? selected.label : label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(pillBase, isSet && 'border-primary/40 text-primary', className)}
        >
          {icon && <span className="text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
          <span>{display}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rounded-2xl">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className="gap-2 rounded-lg"
          >
            {opt.icon}
            <span className="flex-1">{opt.label}</span>
            {opt.value === value && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface MultiFilterPillProps<T extends string> {
  icon?: React.ReactNode;
  /** Shown when nothing is selected — an empty selection means "no filter". */
  allLabel: string;
  /** Plural noun for the count summary, e.g. "sports" → "3 sports". */
  noun: string;
  options: FilterPillOption<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  className?: string;
  /** Max options before the list scrolls (long game slates). */
  maxHeight?: number;
}

/**
 * Multi-select sibling of FilterPill. An EMPTY selection means "everything" —
 * there's no separate "all" sentinel value to keep in sync, and clearing is just
 * `[]`. The menu stays open while toggling so several can be picked in one go.
 */
export function MultiFilterPill<T extends string>({
  icon,
  allLabel,
  noun,
  options,
  values,
  onChange,
  className,
  maxHeight = 320,
}: MultiFilterPillProps<T>) {
  const isSet = values.length > 0;
  const display =
    values.length === 0
      ? allLabel
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? `1 ${noun}`)
        : `${values.length} ${noun}`;

  const toggle = (value: T) => {
    onChange(
      values.includes(value) ? values.filter((v) => v !== value) : [...values, value],
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(pillBase, isSet && 'border-primary/40 text-primary', className)}
        >
          {icon && <span className="text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
          <span className="max-w-[14rem] truncate">{display}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="overflow-y-auto rounded-2xl"
        style={{ maxHeight }}
      >
        <DropdownMenuItem
          onClick={() => onChange([])}
          className="gap-2 rounded-lg font-semibold"
        >
          <span className="flex-1">{allLabel}</span>
          {!isSet && <Check className="h-3.5 w-3.5 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            disabled={opt.disabled}
            checked={values.includes(opt.value)}
            // Radix closes the menu on select by default; keep it open so a
            // multi-pick doesn't cost one reopen per option.
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => toggle(opt.value)}
            className="gap-2 rounded-lg"
          >
            <span className="flex flex-1 items-center gap-2">
              {opt.icon}
              {opt.label}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface TogglePillProps {
  icon?: React.ReactNode;
  label: string;
  active: boolean;
  onToggle: (active: boolean) => void;
  className?: string;
}

/** Boolean variant: no chevron, fills with a tint when active. */
export function TogglePill({ icon, label, active, onToggle, className }: TogglePillProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!active)}
      aria-pressed={active}
      className={cn(
        pillBase,
        active &&
          'border-primary/50 bg-primary/15 text-primary hover:bg-primary/20 dark:bg-primary/15 dark:hover:bg-primary/20',
        className
      )}
    >
      {icon && (
        <span
          className={cn(
            '[&>svg]:h-3.5 [&>svg]:w-3.5',
            active ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {icon}
        </span>
      )}
      <span>{label}</span>
    </button>
  );
}
