import * as React from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MlbToolTeam } from './types';

/**
 * Presentation primitives shared by both MLB tool detail panes, following
 * src/features/games/detail/WIDGET_DESIGN.md: logos at 24-38px with the
 * abbreviation always present in real team colors, OVER green + ArrowUp /
 * UNDER blue + ArrowDown carried on the word itself, the favored side marked
 * with a check and the other dimmed to ~35%, comparisons as divided or
 * diverging bars instead of stat sentences, and supporting tables behind a
 * disclosure that summarizes while closed.
 *
 * Deliberately a sibling of trendsToday/detail/shared.tsx rather than an import
 * of it: that module's primitives are typed against TrendsTeam/TrendAngle, and
 * these tools have no angles.
 */

export const OVER_TEXT = 'text-emerald-600 dark:text-emerald-300';
export const UNDER_TEXT = 'text-blue-600 dark:text-blue-300';

export type Direction = 'over' | 'under' | null;

export function directionText(direction: Direction): string {
  return direction === 'over' ? OVER_TEXT : direction === 'under' ? UNDER_TEXT : 'text-muted-foreground';
}

export function formatSigned(value: number, digits = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

/** Circular team logo, falling back to the abbreviation on the club's primary color. */
export function TeamMark({
  team,
  size = 24,
  dimmed = false,
}: {
  team: MlbToolTeam;
  size?: number;
  dimmed?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  const showLogo = Boolean(team.logoUrl) && !failed;

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full transition-opacity',
        dimmed && 'opacity-35',
      )}
      style={{
        width: size,
        height: size,
        background: showLogo ? 'hsl(var(--background))' : team.colors.primary,
      }}
    >
      {showLogo ? (
        <img
          src={team.logoUrl as string}
          alt={team.abbrev}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain p-px"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[8px] font-bold text-white">{team.abbrev.slice(0, 3)}</span>
      )}
    </span>
  );
}

/** OVER / UNDER with its direction color and arrow carried on the word itself. */
export function DirectionWord({
  direction,
  className,
  showIcon = true,
}: {
  direction: Direction;
  className?: string;
  showIcon?: boolean;
}) {
  if (direction === null) {
    return (
      <span className={cn('flex items-center gap-1 text-muted-foreground', className)}>
        {showIcon && <Minus className="h-3.5 w-3.5 shrink-0" />}
        No lean
      </span>
    );
  }
  const Icon = direction === 'over' ? ArrowUp : ArrowDown;
  return (
    <span className={cn('flex items-center gap-1', directionText(direction), className)}>
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {direction === 'over' ? 'OVER' : 'UNDER'}
    </span>
  );
}

/**
 * The answer, stated first and largest. `market` is a 9px caption, not a
 * heading — everything below this inside a card is supporting evidence.
 */
export function Recommendation({
  market,
  pickTeam,
  pickDirection,
  pickText,
  edge,
  edgeCaption,
}: {
  market: string;
  /** Set for a side pick — renders the 38px logo beside the label. */
  pickTeam?: MlbToolTeam | null;
  /** Set for a total pick — colors the word and picks the arrow. */
  pickDirection?: Direction;
  /** Overrides the derived label (used for "No edge"). */
  pickText?: string;
  edge: string;
  edgeCaption: string;
}) {
  const tone = pickDirection !== undefined ? directionText(pickDirection) : 'text-primary';
  const label = pickText ?? pickTeam?.abbrev ?? '—';

  return (
    <div className="flex items-center gap-2.5">
      {pickTeam && <TeamMark team={pickTeam} size={38} />}
      <div className="flex min-w-0 flex-col">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {market}
        </span>
        {pickDirection !== undefined && !pickText ? (
          <DirectionWord
            direction={pickDirection}
            className="text-xl font-bold leading-tight tracking-tight"
          />
        ) : (
          <span
            className={cn(
              'truncate text-xl font-bold leading-tight tracking-tight',
              pickDirection !== undefined ? tone : 'text-foreground',
            )}
          >
            {label}
          </span>
        )}
      </div>
      <span className="ml-auto flex shrink-0 flex-col items-end">
        <span className={cn('font-mono text-sm font-bold tabular-nums', tone)}>{edge}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {edgeCaption}
        </span>
      </span>
    </div>
  );
}

/**
 * Two teams' values as one bar split by share, in their own colors. Replaces
 * "AWAY 2.31 · HOME 1.94" sentences — which side owns the metric reads before
 * any number does. `lean` marks the better side; the other drops to 35%.
 */
