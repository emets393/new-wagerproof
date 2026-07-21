import * as React from 'react';
import { SkeletonBlock } from '@/components/ios';
import { cn } from '@/lib/utils';
import { TeamMark } from './shared';
import type { TeamRef } from '../../../types';

/**
 * Away-vs-home metric comparison for the NBA trend cards.
 *
 * Replaces the old three-column number grid: a table of `112.45 | Overall
 * Rating | 108.90` made the reader subtract before they knew who was better.
 * Each row now draws the comparison — a diverging bar from a center line for
 * head-to-head metrics, a 0-100% meter with the break-even tick for rates — so
 * the answer reads before any number does (rule 5).
 */

/** Which direction of a metric is the good one. 'neutral' colors no winner. */
export type MetricDirection = 'higher' | 'lower' | 'neutral';

export interface TrendRowDef {
  label: string;
  away: number | null;
  home: number | null;
  format: (value: number) => string;
  /** Defaults to 'higher'. */
  direction?: MetricDirection;
  /**
   * Gap between the two teams that pins the bar to full width. Set per metric
   * because a 5-point net-rating gap and a 5-game streak gap are not the same
   * size of difference.
   */
  diffCap?: number;
  /** Render as two rate meters instead of a diverging bar. Values are 0-1 fractions. */
  meter?: {
    /** Percent (0-100) where the reference tick sits, e.g. 52.4 break-even. */
    threshold: number;
    /** Plain-language caption for what the tick means. */
    hint: string;
  };
}

const BETTER_CLASS = 'text-emerald-600 dark:text-emerald-300';
const WORSE_CLASS = 'text-red-600 dark:text-red-300';

/** Who has the advantage on a row, honoring 'lower is better' metrics. */
export function rowWinner(row: TrendRowDef): 'away' | 'home' | null {
  const { away, home } = row;
  const direction = row.direction ?? 'higher';
  if (away === null || home === null || away === home || direction === 'neutral') return null;
  const awayBetter = direction === 'higher' ? away > home : away < home;
  return awayBetter ? 'away' : 'home';
}

/** "3 of 5 favor LAL" — lets a disclosure summarize itself while closed (rule 8). */
export function advantageSummary(
  rows: TrendRowDef[],
  awayAbbrev: string,
  homeAbbrev: string,
): string | null {
  const winners = rows.map(rowWinner).filter(Boolean) as ('away' | 'home')[];
  if (winners.length === 0) return null;
  const awayWins = winners.filter((w) => w === 'away').length;
  const homeWins = winners.length - awayWins;
  if (awayWins === homeWins) return `${awayWins}-${homeWins} split`;
  const leader = awayWins > homeWins ? awayAbbrev : homeAbbrev;
  return `${Math.max(awayWins, homeWins)} of ${winners.length} favor ${leader}`;
}

/** Diverging bar: grows from a center line toward whichever side is ahead. */
function AdvantageRow({
  row,
  awayTeam,
  homeTeam,
}: {
  row: TrendRowDef;
  awayTeam: TeamRef;
  homeTeam: TeamRef;
}) {
  const { away, home } = row;
  const winner = rowWinner(row);
  const bothPresent = away !== null && home !== null;

  // With no better/worse direction the bar still points at the larger value —
  // pace isn't "good" or "bad", but who's playing faster is worth seeing.
  const pointsHome = bothPresent ? (winner ? winner === 'home' : home > away) : false;
  const cap = row.diffCap ?? 1;
  const magnitude = bothPresent ? Math.min(Math.abs(away - home) / cap, 1) * 50 : 0;
  const barColor = pointsHome ? homeTeam.colors.primary : awayTeam.colors.primary;

  const awayClass =
    winner === 'away' ? BETTER_CLASS : winner === 'home' ? WORSE_CLASS : 'text-foreground';
  const homeClass =
    winner === 'home' ? BETTER_CLASS : winner === 'away' ? WORSE_CLASS : 'text-foreground';

  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn('w-16 shrink-0 text-left text-[13px] font-bold tabular-nums', awayClass)}>
          {away !== null ? row.format(away) : '—'}
        </span>
        <span className="min-w-0 flex-1 truncate text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {row.label}
        </span>
        <span className={cn('w-16 shrink-0 text-right text-[13px] font-bold tabular-nums', homeClass)}>
          {home !== null ? row.format(home) : '—'}
        </span>
      </div>
      <div
        className="relative mt-1 h-2 w-full overflow-hidden rounded-sm bg-muted/60"
        role="img"
        aria-label={
          bothPresent
            ? `${row.label}: ${awayTeam.abbrev} ${row.format(away)}, ${homeTeam.abbrev} ${row.format(home)}`
            : `${row.label}: not available`
        }
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/30" />
        {bothPresent && (
          <span
            className="absolute inset-y-0 rounded-sm"
            style={{
              backgroundColor: barColor,
              ...(pointsHome
                ? { left: '50%', width: `${magnitude}%` }
                : { right: '50%', width: `${magnitude}%` }),
            }}
          />
        )}
      </div>
    </div>
  );
}

