import * as React from 'react';
import { Chip } from '@heroui/react';
import { ArrowDown, ArrowRight, ArrowUp, ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PerfectStormTier } from '@/hooks/useMLBPerfectStormRecords';
import { TIER_META, type RegressionTeam } from '../types';

/**
 * Presentation primitives for the regression report, following
 * src/features/games/detail/WIDGET_DESIGN.md: team logos with abbreviations at
 * 24-38px in real club colors, OVER green + ArrowUp / UNDER blue + ArrowDown on
 * the word itself, win rates as meters with the -110 break-even line ticked, and
 * signed values as bars diverging from a center zero rather than colored text.
 */

/** Break-even win rate at -110. Below this a "winning" record still loses money. */
export const BREAK_EVEN_PCT = 52.4;

export const OVER_TEXT = 'text-emerald-600 dark:text-emerald-300';
export const UNDER_TEXT = 'text-blue-600 dark:text-blue-300';
export const GOOD_TEXT = 'text-emerald-600 dark:text-emerald-300';
export const BAD_TEXT = 'text-red-600 dark:text-red-300';

export function signed(value: number, digits = 1): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

/** Small circular team logo, falling back to the abbreviation on the club color. */
export function TeamMark({
  team,
  size = 24,
  dimmed = false,
}: {
  team: RegressionTeam;
  size?: number;
  dimmed?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  const showLogo = Boolean(team.logoUrl) && !failed;

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full transition-opacity',
        dimmed && 'opacity-[0.35]',
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

/** Logo + abbreviation, the pairing rule 6 asks for everywhere a team appears. */
export function TeamTag({
  team,
  size = 24,
  dimmed = false,
  className,
}: {
  team: RegressionTeam;
  size?: number;
  dimmed?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <TeamMark team={team} size={size} dimmed={dimmed} />
      <span
        className={cn(
          'truncate text-[12px] font-bold',
          dimmed ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {team.abbrev}
      </span>
    </span>
  );
}

/** OVER / UNDER when it's the whole label, with its color and arrow. */
export function DirectionWord({
  direction,
  showIcon = true,
  className,
}: {
  direction: 'over' | 'under';
  showIcon?: boolean;
  className?: string;
}) {
  const Icon = direction === 'over' ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5',
        direction === 'over' ? OVER_TEXT : UNDER_TEXT,
        className,
      )}
    >
      {showIcon && <Icon className="h-4 w-4 shrink-0" />}
      {direction === 'over' ? 'OVER' : 'UNDER'}
    </span>
  );
}

export function pickDirection(pick: string): 'over' | 'under' | null {
  const match = /\b(OVER|UNDER)\b/i.exec(pick);
  if (!match) return null;
  return match[1].toUpperCase() === 'OVER' ? 'over' : 'under';
}

/**
 * Picks arrive as plain strings ("UNDER 8.5"). Split the direction word out so
 * it carries the same color + arrow totals use everywhere else — over/under is
 * the one thing you must not misread on a total. Mirrors `PickText` in
 * src/components/MLBRegressionPicksForGame.tsx.
 */
export function PickText({ pick }: { pick: string }) {
  const match = /^(OVER|UNDER)\b\s*(.*)$/i.exec(pick.trim());
  if (!match) return <>{pick}</>;
  const direction = match[1].toUpperCase() === 'OVER' ? 'over' : 'under';
  return (
    <span className="flex items-center gap-1">
      <DirectionWord direction={direction} />
      {match[2] && <span>{match[2]}</span>}
    </span>
  );
}

/** Conviction tier as a tinted pill in the tier's own accent color. */
export function TierChip({
  tier,
  size = 'sm',
}: {
  tier: PerfectStormTier;
  size?: 'sm' | 'md';
}) {
  const meta = TIER_META[tier];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full font-bold uppercase tracking-wider',
        size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]',
      )}
      style={{ backgroundColor: `${meta.accent}26`, color: meta.accent }}
    >
      <Zap className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {meta.short}
    </span>
  );
}

/**
 * A win rate against the break-even line. The single most important qualifier on
 * any record — 51% is a losing season at -110 — and the tick makes that
 * answerable without knowing the number.
 */
