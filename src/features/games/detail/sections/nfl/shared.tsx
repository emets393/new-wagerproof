import * as React from 'react';
import { Chip, Tooltip } from '@heroui/react';
import { ArrowRight, ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamRef } from '../../../types';

/**
 * Shared chrome for the NFL detail sections, following
 * src/features/games/detail/WIDGET_DESIGN.md. Deliberately a local copy of the
 * MLB patterns rather than an import from `../mlb/shared`: those helpers are
 * typed around MLB prediction rows, and cross-sport imports would couple the
 * two stacks for the sake of ~80 lines of chrome.
 */

/** The adapter hands back '/placeholder.svg' when a club has no logo mapped. */
const hasRealLogo = (url: string | null): boolean =>
  Boolean(url && url !== '/placeholder.svg' && url.trim() !== '');

/** Small circular team logo, falling back to the abbreviation on the club's primary color. */
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
  const showLogo = hasRealLogo(team.logoUrl) && !failed;

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full transition-opacity',
        dimmed && 'opacity-40',
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
  return tone === 'over'
    ? 'text-emerald-600 dark:text-emerald-300'
    : tone === 'under'
      ? 'text-blue-600 dark:text-blue-300'
      : 'text-primary';
}

/**
 * The recommendation itself, stated first and largest: which side, at what
 * number, and how far the model is from the market. Everything under it in a
 * card is supporting evidence.
 */
export function Recommendation({
  market,
  pick,
  team,
  pickIcon,
  tone = 'primary',
  edge,
}: {
  market: string;
  pick: string;
  team?: TeamRef;
  /** Direction glyph for market picks with no team (Over/Under), in the logo slot. */
  pickIcon?: React.ReactNode;
  /** Over/Under picks carry their direction color on the pick word itself. */
  tone?: PickTone;
  /** Right-aligned edge slot — callers own the sign, unit, and color. */
  edge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {team ? (
        <TeamMark team={team} size={38} />
      ) : pickIcon ? (
        <span
          className={cn(
            'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full',
            tone === 'over'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
              : tone === 'under'
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {pickIcon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {market}
        </span>
        <span
          className={cn(
            'truncate text-xl font-bold leading-tight tracking-tight',
            tone === 'primary' ? 'text-foreground' : toneClass(tone),
          )}
        >
          {pick}
        </span>
      </div>
      {edge && <span className="ml-auto flex shrink-0 items-center">{edge}</span>}
    </div>
  );
}

/** Signed model-vs-market value for the Recommendation's edge slot. */
export function EdgeValue({
  value,
  unit,
  icon,
}: {
  value: number;
  unit: string;
  icon?: React.ReactNode;
}) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        'flex items-center gap-0.5 font-mono text-sm font-bold tabular-nums',
        positive ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300',
      )}
    >
      {icon}
      {positive ? '+' : ''}
      {value.toFixed(1)}
      <span className="text-[10px] font-semibold uppercase">{unit}</span>
    </span>
  );
}

/** A model probability is only a coin flip beaten — below 50% you'd bet the other side. */
const COIN_FLIP_PCT = 50;

interface ConfidenceTier {
  label: string;
  text: string;
  bar: string;
}

/** Tiers ported from the modal: <=58 toss-up, <=65 moderate, above that strong. */
export function confidenceTier(pct: number): ConfidenceTier {
  if (pct <= 58) {
    return {
      label: 'Low confidence',
      text: 'text-red-600 dark:text-red-400',
      bar: 'bg-red-500',
    };
  }
  if (pct <= 65) {
    return {
      label: 'Moderate confidence',
      text: 'text-amber-600 dark:text-amber-400',
      bar: 'bg-amber-500',
    };
  }
  return {
    label: 'High confidence',
    text: 'text-emerald-600 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  };
}

/**
 * The verdict on the recommendation above: how often the model expects this to
 * land, as a meter against the coin-flip line. The old pair of colored tiles
 * showed the same number twice as big without ever saying what 62% was being
 * measured against.
 */
export function ConfidenceMeter({
  pct,
  outcome,
  accessory,
}: {
  pct: number;
  /** Plain-language description of what the percentage is a chance *of*. */
  outcome: string;
  accessory?: React.ReactNode;
}) {
  const tier = confidenceTier(pct);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-[10px] font-medium text-muted-foreground">
          Model gives <span className={cn('font-bold', tier.text)}>{pct}%</span> {outcome}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {accessory}
          <span className={cn('text-[10px] font-bold uppercase tracking-wider', tier.text)}>
            {tier.label}
          </span>
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full', tier.bar)}
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
        {/* Coin-flip tick — anything at or under this is the other side's bet. */}
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/70"
          style={{ left: `${COIN_FLIP_PCT}%` }}
          title="A coin flip is 50%"
        />
      </div>
    </div>
  );
}

const FADE_ALERT_TOOLTIP =
  'When a model shows extreme confidence (80%+), it may be overreacting to a single factor. Consider analyzing other factors and potentially fading (betting against) this prediction.';

/**
 * The >=80%-confidence warning. Was a moving-border glow wrapped around the
 * confidence tile — a second surface inside the card for something that is a
 * one-word caveat, so it's a chip beside the confidence label now.
 */
export function FadeAlertChip() {
  return (
    <Tooltip
      content={<span className="block max-w-[15rem] text-[11px] leading-relaxed">{FADE_ALERT_TOOLTIP}</span>}
      placement="top"
      size="sm"
      closeDelay={0}
    >
      <span className="cursor-help">
        <Chip
          size="sm"
          variant="flat"
          color="warning"
          startContent={<Zap className="h-2.5 w-2.5" />}
          classNames={{ base: 'h-4', content: 'px-1 text-[9px] font-bold uppercase tracking-wider' }}
        >
          Fade alert
        </Chip>
      </span>
    </Tooltip>
  );
}

/**
 * Model number beside the Vegas number with the gap called out between them.
 * The whole point of a pick is the disagreement, so the difference gets its own
 * slot instead of being left for the reader to subtract out of two labels.
 */
export function CompareRow({
  model,
  vegas,
  modelMark,
  gap,
  gapUnit,
  footer,
}: {
  model: string;
  vegas: string;
  modelMark?: React.ReactNode;
  /** Signed from the picked side's perspective: positive = the model likes it. */
  gap: number;
  gapUnit: string;
  footer: React.ReactNode;
}) {
  const positive = gap >= 0;

  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Our model
          </span>
          <span className="flex items-center gap-1.5">
            {modelMark}
            <span className="text-xl font-bold tabular-nums text-foreground">{model}</span>
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-center">
          <span
            className={cn(
              'font-mono text-[13px] font-bold tabular-nums',
              positive
                ? 'text-emerald-600 dark:text-emerald-300'
                : 'text-red-600 dark:text-red-300',
            )}
          >
            {positive ? '+' : ''}
            {gap.toFixed(1)}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {gapUnit}
          </span>
        </div>

        <div className="flex min-w-0 flex-col items-end gap-0.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Vegas
          </span>
          <span className="text-xl font-bold tabular-nums text-muted-foreground">{vegas}</span>
        </div>
      </div>

      {/* Spell the lean out: a signed gap alone doesn't say which way to bet. */}
      <div className="mt-2 flex items-center gap-1.5 border-t border-black/5 pt-2 text-[11px] dark:border-white/10">
        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="min-w-0 text-muted-foreground">{footer}</span>
      </div>
    </div>
  );
}

