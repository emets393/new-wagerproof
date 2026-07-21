import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { fmtMlOdds } from './adapters/shared';
import { FancySlider } from './FancySlider';
import { FilterSectionsCtx, countDirtyFields } from './filterSections';

/**
 * Rail primitives for the Historical Trends filter drawer. Same behavior as the retired pages
 * (dual-thumb ranges, Any/Yes/No tri-state, American-odds min/max pairs) on upgraded controls:
 * FancySlider, sliding tri-state, and self-badging FilterGroups (see filterSections.ts).
 */

export function RangeRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <FancySlider
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={(v: number[]) => onChange([v[0], v[1]])}
        minStepsBetweenThumbs={0}
      />
    </div>
  );
}

/** Single-thumb "at least" slider (min games). */
export function ScalarRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <FancySlider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

export function SelectRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 rounded-xl border-black/[0.07] bg-white/60 transition-colors hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.09]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function MultiToggle({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={cn(
              'h-7 rounded-full border px-2.5 text-xs font-semibold transition-all duration-150 active:scale-95',
              value.includes(o)
                ? 'border-primary/50 bg-primary/15 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]'
                : 'border-black/5 bg-white/50 text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-white/[0.06]',
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TriRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const opts: [string, boolean | null][] = [
    ['Any', null],
    ['Yes', true],
    ['No', false],
  ];
  const activeIdx = opts.findIndex(([, v]) => v === value);
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="relative flex gap-0 rounded-full border border-black/5 bg-white/50 p-0.5 dark:border-white/10 dark:bg-white/[0.06]">
        {/* sliding thumb — pure CSS transform keeps it cheap across dozens of rows */}
        <div
          className="absolute inset-y-0.5 w-[calc((100%-4px)/3)] rounded-full bg-primary/15 shadow-[0_0_0_1px_hsl(var(--primary)/0.35)] transition-transform duration-200 ease-out"
          style={{ transform: `translateX(${activeIdx * 100}%)` }}
        />
        {opts.map(([l, v]) => (
          <button
            key={l}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              'relative z-10 h-6 flex-1 rounded-full text-xs font-semibold transition-colors duration-150',
              value === v ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

/** min … to … max American-odds pair (stored as strings; '' = unset). */
export function MlOddsRow({
  label,
  min,
  max,
  onMin,
  onMax,
  hint,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          value={min}
          onChange={(e) => onMin(e.target.value)}
          placeholder="min e.g. -200"
          className="h-9 rounded-xl"
        />
        <span className="shrink-0 text-xs text-muted-foreground">to</span>
        <Input
          type="number"
          inputMode="numeric"
          value={max}
          onChange={(e) => onMax(e.target.value)}
          placeholder="max e.g. -120"
          className="h-9 rounded-xl"
        />
      </div>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

/** Free-text min/max number pair (MLB streak, last-margin — signed, open-ended). */
export function NumPairRow({
  label,
  min,
  max,
  onMin,
  onMax,
  hint,
  minPlaceholder = 'min',
  maxPlaceholder = 'max',
  quickChips,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  hint?: string;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  quickChips?: { label: string; min: string; max: string }[];
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      {quickChips && quickChips.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {quickChips.map((c) => (
            <Badge
              key={c.label}
              variant="outline"
              className="cursor-pointer text-[10px] transition-transform hover:bg-accent active:scale-95"
              onClick={() => {
                onMin(c.min);
                onMax(c.max);
              }}
            >
              {c.label}
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          value={min}
          onChange={(e) => onMin(e.target.value)}
          placeholder={minPlaceholder}
          className="h-9 rounded-xl"
        />
        <span className="shrink-0 text-xs text-muted-foreground">to</span>
        <Input
          type="number"
          inputMode="numeric"
          value={max}
          onChange={(e) => onMax(e.target.value)}
          placeholder={maxPlaceholder}
          className="h-9 rounded-xl"
        />
      </div>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

/** Band / preset chips that set an optional [min?, max?] range (MLB ML/total/xFIP/etc). */
export function BandChips({
  bands,
  active,
  onPick,
  onClear,
}: {
  bands: { label: string; min?: number; max?: number }[];
  active?: (b: { min?: number; max?: number }) => boolean;
  onPick: (b: { min?: number; max?: number }) => void;
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {bands.map((b) => (
        <Badge
          key={b.label}
          variant={active?.(b) ? 'default' : 'outline'}
          className="cursor-pointer text-[10px] transition-transform hover:bg-accent active:scale-95"
          onClick={() => onPick(b)}
        >
          {b.label}
        </Badge>
      ))}
      {onClear && (
        <Badge variant="secondary" className="cursor-pointer text-[10px]" onClick={onClear}>
          Clear
        </Badge>
      )}
    </div>
  );
}

/**
 * Collapsible titled section for the filter drawer. Reads FilterSectionsCtx to badge itself with
 * an active-filter count, glow its border, and float above untouched sections (CSS `order` on the
 * flex column — no parent bookkeeping needed).
 */
export function FilterGroup({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const meta = React.useContext(FilterSectionsCtx);
  const dirty = countDirtyFields(meta, title);
  // dirty groups start expanded so a summoned drawer shows what's set without hunting
  const [open, setOpen] = React.useState(defaultOpen || dirty > 0);
  // order comes from the open-time float set, not live counts — no mid-drag teleporting
  const floats = meta?.floatTitles.has(title) ?? false;
  // "Minimize all" bumps collapseSignal — collapse on any change, but not on first mount
  const collapseSignal = meta?.collapseSignal ?? 0;
  const prevSignal = React.useRef(collapseSignal);
  React.useEffect(() => {
    if (collapseSignal !== prevSignal.current) {
      prevSignal.current = collapseSignal;
      setOpen(false);
    }
  }, [collapseSignal]);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      style={{ order: floats ? -1 : 0 }}
      className={cn(
        'rounded-2xl border bg-white/60 backdrop-blur-xl transition-shadow duration-300 dark:bg-white/[0.05]',
        dirty > 0
          ? 'border-primary/30 shadow-[0_0_0_1px_hsl(var(--primary)/0.12),0_2px_12px_-4px_hsl(var(--primary)/0.25)]'
          : 'border-black/5 shadow-[0_2px_4px_rgba(0,0,0,0.06)] dark:border-white/10',
      )}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3.5 py-3 text-sm font-semibold">
        <span className="flex items-center gap-2">
          {title}
          {dirty > 0 && (
            <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground">
              {dirty}
            </span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 px-3.5 pb-3.5 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export { fmtMlOdds };
