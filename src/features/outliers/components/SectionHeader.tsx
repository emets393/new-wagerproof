// Reusable Linemate-style band header: a bold title with an optional inline
// dropdown rendered as part of the sentence ("Parlay God · Showing All
// categories ▾") plus an optional right-aligned affordance (link or ‹ ›
// chevrons). See specs/outliers_spec.md §4a.
import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface SectionSelectorOption {
  value: string;
  label: string;
}

export interface SectionSelector {
  /** Connective word before the value, part of the sentence ("for" / "Showing"). */
  connective?: string;
  value: string;
  options: SectionSelectorOption[];
  onChange: (value: string) => void;
}

export type SectionAction =
  | { kind: 'link'; label: string; onClick: () => void }
  | {
      kind: 'chevrons';
      onPrev: () => void;
      onNext: () => void;
      canPrev?: boolean;
      canNext?: boolean;
      /**
       * Fade the pair in only while the band is hovered/keyboard-focused.
       * Requires a `group` class on the section wrapper. Touch has no hover, but
       * the chevrons are md+ only there and the rail swipes natively.
       */
      revealOnHover?: boolean;
    };

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Inline glyph before the title (market icon / league mark). */
  icon?: React.ReactNode;
  /** Muted suffix after the title (e.g. the date "Jul 20"). */
  suffix?: string;
  selector?: SectionSelector;
  action?: SectionAction;
}

/** Text-styled (unboxed) dropdown that reads as part of the title sentence. */
function InlineSelect({ selector }: { selector: SectionSelector }) {
  const current = selector.options.find((o) => o.value === selector.value);
  const label = current?.label ?? selector.value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-bold text-primary transition-opacity hover:opacity-80"
        >
          {label}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rounded-2xl">
        {selector.options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => selector.onChange(opt.value)}
            className="gap-2 rounded-lg"
          >
            <span className="flex-1">{opt.label}</span>
            {opt.value === selector.value && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChevronButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={direction === 'left' ? 'Previous' : 'Next'}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'hidden h-8 w-8 items-center justify-center rounded-full border border-border/70 text-foreground md:flex',
        'transition-colors hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function SectionHeader({ title, subtitle, icon, suffix, selector, action }: SectionHeaderProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <div className="flex min-w-0 items-baseline gap-1.5">
          {icon && (
            <span className="self-center text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
          )}
          <h2 className="truncate text-xl font-bold text-foreground">{title}</h2>
          {suffix && <span className="text-sm font-semibold text-muted-foreground">{suffix}</span>}
          {selector && (
            <span className="flex items-baseline gap-1.5">
              <span className="text-sm text-muted-foreground">·</span>
              {selector.connective && (
                <span className="text-sm text-muted-foreground">{selector.connective}</span>
              )}
              <InlineSelect selector={selector} />
            </span>
          )}
        </div>

        {action && (
          <div
            className={cn(
              'ml-auto flex shrink-0 items-center gap-1.5',
              action.kind === 'chevrons' &&
                action.revealOnHover &&
                'transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
            )}
          >
            {action.kind === 'link' ? (
              <button
                type="button"
                onClick={action.onClick}
                className="text-[13px] font-bold text-primary transition-opacity hover:opacity-80"
              >
                {action.label} ›
              </button>
            ) : (
              <>
                <ChevronButton
                  direction="left"
                  disabled={action.canPrev === false}
                  onClick={action.onPrev}
                />
                <ChevronButton
                  direction="right"
                  disabled={action.canNext === false}
                  onClick={action.onNext}
                />
              </>
            )}
          </div>
        )}
      </div>

      {subtitle && <p className="text-[13px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
