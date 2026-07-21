import * as React from 'react';
import { ArrowDown, ArrowUp, Lock, TrendingUp, Zap } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { cn } from '@/lib/utils';
import type { SuggestedPick } from '@/hooks/useMLBRegressionReport';
import type { MLBPerfectStormRecords } from '@/hooks/useMLBPerfectStormRecords';
import type { ModelBreakdownRow } from '@/hooks/useMLBModelBreakdownAccuracy';
import { ALIGNMENT_DISPLAY, computeAlignment } from '@/utils/mlbPickAlignment';
import {
  BET_TYPE_LABEL,
  TIER_META,
  type AccuracyBetType,
  type RegressionGame,
  type RegressionTeam,
} from '../../types';
import {
  Callout,
  Disclosure,
  PickText,
  RoiHeader,
  RoiRow,
  StatCell,
  TeamMark,
  TeamTag,
  TierChip,
  UNDER_TEXT,
  OVER_TEXT,
  VerdictChip,
  WinRateMeter,
  pickDirection,
} from '../shared';

/**
 * Which side a pick text names. Longest-needle match wins so "Red Sox" beats a
 * stray "Red" substring — same rule as MLBRegressionPicksForGame.
 */
function pickedSide(
  pick: string,
  away: RegressionTeam,
  home: RegressionTeam,
): 'away' | 'home' | null {
  const hay = pick.toLowerCase();
  const candidates = (
    [
      { side: 'home', needle: home.name.toLowerCase() },
      { side: 'home', needle: home.abbrev.toLowerCase() },
      { side: 'away', needle: away.name.toLowerCase() },
      { side: 'away', needle: away.abbrev.toLowerCase() },
    ] as { side: 'away' | 'home'; needle: string }[]
  ).filter((c) => c.needle.length > 0);
  candidates.sort((a, b) => b.needle.length - a.needle.length);
  for (const { side, needle } of candidates) {
    if (hay.includes(needle)) return side;
  }
  return null;
}

const ACCURACY_BET_TYPES = new Set<string>(['full_ml', 'full_ou', 'f5_ml', 'f5_ou']);

/**
 * One card per pick. A game can carry up to four, and each is a separate
 * recommendation with its own conviction and its own history — stacking them in
 * one card meant none of them led.
 *
 * Order inside the card is recommendation → verdict → context → evidence
 * (WIDGET_DESIGN rule 2).
 */
