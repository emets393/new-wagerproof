import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, ChevronDown, Loader2, Shuffle, SlidersHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SegmentedControl } from '@/components/ios';
import { cn } from '@/lib/utils';
import type { BetGroup, PresetDef, Sport } from './adapters/types';

const SPORT_OPTIONS: { value: Sport; label: string }[] = [
  { value: 'nfl', label: 'NFL' },
  { value: 'cfb', label: 'CFB' },
  { value: 'mlb', label: 'MLB' },
];

/** Gradient orbs for suggestion pills — fixed order, cycled by index. */
const ORBS = [
  'radial-gradient(circle at 35% 30%, #6ee7b7, #0d9488 70%)',
  'radial-gradient(circle at 35% 30%, #c4b5fd, #7c3aed 70%)',
  'radial-gradient(circle at 35% 30%, #fcd34d, #ea580c 70%)',
  'radial-gradient(circle at 35% 30%, #7dd3fc, #4338ca 70%)',
  'radial-gradient(circle at 35% 30%, #fda4af, #be185d 70%)',
];

interface Suggestion {
  label: string;
  kind: 'preset' | 'example';
  preset?: PresetDef;
}

/** Deterministic-per-seed pick of up to `count` suggestions. */
function pickSuggestions(pool: Suggestion[], seed: number, count: number): Suggestion[] {
  if (pool.length <= count) return pool;
  const out: Suggestion[] = [];
  const taken = new Set<number>();
  // simple LCG so a shuffle click reshuffles without pulling in a dep
  let x = (seed * 9301 + 49297) % 233280;
  while (out.length < count && taken.size < pool.length) {
    x = (x * 9301 + 49297) % 233280;
    const i = x % pool.length;
    if (!taken.has(i)) {
      taken.add(i);
      out.push(pool[i]);
    }
  }
  return out;
}

/**
 * Bottom-docked, chat-first control center (Claude-composer style): auto-growing prompt on top;
 * a control row underneath with the filter summon (+ active count), the sport switch, the
 * bet-market picker, and the send orb. Suggestion pills float above on a seamless
 * background-colored scrim + progressive blur, and step aside while typing.
 */
