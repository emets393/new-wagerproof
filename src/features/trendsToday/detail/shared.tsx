import * as React from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrendAngle, TrendsTeam } from '../types';

/**
 * Presentation primitives for the trend widgets, following
 * src/features/games/detail/WIDGET_DESIGN.md: logos with abbreviations at
 * 24-38px in real team colors, OVER green + ArrowUp / UNDER blue + ArrowDown on
 * the word itself, the leaning side marked with a check and the other dimmed,
 * and rates as bars diverging from a center line rather than bullet-joined text.
 */

/** A coin flip. Every rate bar diverges from here, not from zero. */
export const NEUTRAL_PCT = 50;

/** Points from 50% that pin a bar to full width. Past 25 the exact value stops mattering. */
const RATE_BAR_CAP = 25;

export const OVER_TEXT = 'text-emerald-600 dark:text-emerald-300';
export const UNDER_TEXT = 'text-blue-600 dark:text-blue-300';

export function directionText(direction: 'over' | 'under' | null): string {
  return direction === 'over' ? OVER_TEXT : direction === 'under' ? UNDER_TEXT : 'text-muted-foreground';
}

export function formatPct(pct: number | null, digits = 1): string {
  return pct === null ? '—' : `${pct.toFixed(digits)}%`;
}

/** Circular team logo, falling back to the abbreviation on the club's primary color. */
export function TeamMark({
  team,
  size = 24,
  dimmed = false,
}: {
  team: TrendsTeam;
  size?: number;
  dimmed?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  const showLogo = Boolean(team.logoUrl) && !failed;

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
  direction: 'over' | 'under' | null;
  className?: string;
  showIcon?: boolean;
}) {
  if (direction === null) {
    return (
      <span className={cn('flex items-center gap-1 text-muted-foreground', className)}>
        {showIcon && <Minus className="h-3.5 w-3.5" />}
        Split
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
 * The recommendation, stated first and largest. `market` is a caption, not a
 * heading — everything under this in a card is supporting evidence.
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
  /** Set for a side pick — renders the 38px logo beside the abbreviation. */
  pickTeam?: TrendsTeam;
  /** Set for a total pick — colors the word and picks the arrow. */
  pickDirection?: 'over' | 'under' | null;
  /** Overrides the derived label (used for "No lean"). */
  pickText?: string;
  edge: string;
  edgeCaption: string;
}) {
  const tone =
    pickDirection !== undefined ? directionText(pickDirection) : 'text-primary';
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
 * How many of the game's angles back the verdict, as filled segments. A 4-of-7
 * lean and a 7-of-7 lean are very different bets, and a bare fraction buried in
 * a sentence didn't make that land.
 */
export function AgreementMeter({
  agree,
  total,
  label,
  emptyLabel,
  tone = 'primary',
}: {
  agree: number;
  total: number;
  /** Plain-language description, e.g. "situations favor NYY". */
  label: string;
  /** Shown instead of the meter when no situation qualified. */
  emptyLabel: string;
  tone?: 'primary' | 'over' | 'under';
}) {
  if (total === 0) {
    return <p className="text-[11px] text-muted-foreground">{emptyLabel}</p>;
  }

  const fill =
    tone === 'over' ? 'bg-emerald-500' : tone === 'under' ? 'bg-blue-500' : 'bg-primary';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium text-muted-foreground">
          <span className="font-bold text-foreground">
            {agree} of {total}
          </span>{' '}
          {label}
        </span>
        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground/70">
          {Math.round((agree / total) * 100)}%
        </span>
      </div>
      <div className="flex gap-1" role="img" aria-label={`${agree} of ${total} ${label}`}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn('h-1.5 min-w-0 flex-1 rounded-full', i < agree ? fill : 'bg-muted')}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Two teams' rates as one opposed bar in their own colors, sized by share. The
 * favored side gets a check and full opacity; the other drops to 35% so the eye
 * lands on the lean rather than on whoever happens to be listed first.
 */
export function OpposedRateBar({
  away,
  home,
  awayPct,
  homePct,
  lean,
  size = 24,
}: {
  away: TrendsTeam;
  home: TrendsTeam;
  awayPct: number | null;
  homePct: number | null;
  lean: 'away' | 'home' | null;
  size?: number;
}) {
  if (awayPct === null || homePct === null) {
    return <p className="text-[11px] text-muted-foreground">No data for both teams.</p>;
  }

  const sum = awayPct + homePct;
  // Share of the combined rate, so the bar reads as "who owns this angle" even
  // when both teams are above or below 50%.
  const awayShare = sum > 0 ? (awayPct / sum) * 100 : 50;

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
            {away.abbrev} {formatPct(awayPct)}
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
            {formatPct(homePct)} {home.abbrev}
          </span>
          <TeamMark team={home} size={size} dimmed={lean === 'away'} />
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${away.abbrev} ${formatPct(awayPct)} versus ${home.abbrev} ${formatPct(homePct)}`}
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
 * One rate as a bar growing out of a 50% center line — right/green above a coin
 * flip, left/blue below. Used for over rates, where "which way and how far from
 * even" is the whole question.
 */
export function OverRateBar({ pct }: { pct: number | null }) {
  const value = pct ?? NEUTRAL_PCT;
  const delta = value - NEUTRAL_PCT;
  const magnitude = Math.min(Math.abs(delta) / RATE_BAR_CAP, 1) * 50;
  const leansOver = delta >= 0;

  return (
    <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/60">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/30" />
      {pct !== null && (
        <span
          className={cn(
            'absolute inset-y-0 rounded-sm',
            leansOver ? 'bg-emerald-500/80' : 'bg-blue-500/80',
          )}
          style={
            leansOver
              ? { left: '50%', width: `${magnitude}%` }
              : { right: '50%', width: `${magnitude}%` }
          }
        />
      )}
    </span>
  );
}

/** Column captions for a stack of over-rate rows. */
export function OverRateHeader() {
  return (
    <div className="flex items-center gap-2 pb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
      <span className="w-[52px] shrink-0">Team</span>
      <span className="w-11 shrink-0 text-right">Over</span>
      <span className="min-w-0 flex-1 text-center">vs even</span>
      <span className="w-12 shrink-0 text-right">Record</span>
    </div>
  );
}

/** One team's over rate for one angle: logo, percentage, diverging bar, record. */
export function OverRateRow({
  team,
  pct,
  record,
}: {
  team: TrendsTeam;
  pct: number | null;
  record: string | null;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex w-[52px] shrink-0 items-center gap-1.5">
        <TeamMark team={team} size={18} />
        <span className="truncate text-[11px] font-semibold text-foreground">{team.abbrev}</span>
      </span>
      <span
        className={cn(
          'w-11 shrink-0 text-right text-[11px] font-bold tabular-nums',
          pct === null
            ? 'text-muted-foreground'
            : pct >= NEUTRAL_PCT
              ? OVER_TEXT
              : UNDER_TEXT,
        )}
      >
        {formatPct(pct, 0)}
      </span>
      <OverRateBar pct={pct} />
      <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
        {record ?? '—'}
      </span>
    </div>
  );
}

/**
 * The situations both teams are in for one angle, with the trend's read beside
 * them. This is the "why" behind every percentage in the other cards.
 */
export function SituationPair({
  angle,
  away,
  home,
}: {
  angle: TrendAngle;
  away: TrendsTeam;
  home: TrendsTeam;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-[92px] shrink-0 truncate text-[11px] font-semibold text-foreground">
        {angle.label}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <TeamMark team={away} size={16} dimmed={angle.sideLean === 'home'} />
        <span className="truncate text-[11px] text-muted-foreground">{angle.away.situation}</span>
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <TeamMark team={home} size={16} dimmed={angle.sideLean === 'away'} />
        <span className="truncate text-[11px] text-muted-foreground">{angle.home.situation}</span>
      </span>
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

/** Pads a paged list to a fixed row count so the pager never shifts vertically. */
export function PageFiller({ count, height }: { count: number; height: number }) {
  if (count <= 0) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={`filler-${i}`} style={{ height }} aria-hidden />
      ))}
    </>
  );
}
