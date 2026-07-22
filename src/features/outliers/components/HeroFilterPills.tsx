import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react';
import { cn } from '@/lib/utils';

const pillBase = cn(
  'flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-black/5 bg-white/60 px-3.5',
  'text-[13px] font-bold text-foreground backdrop-blur-xl transition-colors outline-none',
  'dark:border-white/10 dark:bg-white/[0.06] hover:bg-white/80 dark:hover:bg-white/[0.1]',
  'focus-visible:ring-2 focus-visible:ring-primary/50',
);

export interface HeroFilterPillOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

const menuClasses = {
  content: 'max-h-[320px] min-w-[180px] overflow-y-auto rounded-2xl border border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur-xl',
};

const itemClasses = {
  base: 'rounded-xl px-2.5 py-2 text-[13px] data-[hover=true]:bg-muted/70 data-[focus=true]:bg-muted/70',
};

export function HeroFilterPill<T extends string>({ icon, label, options, value, onChange, defaultValue, className }: {
  icon?: React.ReactNode;
  label: string;
  options: HeroFilterPillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  defaultValue?: T;
  className?: string;
}) {
  const selected = options.find((option) => option.value === value);
  const isSet = defaultValue !== undefined && value !== defaultValue;
  const display = isSet && selected ? selected.label : label;
  return (
    <Dropdown placement="bottom-start" classNames={menuClasses}>
      <DropdownTrigger>
        <button type="button" className={cn(pillBase, isSet && 'border-primary/40 text-primary', className)}>
          {icon && <span className="text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
          <span>{display}</span><ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownTrigger>
      <DropdownMenu aria-label={label} itemClasses={itemClasses} onAction={(key) => onChange(String(key) as T)}>
        {options.map((option) => (
          <DropdownItem key={option.value} isDisabled={option.disabled} startContent={option.icon} endContent={option.value === value ? <Check className="h-3.5 w-3.5 text-primary" /> : null}>
            {option.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}

export function HeroMultiFilterPill<T extends string>({ icon, allLabel, noun, options, values, onChange, className }: {
  icon?: React.ReactNode;
  allLabel: string;
  noun: string;
  options: HeroFilterPillOption<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  className?: string;
}) {
  const isSet = values.length > 0;
  const display = values.length === 0 ? allLabel : values.length === 1 ? options.find((option) => option.value === values[0])?.label ?? `1 ${noun}` : `${values.length} ${noun}`;
  const toggle = (value: T) => onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  return (
    <Dropdown placement="bottom-start" classNames={menuClasses}>
      <DropdownTrigger>
        <button type="button" className={cn(pillBase, isSet && 'border-primary/40 text-primary', className)}>
          {icon && <span className="text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
          <span className="max-w-[14rem] truncate">{display}</span><ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownTrigger>
      <DropdownMenu aria-label={allLabel} closeOnSelect={false} itemClasses={itemClasses} onAction={(key) => key === '__all__' ? onChange([]) : toggle(String(key) as T)}>
        <DropdownItem key="__all__" className="font-semibold" endContent={!isSet ? <Check className="h-3.5 w-3.5 text-primary" /> : null}>{allLabel}</DropdownItem>
        {options.map((option) => (
          <DropdownItem key={option.value} isDisabled={option.disabled} startContent={option.icon} endContent={values.includes(option.value) ? <Check className="h-3.5 w-3.5 text-primary" /> : null}>
            {option.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