export function TrendsChatBar({
  examples,
  presets,
  onApplyPreset,
  processing,
  signedIn,
  onSend,
  sport,
  onSportChange,
  betGroups,
  betType,
  onBetTypeChange,
  filtersActive,
  onOpenFilters,
  leftAccessory,
}: {
  examples: string[];
  presets: PresetDef[];
  onApplyPreset: (preset: PresetDef) => void;
  processing: boolean;
  signedIn: boolean;
  onSend: (sentence: string) => void;
  sport: Sport;
  onSportChange: (s: Sport) => void;
  betGroups: BetGroup[];
  betType: string;
  onBetTypeChange: (bt: string) => void;
  filtersActive: number;
  onOpenFilters: () => void;
  /** Bottom-left dock slot — the recent-searches summon lives here. */
  leftAccessory?: React.ReactNode;
}) {
  const [input, setInput] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [seed, setSeed] = React.useState(1);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const grow = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '44px';
    el.style.height = `${Math.min(160, Math.max(44, el.scrollHeight))}px`;
  }, []);

  const trimmed = input.trim();
  const canSend = signedIn && !processing && trimmed.length > 0;

  const send = (sentence?: string) => {
    const text = (sentence ?? input).trim();
    if (!text || !signedIn || processing) return;
    onSend(text);
    setInput('');
    requestAnimationFrame(grow);
  };

  const pool = React.useMemo<Suggestion[]>(
    () => [
      ...presets.map((p) => ({ label: p.label, kind: 'preset' as const, preset: p })),
      ...examples.map((e) => ({ label: e, kind: 'example' as const })),
    ],
    [presets, examples],
  );
  const suggestions = React.useMemo(() => pickSuggestions(pool, seed, 5), [pool, seed]);
  // pills stay while merely focused — they only step aside once typing starts
  const showPills = !processing && trimmed.length === 0 && suggestions.length > 0;

  const betLabel =
    betGroups.flatMap((g) => g.items).find((i) => i.key === betType)?.label ?? 'Market';

  return (
    // absolute (not sticky) inside the workbench's full-height column: the dock is pinned to the
    // bottom of the page area and never moves — only the content region above it scrolls
    <div className="absolute inset-x-0 bottom-0 z-30">
      {/* seamless scrim — background-colored gradient + progressive blur so content melts away */}
      <div className="pointer-events-none absolute inset-x-0 -top-24 bottom-0 -z-10">
        <div
          className="absolute inset-0 backdrop-blur-md"
          style={{
            maskImage: 'linear-gradient(to top, black 55%, transparent)',
            WebkitMaskImage: 'linear-gradient(to top, black 55%, transparent)',
          }}
        />
        {/* SidebarInset paints white / dark:black — match it exactly for a seamless fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-black dark:via-black/80" />
      </div>

      <div className="relative px-4 pb-4 md:px-8">
        {leftAccessory && (
          <div className="absolute bottom-4 left-4 z-10 hidden lg:block">{leftAccessory}</div>
        )}

        <div className="mx-auto max-w-3xl">
          {/* floating suggestion pills */}
          <AnimatePresence initial={false}>
            {showPills && (
              <motion.div
                key="pills"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className="mb-3"
              >
                <div className="mb-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <span>Not sure where to start? Try one of these</span>
                  <button
                    type="button"
                    onClick={() => setSeed((s) => s + 1)}
                    className="rounded-full p-1 transition-all hover:rotate-180 hover:text-foreground"
                    style={{ transitionDuration: '400ms' }}
                    aria-label="Shuffle suggestions"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {suggestions.map((s, i) => (
                    <motion.button
                      key={`${seed}-${s.label}`}
                      type="button"
                      disabled={!signedIn && s.kind === 'example'}
                      initial={{ opacity: 0, scale: 0.9, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: i * 0.035, duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                      onClick={() => (s.kind === 'preset' && s.preset ? onApplyPreset(s.preset) : send(s.label))}
                      className={cn(
                        'flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/80 py-1.5 pl-2 pr-3.5',
                        'text-[13px] font-medium text-foreground/80 shadow-sm backdrop-blur-xl',
                        'transition-all duration-200 hover:-translate-y-0.5 hover:text-foreground hover:shadow-md',
                        'dark:border-white/10 dark:bg-white/[0.07]',
                        !signedIn && s.kind === 'example' && 'opacity-50',
                      )}
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full"
                        style={{ background: ORBS[i % ORBS.length] }}
                      />
                      {s.label}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* composer */}
          <div
            className={cn(
              'rounded-[26px] border transition-shadow duration-300',
              'border-black/[0.08] bg-white shadow-[0_12px_48px_-12px_rgba(0,0,0,0.22)]',
              'dark:border-white/[0.09] dark:bg-[#1c1c1e] dark:shadow-[0_12px_48px_-12px_rgba(0,0,0,0.7)]',
              focused && 'ring-1 ring-primary/25',
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              disabled={!signedIn || processing}
              maxLength={500}
              rows={1}
              placeholder={
                signedIn
                  ? 'Describe a situation — “home dogs on a 3-game skid”…'
                  : 'Sign in to shape trends with chat'
              }
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => {
                setInput(e.target.value);
                grow();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-4 pt-3.5 text-[15px] leading-snug text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:cursor-not-allowed"
            />
            <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
              {/* filter summon with active count */}
              <button
                type="button"
                onClick={onOpenFilters}
                aria-label="Open filters"
                className={cn(
                  'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-95',
                  filtersActive > 0
                    ? 'bg-primary/15 text-primary hover:bg-primary/25'
                    : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10',
                )}
              >
                <SlidersHorizontal className="h-[18px] w-[18px]" />
                {filtersActive > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground shadow">
                    {filtersActive}
                  </span>
                )}
              </button>

              <SegmentedControl
                options={SPORT_OPTIONS}
                value={sport}
                onChange={onSportChange}
                size="sm"
                layoutId="trends-sport-dock"
              />

              <div className="flex-1" />

              {/* bet-market picker — quiet text trigger, grouped menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                  >
                    <span className="max-w-[130px] truncate">{betLabel}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="max-h-96 w-52 overflow-y-auto rounded-2xl">
                  {betGroups.map((g, gi) => (
                    <React.Fragment key={g.group}>
                      {gi > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {g.group}
                      </DropdownMenuLabel>
                      {g.items.map((it) => (
                        <DropdownMenuItem
                          key={it.key}
                          onSelect={() => onBetTypeChange(it.key)}
                          className={cn(
                            'rounded-lg text-[13px]',
                            it.key === betType && 'bg-primary/10 font-semibold text-primary focus:bg-primary/15 focus:text-primary',
                          )}
                        >
                          {it.label}
                        </DropdownMenuItem>
                      ))}
                    </React.Fragment>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <motion.button
                type="button"
                disabled={!canSend}
                onClick={() => send()}
                aria-label="Send filter request"
                whileTap={canSend ? { scale: 0.88 } : undefined}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
                  canSend
                    ? 'bg-primary text-primary-foreground shadow-[0_2px_12px_-2px_hsl(var(--primary)/0.6)] hover:bg-primary/90'
                    : 'bg-black/[0.06] text-muted-foreground dark:bg-white/[0.08]',
                )}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