export function WinRateMeter({
  winPct,
  record,
  label,
  sample,
}: {
  winPct: number | null;
  record: string | null;
  /** Plain-language description of what the rate covers. */
  label: string;
  /** Optional "n games" caption shown on the right. */
  sample?: string | null;
}) {
  if (winPct === null) {
    return <p className="text-[11px] text-muted-foreground">{label} — no graded results yet.</p>;
  }
  const beatsBreakEven = winPct >= BREAK_EVEN_PCT;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-[10px] font-medium text-muted-foreground">
          <span className={cn('font-bold', beatsBreakEven ? GOOD_TEXT : BAD_TEXT)}>
            {winPct.toFixed(1)}%
          </span>{' '}
          {label}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
          {record}
          {sample ? ` · ${sample}` : ''}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            beatsBreakEven ? 'bg-emerald-500' : 'bg-red-500',
          )}
          style={{ width: `${Math.min(Math.max(winPct, 0), 100)}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/70"
          style={{ left: `${BREAK_EVEN_PCT}%` }}
          title={`Break-even at -110 is ${BREAK_EVEN_PCT}%`}
        />
      </div>
    </div>
  );
}

/**
 * One signed value as a bar diverging from a center zero line. Red left / green
 * right reads before any number does, which is the whole point of showing ROI
 * next to a record.
 */
export function DivergingBar({
  value,
  cap,
  invert = false,
  className,
}: {
  value: number | null;
  /** Magnitude that pins the bar to full width. */
  cap: number;
  /** True when a negative value is the good outcome (e.g. an improving xFIP). */
  invert?: boolean;
  className?: string;
}) {
  if (value === null) {
    return <span className={cn('h-2.5 min-w-0 flex-1 rounded-sm bg-muted/60', className)} />;
  }
  const magnitude = Math.min(Math.abs(value) / cap, 1) * 50;
  const growsRight = value >= 0;
  const isGood = invert ? value <= 0 : value >= 0;

  return (
    <span
      className={cn(
        'relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/60',
        className,
      )}
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/30" />
      <span
        className={cn('absolute inset-y-0 rounded-sm', isGood ? 'bg-emerald-500/80' : 'bg-red-500/80')}
        style={
          growsRight
            ? { left: '50%', width: `${magnitude}%` }
            : { right: '50%', width: `${magnitude}%` }
        }
      />
    </span>
  );
}

/**
 * A raw value against a threshold that matters (bullpen innings vs the workload
 * line). Same idea as WinRateMeter: the tick makes "is this a lot?" answerable
 * without knowing the number the analysts use.
 */
export function ThresholdMeter({
  value,
  threshold,
  max,
  label,
  unit = '',
}: {
  value: number | null;
  threshold: number;
  /** Full-width value. */
  max: number;
  label: string;
  unit?: string;
}) {
  const v = value ?? 0;
  const over = v >= threshold;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
        <span className={cn('shrink-0 text-[11px] font-bold tabular-nums', over ? BAD_TEXT : 'text-foreground')}>
          {value === null ? '—' : `${v.toFixed(1)}${unit}`}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full', over ? 'bg-red-500' : 'bg-emerald-500')}
          style={{ width: `${Math.min((v / max) * 100, 100)}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/70"
          style={{ left: `${Math.min((threshold / max) * 100, 100)}%` }}
          title={`Heavy usage starts at ${threshold}${unit}`}
        />
      </div>
    </div>
  );
}

/** ROI magnitude past which the exact value stops mattering. */
export const ROI_BAR_CAP = 25;