export function PickCard({
  pick,
  game,
  tierRecords,
  breakdownRows,
  reportDate,
}: {
  pick: SuggestedPick;
  game: RegressionGame;
  tierRecords: MLBPerfectStormRecords | null;
  breakdownRows: ModelBreakdownRow[];
  reportDate: string;
}) {
  const tier = pick.perfect_storm_tier ?? null;
  const direction = pickDirection(pick.pick);
  const side = direction ? null : pickedSide(pick.pick, game.away, game.home);
  const pickTeam = side === 'home' ? game.home : side === 'away' ? game.away : null;
  const otherTeam = side === 'home' ? game.away : side === 'away' ? game.home : null;

  const tierRecord = tier && tierRecords ? tierRecords[tier] : null;
  const tierGraded = tierRecord ? tierRecord.wins + tierRecord.losses : 0;
  const tierRecordStr = tierRecord
    ? tierRecord.pushes > 0
      ? `${tierRecord.wins}-${tierRecord.losses}-${tierRecord.pushes}`
      : `${tierRecord.wins}-${tierRecord.losses}`
    : null;

  const edgeSuffix = pick.bet_type.includes('ml') ? '%' : '';
  const edgeLabel = `${pick.edge_at_suggestion > 0 ? '+' : ''}${pick.edge_at_suggestion}${edgeSuffix}`;

  // Run-line picks have no breakdown rows keyed to them, so the model-form
  // disclosure is only offered for the four graded markets.
  const alignment = ACCURACY_BET_TYPES.has(pick.bet_type)
    ? computeAlignment({
        bet_type: pick.bet_type as AccuracyBetType,
        pick: pick.pick,
        home_team: pick.home_team ?? null,
        away_team: pick.away_team ?? null,
        // Older picks lack game_time_et; every pick is for the report's date by
        // definition, so the report date keeps the day-of-week lookup working.
        game_time_et: pick.game_time_et ?? reportDate,
        rows: breakdownRows,
      })
    : null;
  const alignmentRows = alignment ? [alignment.dow, ...alignment.teams].filter(Boolean) : [];

  const toneClass = direction === 'over' ? OVER_TEXT : direction === 'under' ? UNDER_TEXT : 'text-primary';

  return (
    <WidgetCard
      icon={<Zap />}
      title={BET_TYPE_LABEL[pick.bet_type]}
      subtitle={tier ? TIER_META[tier].blurb : 'A regression play the model flagged for today.'}
      accessory={tier ? <TierChip tier={tier} size="md" /> : undefined}
    >
      <div className="space-y-3">
        {/* The pick, stated first and largest. */}
        <div className="flex items-center gap-2.5">
          {pickTeam && <TeamMark team={pickTeam} size={38} />}
          <div className="flex min-w-0 flex-col">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
              The play
            </span>
            <span
              className={cn(
                'truncate text-xl font-bold leading-tight tracking-tight',
                direction ? toneClass : 'text-foreground',
              )}
            >
              <PickText pick={pick.pick} />
            </span>
          </div>
          <span className="ml-auto flex shrink-0 flex-col items-end">
            <span className={cn('flex items-center gap-0.5 font-mono text-sm font-bold tabular-nums', toneClass)}>
              {direction === 'over' ? (
                <ArrowUp className="h-3.5 w-3.5" />
              ) : direction === 'under' ? (
                <ArrowDown className="h-3.5 w-3.5" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5" />
              )}
              {edgeLabel}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
              edge
            </span>
          </span>
        </div>

        {/* Is a pick like this actually good? The tier's own season record. */}
        {tier && (
          <WinRateMeter
            winPct={tierRecord?.win_pct ?? null}
            record={tierRecordStr}
            sample={tierGraded > 0 ? `${tierGraded} graded` : null}
            label={`of ${TIER_META[tier].short} picks have won this season`}
          />
        )}

        {/* Which side is being backed, and which is being faded. */}
        {pickTeam && otherTeam && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-black/[0.02] px-3 py-2 dark:bg-white/[0.03]">
            <span className="flex flex-col gap-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Backing
              </span>
              <TeamTag team={pickTeam} size={26} />
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Fading
              </span>
              <TeamTag team={otherTeam} size={26} dimmed />
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <StatCell
            label="Edge tier"
            value={pick.edge_bucket === 'perfect_storm' ? 'Perfect Storm' : pick.edge_bucket}
          />
          <StatCell
            label="Tier hit rate"
            value={pick.bucket_win_pct != null ? `${pick.bucket_win_pct}%` : '—'}
            tone={pick.bucket_win_pct == null ? null : pick.bucket_win_pct >= 52.4 ? 'good' : 'bad'}
            title={`Historical win rate for picks in this edge tier (${pick.bucket_sample ?? 0} graded)`}
          />
          <StatCell
            label="Line"
            value={pick.line_at_suggestion != null ? String(pick.line_at_suggestion) : '—'}
            title="Line when the pick was first suggested"
          />
        </div>

        {pick.reasoning && (
          <p className="text-[11px] leading-snug text-muted-foreground">{pick.reasoning}</p>
        )}

        {alignment && alignmentRows.length > 0 && (
          <Disclosure
            title="Model form on this angle"
            summary={ALIGNMENT_DISPLAY[alignment.level].label}
            intro="How the model has done on this market, on today's weekday and for the teams involved. Return per unit staked; the 52.4% tick is break-even at -110."
          >
            <RoiHeader />
            {alignment.dow && (
              <RoiRow
                label={alignment.dow.breakdown_value}
                record={recordOf(alignment.dow)}
                winPct={alignment.dow.win_pct}
                roiPct={alignment.dow.roi_pct}
              />
            )}
            {alignment.teams.map((row) => (
              <RoiRow
                key={row.breakdown_value}
                label={row.breakdown_value}
                record={recordOf(row)}
                winPct={row.win_pct}
                roiPct={row.roi_pct}
              />
            ))}
          </Disclosure>
        )}

        <Callout>
          {pick.locked ? (
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" /> Locked at first pitch.
            </span>
          ) : (
            'Live — this pick can still move.'
          )}{' '}
          Suggested{' '}
          <span className="font-semibold text-foreground">
            {formatTime(pick.first_suggested_at)}
          </span>
          .
        </Callout>
      </div>
    </WidgetCard>
  );
}

function recordOf(row: ModelBreakdownRow): string {
  return `${row.wins}-${row.losses}${row.pushes ? `-${row.pushes}` : ''}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })} ET`;
}

/** Shown in place of the pick cards when the model passed on this game. */
export function NoPicksCard({ game }: { game: RegressionGame }) {
  const hasSignals = game.signalCount > 0;
  return (
    <WidgetCard
      icon={<Zap />}
      title="No play here"
      subtitle="Nothing in this game cleared the lowest conviction tier we publish."
    >
      <div className="space-y-2">
        <VerdictChip tone="default">Pass</VerdictChip>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {hasSignals
            ? 'The regression signals below still apply — they just did not line up with a priced edge the model would back.'
            : 'The report found no regression signals for either side of this matchup.'}
        </p>
      </div>
    </WidgetCard>
  );
}