export function OpposedBar({
  away,
  home,
  awayValue,
  homeValue,
  format,
  lean,
  size = 24,
  emptyLabel = 'No data for both teams.',
}: {
  away: MlbToolTeam;
  home: MlbToolTeam;
  awayValue: number | null;
  homeValue: number | null;
  format: (v: number) => string;
  lean: 'away' | 'home' | null;
  size?: number;
  emptyLabel?: string;
}) {
  if (awayValue === null || homeValue === null) {
    return <p className="text-[11px] text-muted-foreground">{emptyLabel}</p>;
  }

  const sum = awayValue + homeValue;
  // Share of the combined value, so the split reads as "who owns this metric"
  // even when both sides are high or both are low.
  const awayShare = sum > 0 ? (awayValue / sum) * 100 : 50;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <TeamMark team={away} size={size} dimmed={lean === 'home'} />
          <span
            className={cn(
              'text-[13px] font-bold tabular-nums',
              lean === 'home' ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {away.abbrev} {format(awayValue)}
          </span>
          {lean === 'away' && <Check className="h-3 w-3 shrink-0 text-primary" />}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {lean === 'home' && <Check className="h-3 w-3 shrink-0 text-primary" />}
          <span
            className={cn(
              'text-[13px] font-bold tabular-nums',
              lean === 'away' ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {format(homeValue)} {home.abbrev}
          </span>
          <TeamMark team={home} size={size} dimmed={lean === 'away'} />
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${away.abbrev} ${format(awayValue)} versus ${home.abbrev} ${format(homeValue)}`}
      >
        <div
          style={{ width: `${awayShare}%`, backgroundColor: away.colors.primary }}
          className={cn('transition-opacity', lean === 'home' && 'opacity-35')}
        />
        <div
          style={{ width: `${100 - awayShare}%`, backgroundColor: home.colors.primary }}
          className={cn('transition-opacity', lean === 'away' && 'opacity-35')}
        />
      </div>
    </div>
  );
}

/**
 * One signed value as a bar growing out of a center zero line — right when
 * positive, left when negative. `goodWhenPositive=false` flips the coloring for
 * metrics where less is better (runs allowed).
 */
export function DivergingBar({
  value,
  cap,
  goodWhenPositive = true,
}: {
  value: number | null;
  /** Magnitude that pins the bar to full width; past it the exact value stops mattering. */
  cap: number;
  goodWhenPositive?: boolean;
}) {
  const magnitude = value === null ? 0 : Math.min(Math.abs(value) / cap, 1) * 50;
  const positive = (value ?? 0) >= 0;
  const isGood = goodWhenPositive ? positive : !positive;

  return (
    <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/60">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/30" />
      {value !== null && (
        <span
          className={cn(
            'absolute inset-y-0 rounded-sm',
            isGood ? 'bg-emerald-500/80' : 'bg-red-500/80',
          )}
          style={
            positive
              ? { left: '50%', width: `${magnitude}%` }
              : { right: '50%', width: `${magnitude}%` }
          }
        />
      )}
    </span>
  );
}

/**
 * A rate against a threshold, as a meter with the threshold ticked. Answers
 * "is this actually above the bar" without the reader knowing where the bar is.
 */
export function ThresholdMeter({
  pct,
  threshold,
  label,
  trailing,
  thresholdTitle,
}: {
  /** 0-100. */
  pct: number | null;
  /** 0-100 — where the tick lands. */
  threshold: number;
  label: React.ReactNode;
  trailing?: React.ReactNode;
  thresholdTitle?: string;
}) {
  if (pct === null) return null;
  const beats = pct >= threshold;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-[10px] font-medium text-muted-foreground">{label}</span>
        {trailing && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
            {trailing}
          </span>
        )}
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full', beats ? 'bg-emerald-500' : 'bg-red-500')}
          style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/70"
          style={{ left: `${Math.max(0, Math.min(threshold, 100))}%` }}
          title={thresholdTitle}
        />
      </div>
    </div>
  );
}

/** One-line takeaway under a comparison, spelling out what the numbers imply. */
export function LeanCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 border-t border-black/5 pt-2 text-[11px] dark:border-white/10">
      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="min-w-0 text-muted-foreground">{children}</span>
    </div>
  );
}

/**
 * Supporting data behind a disclosure that summarizes while closed, so it isn't
 * a blind door. `intro` leads the expanded body with what's being shown.
 */
export function Disclosure({
  title,
  summary,
  intro,
  children,
  defaultOpen = false,
}: {
  title: string;
  /** Shown on the right while collapsed, e.g. "2 of 3 above league". */
  summary?: React.ReactNode;
  intro?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="border-t border-black/5 pt-2 dark:border-white/10">
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
        <span className="min-w-0 text-[11px] font-semibold text-foreground">{title}</span>
        {summary && (
          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {summary}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2">
          {intro && (
            <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground/80">{intro}</p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

/** Sections inside a widget are separated by a rule, never by a nested box. */
export const DIVIDED = 'divide-y divide-black/5 dark:divide-white/10';

/** Empty-state line for a widget whose source had nothing to show. */
export function WidgetEmpty({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-[11px] leading-snug text-muted-foreground">{children}</p>;
}