/** A record + win% + diverging ROI bar, laid out as aligned columns. */
export function RoiRow({
  label,
  leading,
  record,
  winPct,
  roiPct,
}: {
  label?: string;
  /** Replaces the text label (used for team logo + abbreviation). */
  leading?: React.ReactNode;
  record: string;
  winPct: number | null;
  roiPct: number | null;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex w-[68px] shrink-0 items-center gap-1.5 truncate text-[11px] font-semibold text-foreground">
        {leading ?? label}
      </span>
      <span className="w-14 shrink-0 text-[10px] tabular-nums text-muted-foreground">{record}</span>
      <span
        className={cn(
          'w-10 shrink-0 text-right text-[11px] font-bold tabular-nums',
          winPct === null
            ? 'text-muted-foreground'
            : winPct >= BREAK_EVEN_PCT
              ? GOOD_TEXT
              : BAD_TEXT,
        )}
      >
        {winPct === null ? '—' : `${winPct.toFixed(0)}%`}
      </span>
      <DivergingBar value={roiPct} cap={ROI_BAR_CAP} />
      <span
        className={cn(
          'w-12 shrink-0 text-right text-[11px] font-bold tabular-nums',
          roiPct === null ? 'text-muted-foreground' : roiPct >= 0 ? GOOD_TEXT : BAD_TEXT,
        )}
      >
        {roiPct === null ? '—' : `${signed(roiPct)}%`}
      </span>
    </div>
  );
}

/** Column captions for a stack of RoiRows. */
export function RoiHeader({ first = '' }: { first?: string }) {
  return (
    <div className="flex items-center gap-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
      <span className="w-[68px] shrink-0">{first}</span>
      <span className="w-14 shrink-0">Record</span>
      <span className="w-10 shrink-0 text-right">Win</span>
      <span className="min-w-0 flex-1 text-center">ROI</span>
      <span className="w-12 shrink-0" />
    </div>
  );
}

/**
 * Supporting detail behind a disclosure that summarizes while closed, so the
 * card leads with one thing and the table is one tap away rather than a blind
 * door (WIDGET_DESIGN rule 8).
 */
export function Disclosure({
  title,
  summary,
  intro,
  children,
}: {
  title: string;
  /** Shown on the right while collapsed — what's behind the door. */
  summary?: React.ReactNode;
  /** One line explaining what the expanded content is. */
  intro?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
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
        <span className="text-[11px] font-semibold text-foreground">{title}</span>
        {summary != null && (
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

/** One-line takeaway under a comparison, spelling out what the numbers imply. */
export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 border-t border-black/5 pt-2 text-[11px] dark:border-white/10">
      <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="min-w-0 text-muted-foreground">{children}</span>
    </div>
  );
}

/**
 * Two facing numbers with the gap called out between them. Used wherever the
 * disagreement is the point (results vs peripherals, model vs market) so the
 * reader never has to subtract.
 */
export function GapCompare({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  gap,
  gapCaption,
  gapIsGood,
}: {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
  gap: string;
  gapCaption: string;
  gapIsGood: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-black/[0.02] px-3 py-2 dark:bg-white/[0.03]">
      <div className="flex min-w-0 flex-col items-start gap-0.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {leftLabel}
        </span>
        <span className="text-lg font-bold tabular-nums text-foreground">{leftValue}</span>
      </div>
      <div className="flex shrink-0 flex-col items-center">
        <span
          className={cn('font-mono text-[13px] font-bold tabular-nums', gapIsGood ? GOOD_TEXT : BAD_TEXT)}
        >
          {gap}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {gapCaption}
        </span>
      </div>
      <div className="flex min-w-0 flex-col items-end gap-0.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {rightLabel}
        </span>
        <span className="text-lg font-bold tabular-nums text-muted-foreground">{rightValue}</span>
      </div>
    </div>
  );
}

/** Label / value pair for the stat grids inside disclosures. */
export function StatCell({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad' | null;
  title?: string;
}) {
  return (
    <div className="min-w-0">
      <div
        className="truncate text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70"
        title={title}
      >
        {label}
      </div>
      <div
        className={cn(
          'font-mono text-[12px] font-bold tabular-nums',
          tone === 'good' ? GOOD_TEXT : tone === 'bad' ? BAD_TEXT : 'text-foreground',
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** Verdict pill whose tone maps to good/bad/neutral rather than to a raw color. */
export function VerdictChip({
  tone,
  icon,
  children,
}: {
  tone: 'success' | 'danger' | 'warning' | 'default';
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Chip
      size="sm"
      variant="flat"
      color={tone}
      startContent={icon}
      classNames={{ base: 'shrink-0', content: 'font-semibold text-[11px]' }}
    >
      {children}
    </Chip>
  );
}

export function fmt(value: number | null | undefined, digits = 2, suffix = ''): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}${suffix}`;
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}%`;
}
