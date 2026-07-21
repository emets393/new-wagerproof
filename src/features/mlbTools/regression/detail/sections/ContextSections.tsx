import * as React from 'react';
import { CloudSun, Split, Target, ThumbsDown, ThumbsUp, Wind } from 'lucide-react';
import { SegmentedControl, WidgetCard } from '@/components/ios';
import type { F5SplitRow } from '@/types/mlbF5Splits';
import type { LRSplitEntry } from '@/hooks/useMLBRegressionReport';
import type { ModelBreakdownRow } from '@/hooks/useMLBModelBreakdownAccuracy';
import { dowLabelFor } from '@/utils/mlbPickAlignment';
import { findSplitRow } from '@/utils/mlbF5Splits';
import {
  aggregateF5SplitByHand,
  formatF5Record,
  handHpLabel,
  normalizeHomeAway,
  normalizeOppSpHand,
  teamAbbrFromLrSplitName,
} from '@/utils/f5SplitLabels';
import {
  Callout,
  DivergingBar,
  RoiHeader,
  RoiRow,
  StatCell,
  TeamMark,
  TeamTag,
  VerdictChip,
  fmt,
} from '../shared';
import {
  ACCURACY_BET_TYPES,
  ACCURACY_BET_TYPE_LABEL,
  type AccuracyBetType,
  type RegressionGame,
  type RegressionTeam,
} from '../../types';
import { regressionTeamAbbr } from '../../buildFeed';

function teamFor(game: RegressionGame, name: string | null | undefined): RegressionTeam {
  const abbrev = regressionTeamAbbr(name);
  return abbrev === game.home.abbrev ? game.home : game.away;
}

/**
 * "Does either team carry something in from the last game of this series?"
 *
 * Back / fade is the whole answer, so it leads; the pattern text is the
 * evidence behind it.
 */
