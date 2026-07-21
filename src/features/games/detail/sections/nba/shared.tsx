import * as React from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronRight, Info, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamRef } from '../../../types';

/**
 * Shared chrome for the NBA detail sections, following
 * `src/features/games/detail/WIDGET_DESIGN.md`. Mirrors the MLB helpers
 * (`sections/mlb/shared.tsx`) in visual language, but keeps its own copy so the
 * two sports' widgets can move independently — MLB's module is welded to
 * MLB-only row/accuracy types.
 */

export function toNum(value: unknown): number | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Number(value);
}

/**
 * Every number a card displays goes through this first, and every derived value
 * (gaps, edges) is then computed from the *rounded* inputs — so "model 230.2,
 * Vegas 227.5, edge +2.7" always adds up on screen (rule 10).
 */
export const round1 = (value: number): number => Math.round(value * 10) / 10;

export const fmt1 = (value: number | null): string => (value === null ? '—' : value.toFixed(1));

export const fmtSigned1 = (value: number | null): string =>
  value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

/** Children are stacked with hairline rules instead of nested boxes (rule 3). */
export const CARD_STACK =
  'flex flex-col divide-y divide-black/5 dark:divide-white/10 [&>*]:py-3 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0';

/** Adapter logos can be the placeholder sentinel rather than null. */
function usableLogo(team: TeamRef): string | null {
  const url = team.logoUrl;
  if (!url || url === '/placeholder.svg' || url.trim() === '') return null;
  return url;
}

/** Team logo disc, falling back to the abbreviation on the club's own color. */
export function TeamMark({
  team,
  size = 24,
  dimmed = false,
}: {
  team: TeamRef;
  size?: number;
  dimmed?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [team.logoUrl]);

  const url = usableLogo(team);
  const showLogo = Boolean(url) && !failed;

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full transition-opacity',
        dimmed && 'opacity-35',
      )}
      style={{
        width: size,
        height: size,
        // Solid team color behind the abbreviation fallback; a neutral disc
        // behind a real logo so dark marks stay readable in dark mode.
        background: showLogo ? 'hsl(var(--background))' : team.colors.primary,
      }}
    >
      {showLogo ? (
        <img
          src={url as string}
          alt={team.abbrev}
          loading="lazy"
          className="h-full w-full object-contain p-px"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[8px] font-bold text-white">{team.abbrev.slice(0, 3)}</span>
      )}
    </span>
  );
}

export type PickTone = 'primary' | 'over' | 'under';

export function toneClass(tone: PickTone): string {
  if (tone === 'over') return 'text-emerald-600 dark:text-emerald-300';
  if (tone === 'under') return 'text-blue-600 dark:text-blue-300';
  return 'text-primary';
}

/**
 * The pick, stated first and largest (rule 2). Everything under it in the card
 * is evidence for it.
 */
export function Recommendation({
  market,
  pick,
  edge,
  team,
  tone = 'primary',
  edgeIcon,
}: {
  market: string;
  pick: string;
  edge: string;
  team?: TeamRef;
  tone?: PickTone;
  edgeIcon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {team && <TeamMark team={team} size={38} />}
      <div className="flex min-w-0 flex-col">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {market}
        </span>
        <span
          className={cn(
            'truncate text-xl font-bold leading-tight tracking-tight',
            // OVER/UNDER carry their direction color on the word itself (rule 7).
            tone === 'primary' ? 'text-foreground' : toneClass(tone),
          )}
        >
          {pick}
        </span>
      </div>
      <span
        className={cn(
          'ml-auto flex shrink-0 items-center gap-0.5 font-mono text-sm font-bold',
          toneClass(tone),
        )}
      >
        {edgeIcon}
        {edge}
      </span>
    </div>
  );
}

/**
 * Model number beside the market number with the gap between them, then the
 * lean spelled out. A signed difference on its own never said which way to bet.
 */