/** One team's rate as a 0-100% meter with the reference line marked. */
function RateMeter({
  abbrev,
  value,
  threshold,
  format,
}: {
  abbrev: string;
  value: number | null;
  threshold: number;
  format: (value: number) => string;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(value * 100, 100));
  const clears = value !== null && pct >= threshold;

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <span className="w-9 shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
        {abbrev}
      </span>
      <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            clears ? 'bg-emerald-500' : 'bg-blue-500',
          )}
          style={{ width: `${pct}%` }}
        />
        <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${threshold}%` }} />
      </span>
      <span
        className={cn(
          'w-14 shrink-0 text-right text-[11px] font-bold tabular-nums',
          value === null ? 'text-muted-foreground' : clears ? BETTER_CLASS : 'text-foreground',
        )}
      >
        {value !== null ? format(value) : '—'}
      </span>
    </div>
  );
}

function MeterRow({
  row,
  awayTeam,
  homeTeam,
}: {
  row: TrendRowDef;
  awayTeam: TeamRef;
  homeTeam: TeamRef;
}) {
  const meter = row.meter!;
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {row.label}
        </span>
        <span className="shrink-0 text-[9px] text-muted-foreground/70">{meter.hint}</span>
      </div>
      <RateMeter
        abbrev={awayTeam.abbrev}
        value={row.away}
        threshold={meter.threshold}
        format={row.format}
      />
      <RateMeter
        abbrev={homeTeam.abbrev}
        value={row.home}
        threshold={meter.threshold}
        format={row.format}
      />
    </div>
  );
}

/** Logos + abbreviations so each row's two ends are unambiguous (rule 6). */
export function TrendsTeamHeader({
  awayTeam,
  homeTeam,
}: {
  awayTeam: TeamRef;
  homeTeam: TeamRef;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pb-2">
      <span className="flex items-center gap-1.5">
        <TeamMark team={awayTeam} size={28} />
        <span className="text-[13px] font-bold text-foreground">{awayTeam.abbrev}</span>
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        at
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-[13px] font-bold text-foreground">{homeTeam.abbrev}</span>
        <TeamMark team={homeTeam} size={28} />
      </span>
    </div>
  );
}

export function TrendRows({
  awayTeam,
  homeTeam,
  rows,
}: {
  awayTeam: TeamRef;
  homeTeam: TeamRef;
  rows: TrendRowDef[];
}) {
  return (
    <div className="divide-y divide-black/5 dark:divide-white/10">
      {rows.map((row) =>
        row.meter ? (
          <MeterRow key={row.label} row={row} awayTeam={awayTeam} homeTeam={homeTeam} />
        ) : (
          <AdvantageRow key={row.label} row={row} awayTeam={awayTeam} homeTeam={homeTeam} />
        ),
      )}
    </div>
  );
}

/** Shared loading / empty framing for the two trends-backed sections. */
export function TrendsSectionBody({
  loading,
  trendsAvailable,
  children,
}: {
  loading: boolean;
  trendsAvailable: boolean;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <SkeletonBlock height={34} />
        <SkeletonBlock height={34} />
        <SkeletonBlock height={34} />
      </div>
    );
  }

  if (!trendsAvailable) {
    return (
      <p className="py-3 text-center text-sm text-muted-foreground">
        Team trend data not available for this matchup
      </p>
    );
  }

  return <>{children}</>;
}