export function SeriesSignalsSection({ game }: { game: RegressionGame }) {
  if (game.signals.length === 0) return null;
  // Positive first: the thing to back should be read before the thing to fade.
  const ordered = [
    ...game.signals.filter((s) => s.severity === 'positive'),
    ...game.signals.filter((s) => s.severity !== 'positive'),
  ];

  return (
    <WidgetCard
      icon={<Target />}
      title="Series position"
      subtitle="Patterns from three seasons of data: how a team performs in game 2 or 3 of a series after a given game 1 result."
    >
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {ordered.map((signal, i) => {
          const team = teamFor(game, signal.team_name);
          const back = signal.severity === 'positive';
          return (
            <div key={`${signal.game_pk}-${signal.team_side}-${i}`} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2.5">
                <TeamMark team={team} size={28} />
                <span className="min-w-0 truncate text-[13px] font-bold text-foreground">
                  {team.abbrev}
                </span>
                <span className="ml-auto shrink-0">
                  {back ? (
                    <VerdictChip tone="success" icon={<ThumbsUp className="h-3 w-3" />}>
                      Back
                    </VerdictChip>
                  ) : (
                    <VerdictChip tone="danger" icon={<ThumbsDown className="h-3 w-3" />}>
                      Fade
                    </VerdictChip>
                  )}
                </span>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">{signal.message}</p>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}

/** A coin flip. The split bars diverge from here, not from zero. */
const EVEN_PCT = 50;

/**
 * "How have these lineups hit this hand of pitching through five innings?"
 *
 * The tonight-specific split (home/away × opposing hand) is the number that
 * matters, with the season-wide record against that hand as the sample check.
 */
export function HandednessSplitsSection({
  game,
  splitLookup,
}: {
  game: RegressionGame;
  splitLookup: Map<string, F5SplitRow>;
}) {
  if (game.lrSplits.length === 0) return null;
  // Notable matchups first — the report already picked out the ones worth reading.
  const ordered = [...game.lrSplits].sort(
    (a, b) => Number(b.is_notable) - Number(a.is_notable),
  );

  return (
    <WidgetCard
      icon={<Split />}
      title="Starter handedness"
      subtitle="First-five run scoring against the hand of pitching each lineup faces tonight."
    >
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {ordered.map((split, i) => (
          <SplitRow key={`${split.team_name}-${i}`} split={split} game={game} splitLookup={splitLookup} />
        ))}
      </div>
    </WidgetCard>
  );
}

function SplitRow({
  split,
  game,
  splitLookup,
}: {
  split: LRSplitEntry;
  game: RegressionGame;
  splitLookup: Map<string, F5SplitRow>;
}) {
  const team = teamFor(game, split.team_name);
  const hand = normalizeOppSpHand(split.opponent_sp_hand);
  const homeAway = normalizeHomeAway(split.home_away);
  const abbr = teamAbbrFromLrSplitName(split.team_name);

  const matchupRow = hand && homeAway ? findSplitRow(splitLookup, abbr, homeAway, hand) : null;
  const seasonTotal = hand ? aggregateF5SplitByHand(splitLookup, abbr, hand) : null;

  const winPct = matchupRow?.f5_win_pct ?? split.f5_win_pct;
  const record =
    matchupRow?.f5_record ?? formatF5Record(split.f5_wins, split.f5_losses, split.f5_ties);
  const seasonRecord = seasonTotal?.f5_record ?? null;
  const qualifier = hand
    ? `${homeAway === 'home' ? 'Home' : 'Away'} vs ${handHpLabel(hand)}`
    : 'Season';

  return (
    <div className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2.5">
        <TeamTag team={team} size={26} />
        <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {qualifier}
          {split.opponent_sp ? ` · ${split.opponent_sp}` : ''}
        </span>
        <span className="ml-auto flex shrink-0 flex-col items-end">
          <span className="font-mono text-[15px] font-bold tabular-nums text-foreground">
            {fmt(split.avg_f5_runs, 2)}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            F5 runs/gm
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-[68px] shrink-0 text-[11px] font-semibold text-foreground">
          {record}
        </span>
        <span className="w-11 shrink-0 text-right text-[11px] font-bold tabular-nums text-foreground">
          {winPct != null ? `${winPct.toFixed(0)}%` : '—'}
        </span>
        <DivergingBar value={winPct != null ? winPct - EVEN_PCT : null} cap={25} />
        <span className="w-[74px] shrink-0 truncate text-right text-[10px] tabular-nums text-muted-foreground">
          {seasonRecord ? `${seasonRecord} szn` : 'vs even'}
        </span>
      </div>
    </div>
  );
}

/**
 * "Is anything about the ballpark pushing tonight's total?"
 *
 * The flags are the report's own words; the numbers behind them sit underneath
 * so a "wind out" flag can be checked against the actual reading.
 */
export function WeatherSection({ game }: { game: RegressionGame }) {
  const flag = game.weather;
  if (!flag) return null;

  return (
    <WidgetCard
      icon={<CloudSun />}
      title="Weather & park"
      subtitle="Conditions the report flagged as pushing run scoring up or down tonight."
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Wind className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate text-[13px] font-bold text-foreground">
            {flag.venue || 'Venue unknown'}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {flag.flags.length > 0 ? (
            flag.flags.map((f, i) => (
              <VerdictChip key={`${f}-${i}`} tone="warning">
                {f}
              </VerdictChip>
            ))
          ) : (
            <span className="text-[11px] text-muted-foreground">No conditions flagged.</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatCell label="Temp" value={fmt(flag.temperature_f, 0, '°F')} />
          <StatCell
            label="Wind"
            value={
              flag.wind_speed_mph != null
                ? `${flag.wind_speed_mph.toFixed(0)} mph${flag.wind_direction ? ` ${flag.wind_direction}` : ''}`
                : '—'
            }
          />
          <StatCell
            label="Park runs"
            value={fmt(flag.park_factor_runs, 2)}
            title="Park run factor — above 1.00 favours scoring"
          />
        </div>
      </div>
    </WidgetCard>
  );
}

/**
 * "Has the model been any good on this weekday, and on these two clubs?"
 *
 * One market at a time via the segmented control, because four markets × three
 * rows on screen at once is a table nobody reads (WIDGET_DESIGN rule 1).
 */
export function ModelFormSection({
  game,
  breakdownRows,
  reportDate,
}: {
  game: RegressionGame;
  breakdownRows: ModelBreakdownRow[];
  reportDate: string;
}) {
  const [betType, setBetType] = React.useState<AccuracyBetType>('full_ml');

  const dowLabel = dowLabelFor(game.gameTimeEt ?? reportDate);
  // mlb_game_log spells Arizona AZ and the Athletics ATH; the mapping table
  // still uses ARI/OAK, so translate before looking a team row up.
  const toLogAbbr = (abbrev: string) =>
    abbrev === 'ARI' ? 'AZ' : abbrev === 'OAK' || abbrev === 'LVA' || abbrev === 'SAC' ? 'ATH' : abbrev;

  const rows = React.useMemo(() => {
    const find = (type: 'dow' | 'team', value: string | null) =>
      value
        ? breakdownRows.find(
            (r) => r.bet_type === betType && r.breakdown_type === type && r.breakdown_value === value,
          ) ?? null
        : null;
    return [
      { key: 'dow', label: dowLabel ?? 'Today', team: null, row: find('dow', dowLabel) },
      { key: 'away', label: game.away.abbrev, team: game.away, row: find('team', toLogAbbr(game.away.abbrev)) },
      { key: 'home', label: game.home.abbrev, team: game.home, row: find('team', toLogAbbr(game.home.abbrev)) },
    ];
  }, [betType, breakdownRows, dowLabel, game.away, game.home]);

  if (breakdownRows.length === 0) return null;

  return (
    <WidgetCard
      icon={<Target />}
      title="Model form here"
      subtitle="How the model has graded on this market — on today's weekday, and on each of these two clubs."
    >
      <div className="space-y-1">
        {/* Four markets is too many labels for the card's header accessory, so
            the scope switch sits at the top of the body instead. */}
        <SegmentedControl
          layoutId={`regression-model-form-${game.id}`}
          size="sm"
          className="mb-2 w-full [&>button]:flex-1"
          options={ACCURACY_BET_TYPES.map((t) => ({ value: t, label: ACCURACY_BET_TYPE_LABEL[t] }))}
          value={betType}
          onChange={(v) => setBetType(v)}
        />
        <RoiHeader />
        {rows.map((entry) => (
          <RoiRow
            key={entry.key}
            leading={
              entry.team ? (
                <>
                  <TeamMark team={entry.team} size={18} />
                  <span className="truncate">{entry.label}</span>
                </>
              ) : undefined
            }
            label={entry.team ? undefined : entry.label}
            record={
              entry.row
                ? `${entry.row.wins}-${entry.row.losses}${entry.row.pushes ? `-${entry.row.pushes}` : ''}`
                : '—'
            }
            winPct={entry.row?.win_pct ?? null}
            roiPct={entry.row?.roi_pct ?? null}
          />
        ))}
        <Callout>
          Return per unit staked, season to date. The tick on every win-rate bar is 52.4% — break-even
          at -110.
        </Callout>
      </div>
    </WidgetCard>
  );
}