export function ModelVsMarket({
  model,
  market,
  gap,
  unit,
  tone,
  lean,
}: {
  model: string;
  market: string;
  /** Already derived from the two displayed values, so the three always agree. */
  gap: number;
  /** What the gap is measured in, e.g. "pts". */
  unit: string;
  tone: PickTone;
  lean: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Our model
          </span>
          <span className="text-xl font-bold tabular-nums text-foreground">{model}</span>
        </div>

        <div className="flex shrink-0 flex-col items-center">
          <span
            className={cn('flex items-center gap-0.5 font-mono text-[13px] font-bold tabular-nums', toneClass(tone))}
          >
            {tone === 'over' ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : tone === 'under' ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : null}
            {gap > 0 ? '+' : ''}
            {gap.toFixed(1)}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {unit}
          </span>
        </div>

        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Vegas
          </span>
          <span className="text-xl font-bold tabular-nums text-muted-foreground">{market}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 border-t border-black/5 pt-2 text-[11px] dark:border-white/10">
        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">{lean}</span>
      </div>
    </div>
  );
}

/**
 * Both sides of the spread with the model's side marked and the other dimmed.
 * "Who's favored" and "where the model disagrees with the market" are different
 * questions, so the pick is called out rather than left to be inferred from the
 * numbers (rule 6).
 */
export function SpreadPickRow({
  awayTeam,
  homeTeam,
  awayLine,
  homeLine,
  pickIsHome,
}: {
  awayTeam: TeamRef;
  homeTeam: TeamRef;
  awayLine: string;
  homeLine: string;
  pickIsHome: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1.5">
        <TeamMark team={awayTeam} size={28} dimmed={pickIsHome} />
        <span
          className={cn(
            'text-[13px] font-bold tabular-nums',
            pickIsHome ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {awayTeam.abbrev} {awayLine}
        </span>
        {!pickIsHome && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        {pickIsHome && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <span
          className={cn(
            'text-[13px] font-bold tabular-nums',
            pickIsHome ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {homeLine} {homeTeam.abbrev}
        </span>
        <TeamMark team={homeTeam} size={28} dimmed={!pickIsHome} />
      </span>
    </div>
  );
}

/** OVER / UNDER side by side, picked side lit and checked, other dimmed (rules 6+7). */
export function OverUnderPickRow({ isOver }: { isOver: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5">
        <ArrowUp
          className={cn('h-4 w-4 shrink-0', isOver ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground/40')}
        />
        <span
          className={cn(
            'text-[13px] font-bold tracking-wide',
            isOver ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground/40',
          )}
        >
          OVER
        </span>
        {isOver && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />}
      </span>
      <span className="flex items-center gap-1.5">
        {!isOver && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-300" />}
        <span
          className={cn(
            'text-[13px] font-bold tracking-wide',
            !isOver ? 'text-blue-600 dark:text-blue-300' : 'text-muted-foreground/40',
          )}
        >
          UNDER
        </span>
        <ArrowDown
          className={cn('h-4 w-4 shrink-0', !isOver ? 'text-blue-600 dark:text-blue-300' : 'text-muted-foreground/40')}
        />
      </span>
    </div>
  );
}

/** The model's reasoning, flattened out of its old bordered panel. */
export function Explanation({ text, isAi }: { text: React.ReactNode; isAi: boolean }) {
  return (
    <div className="flex gap-2">
      <Info className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          What this means
          {isAi && <Sparkles className="h-3 w-3 text-primary" aria-label="AI generated" />}
        </span>
        <p className="mt-0.5 text-left text-[11px] leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

/**
 * Supporting data behind a toggle that summarizes while closed, so the
 * disclosure isn't a blind door (rule 8).
 */
export function Disclosure({
  label,
  summary,
  children,
}: {
  label: string;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-90',
          )}
        />
        <span className="text-[11px] font-semibold text-foreground">{label}</span>
        {summary && (
          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {summary}
          </span>
        )}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}