/**
 * Two competing counts as one divided bar in the sides' own colors. Replaces the
 * pairs of boxed numbers — which side is ahead reads off the bar before any
 * number does.
 */
export function ComparisonBar({
  caption,
  leftMark,
  leftLabel,
  leftValue,
  leftColor,
  rightMark,
  rightLabel,
  rightValue,
  rightColor,
}: {
  caption: string;
  leftMark: React.ReactNode;
  leftLabel: string;
  leftValue: number;
  leftColor: string;
  rightMark: React.ReactNode;
  rightLabel: string;
  rightValue: number;
  rightColor: string;
}) {
  const total = leftValue + rightValue;
  // Nothing recorded on this axis: render an empty track rather than a fake 50/50.
  const leftPct = total > 0 ? (leftValue / total) * 100 : 0;
  const rightPct = total > 0 ? (rightValue / total) * 100 : 0;
  const leftAhead = leftValue > rightValue;
  const rightAhead = rightValue > leftValue;

  return (
    <div className="flex flex-col gap-1.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {leftMark}
          <span
            className={cn(
              'text-[13px] font-bold tabular-nums',
              rightAhead ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {leftValue}
          </span>
        </span>
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {caption}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              'text-[13px] font-bold tabular-nums',
              leftAhead ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {rightValue}
          </span>
          {rightMark}
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${caption}: ${leftLabel} ${leftValue}, ${rightLabel} ${rightValue}`}
      >
        {/* The trailing side is muted so the eye lands on who's ahead. */}
        <div
          style={{ width: `${leftPct}%`, backgroundColor: leftColor }}
          className={cn('transition-opacity', rightAhead && 'opacity-35')}
        />
        <div
          style={{ width: `${rightPct}%`, backgroundColor: rightColor }}
          className={cn('transition-opacity', leftAhead && 'opacity-35')}
        />
      </div>
    </div>
  );
}

/**
 * Supporting data behind a disclosure that summarizes while closed, so it isn't
 * a blind door.
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
        <span className="text-[11px] font-semibold text-foreground">{label}</span>
        {summary && (
          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {summary}
          </span>
        )}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
