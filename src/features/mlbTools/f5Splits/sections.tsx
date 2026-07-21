import * as React from 'react';
import { Chip } from '@heroui/react';
import { Flame, Gauge, MapPin, Shield, Target, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetCard } from '@/components/ios';
import { SAMPLE_THRESHOLDS } from '@/types/mlbF5Splits';
import { formatMoneyline } from '@/utils/mlbF5Splits';
import {
  DirectionWord,
  DivergingBar,
  Disclosure,
  LeanCallout,
  OpposedBar,
  Recommendation,
  TeamMark,
  ThresholdMeter,
  WidgetEmpty,
  formatSigned,
} from '../shared/visuals';
import type { MlbToolTeam } from '../shared/types';
import { F5_EVEN_PCT, handSuffix, type F5FeedItem } from './model';

/** Runs-vs-season magnitude that pins a diverging bar to full width. */
const RUNS_DIFF_CAP = 1.5;

/** Sample size as a tone-mapped chip, used as the widget header accessory. */
function SampleChip({ games }: { games: number | null }) {
  if (games === null) return null;
  const tone =
    games >= SAMPLE_THRESHOLDS.ADEQUATE ? 'success' : games >= SAMPLE_THRESHOLDS.SMALL ? 'default' : 'warning';
  return (
    <Chip size="sm" variant="flat" color={tone} classNames={{ content: 'text-[10px] font-bold' }}>
      {games} g
    </Chip>
  );
}

/** Smallest of the two split samples — the weaker one governs how much to trust the read. */
function weakestSample(item: F5FeedItem): number | null {
  const counts = [item.awaySplit?.games, item.homeSplit?.games].filter(
    (g): g is number => typeof g === 'number',
  );
  return counts.length > 0 ? Math.min(...counts) : null;
}

/** One team's rate against a 50% line, as a labeled diverging bar. */
function RateRow({
  team,
  pct,
  record,
  cap = 25,
}: {
  team: MlbToolTeam;
  pct: number | null;
  record: string | null;
  cap?: number;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex w-[58px] shrink-0 items-center gap-1.5">
        <TeamMark team={team} size={18} />
        <span className="truncate text-[11px] font-semibold text-foreground">{team.abbrev}</span>
      </span>
      <span
        className={cn(
          'w-11 shrink-0 text-right text-[11px] font-bold tabular-nums',
          pct === null
            ? 'text-muted-foreground'
            : pct >= F5_EVEN_PCT
              ? 'text-emerald-600 dark:text-emerald-300'
              : 'text-blue-600 dark:text-blue-300',
        )}
      >
        {pct === null ? '—' : `${pct.toFixed(0)}%`}
      </span>
      <DivergingBar value={pct === null ? null : pct - F5_EVEN_PCT} cap={cap} />
      <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
        {record ?? '—'}
      </span>
    </div>
  );
}

function RateHeader({ valueLabel }: { valueLabel: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
      <span className="w-[58px] shrink-0">Team</span>
      <span className="w-11 shrink-0 text-right">{valueLabel}</span>
      <span className="min-w-0 flex-1 text-center">vs even</span>
      <span className="w-14 shrink-0 text-right">Record</span>
    </div>
  );
}

/** One team's runs figure with its season baseline and the gap as a diverging bar. */
function RunsRow({
  team,
  value,
  season,
  diff,
  goodWhenPositive,
}: {
  team: MlbToolTeam;
  value: number | null;
  season: number | null;
  diff: number | null;
  /** Scoring more is good; allowing more is not. */
  goodWhenPositive: boolean;
}) {
  const diffIsGood = diff === null ? null : goodWhenPositive ? diff >= 0 : diff <= 0;
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex w-[58px] shrink-0 items-center gap-1.5">
        <TeamMark team={team} size={18} />
        <span className="truncate text-[11px] font-semibold text-foreground">{team.abbrev}</span>
      </span>
      <span className="w-10 shrink-0 text-right text-[12px] font-bold tabular-nums text-foreground">
        {value === null ? '—' : value.toFixed(2)}
      </span>
      <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
        {season === null ? '—' : season.toFixed(2)}
      </span>
      <DivergingBar value={diff} cap={RUNS_DIFF_CAP} goodWhenPositive={goodWhenPositive} />
      <span
        className={cn(
          'w-12 shrink-0 text-right text-[11px] font-bold tabular-nums',
          diffIsGood === null
            ? 'text-muted-foreground'
            : diffIsGood
              ? 'text-emerald-600 dark:text-emerald-300'
              : 'text-red-600 dark:text-red-300',
        )}
      >
        {diff === null ? '—' : formatSigned(diff)}
      </span>
    </div>
  );
}

function RunsHeader({ splitLabel }: { splitLabel: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
      <span className="w-[58px] shrink-0">Team</span>
      <span className="w-10 shrink-0 text-right">{splitLabel}</span>
      <span className="w-10 shrink-0 text-right">Season</span>
      <span className="min-w-0 flex-1 text-center">vs season</span>
      <span className="w-12 shrink-0" />
    </div>
  );
}

/**
 * Card 1 — who wins the first five more often in tonight's exact split.
 * The whole reason the tool splits by opposing-starter hand is that this rate
 * moves; the legacy card buried it inside a five-row table.
 */
function F5SideSection({ item }: { item: F5FeedItem }) {
  const { side, away, home, game } = item;
  const leanTeam = side.lean === 'away' ? away : side.lean === 'home' ? home : null;
  const leanMl = side.lean === 'away' ? game.f5_away_ml : side.lean === 'home' ? game.f5_home_ml : null;

  return (
    <WidgetCard
      icon={<Target />}
      title="First-five side"
      subtitle="Which team wins the first five innings more often when it faces tonight's opposing starter hand, at home or on the road as scheduled."
      accessory={<SampleChip games={weakestSample(item)} />}
    >
      <div className="space-y-3">
        <Recommendation
          market="First 5 innings"
          pickTeam={leanTeam}
          pickText={leanTeam ? undefined : 'No edge'}
          edge={side.marginPts === null ? '—' : `+${side.marginPts.toFixed(1)}%`}
          edgeCaption="win-rate gap"
        />

        {side.awayWinPct === null && side.homeWinPct === null ? (
          <WidgetEmpty>
            Neither club has {SAMPLE_THRESHOLDS.HIDE}+ first-five games in this split yet.
          </WidgetEmpty>
        ) : (
          <>
            <OpposedBar
              away={away}
              home={home}
              awayValue={side.awayWinPct}
              homeValue={side.homeWinPct}
              format={(v) => `${v.toFixed(1)}%`}
              lean={side.lean}
              size={28}
              emptyLabel="Only one club has enough games in this split to compare."
            />

            <div className="flex items-center justify-between gap-2 border-t border-black/5 pt-2 text-[11px] dark:border-white/10">
              <span className="text-muted-foreground">First-five moneyline</span>
              <span className="flex items-center gap-3 font-mono text-[12px] font-bold tabular-nums">
                <span className={cn(side.lean === 'home' && 'text-muted-foreground')}>
                  {away.abbrev} {formatMoneyline(game.f5_away_ml)}
                </span>
                <span className={cn(side.lean === 'away' && 'text-muted-foreground')}>
                  {home.abbrev} {formatMoneyline(game.f5_home_ml)}
                </span>
              </span>
            </div>

            {leanTeam && (
              <LeanCallout>
                <span className="font-bold text-foreground">{leanTeam.abbrev}</span> wins the first
                five{' '}
                <span className="font-bold text-foreground">
                  {side.marginPts?.toFixed(1)} pts
                </span>{' '}
                more often in this spot
                {leanMl != null ? (
                  <>
                    {' '}
                    &rarr; currently{' '}
                    <span className="font-bold text-foreground">{formatMoneyline(leanMl)}</span>
                  </>
                ) : null}
              </LeanCallout>
            )}
          </>
        )}

        <Disclosure
          title="First-five records in this split"
          summary={
            item.awayShowable || item.homeShowable
              ? `${item.awaySplit?.f5_record ?? '—'} / ${item.homeSplit?.f5_record ?? '—'}`
              : undefined
          }
          intro="Win-loss-tie through five innings, counting only games in tonight's home/away and opposing-starter-hand split."
        >
          <RateHeader valueLabel="Win" />
          <RateRow
            team={away}
            pct={side.awayWinPct}
            record={item.awayShowable ? (item.awaySplit?.f5_record ?? null) : null}
          />
          <RateRow
            team={home}
            pct={side.homeWinPct}
            record={item.homeShowable ? (item.homeSplit?.f5_record ?? null) : null}
          />
        </Disclosure>
      </div>
    </WidgetCard>
  );
}

/**
 * Card 2 — the first-five total. Projection is the two clubs' split scoring
 * averages added together, compared to the posted line; the gap's sign IS the
 * direction, so the arrow can never disagree with the number.
 */
function F5TotalSection({ item }: { item: F5FeedItem }) {
  const { total, away, home } = item;

  return (
    <WidgetCard
      icon={<Gauge />}
      title="First-five total"
      subtitle="Both offenses' average first-five runs in this split, added together and compared to tonight's posted first-five total."
      accessory={<SampleChip games={weakestSample(item)} />}
    >
      <div className="space-y-3">
        <Recommendation
          market="First 5 total"
          pickDirection={total.direction}
          pickText={total.direction === null ? 'No lean' : undefined}
          edge={total.gap === null ? '—' : formatSigned(total.gap)}
          edgeCaption="runs"
        />

        {total.projected === null || total.line === null ? (
          <WidgetEmpty>
            {total.line === null
              ? 'No first-five total posted for this game yet.'
              : 'Not enough first-five games in this split to project a score.'}
          </WidgetEmpty>
        ) : (
          <>
            {/* Two facing figures with the gap between them — flat rows, no
                nested panel (WIDGET_DESIGN rule 3). */}
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col items-start gap-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  Split projection
                </span>
                <span className="text-xl font-bold tabular-nums text-foreground">
                  {total.projected.toFixed(2)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-center">
                <DirectionWord
                  direction={total.direction}
                  className="font-mono text-[13px] font-bold tabular-nums"
                />
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {total.gap === null ? '' : `${formatSigned(total.gap)} runs`}
                </span>
              </span>
              <span className="flex min-w-0 flex-col items-end gap-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  Posted line
                </span>
                <span className="text-xl font-bold tabular-nums text-muted-foreground">
                  {total.line.toFixed(1)}
                </span>
              </span>
            </div>

            <LeanCallout>
              These two offenses average{' '}
              <span className="font-bold text-foreground">
                {Math.abs(total.gap ?? 0).toFixed(2)} runs{' '}
                {(total.gap ?? 0) >= 0 ? 'more' : 'fewer'}
              </span>{' '}
              in this split than the posted first-five total
            </LeanCallout>
          </>
        )}

        {total.avgOverPct !== null && (
          <div className="border-t border-black/5 pt-2 dark:border-white/10">
            <ThresholdMeter
              pct={total.avgOverPct}
              threshold={F5_EVEN_PCT}
              thresholdTitle="A coin flip is 50%"
              label={
                <>
                  These clubs go over the first-five total{' '}
                  <span
                    className={cn(
                      'font-bold',
                      total.avgOverPct >= F5_EVEN_PCT
                        ? 'text-emerald-600 dark:text-emerald-300'
                        : 'text-blue-600 dark:text-blue-300',
                    )}
                  >
                    {total.avgOverPct.toFixed(0)}%
                  </span>{' '}
                  of the time in this split
                </>
              }
              trailing="50% = even"
            />
          </div>
        )}

        <Disclosure
          title="Over rate by team"
          summary={
            total.awayOverPct !== null || total.homeOverPct !== null
              ? `${away.abbrev} ${total.awayOverPct?.toFixed(0) ?? '—'}% · ${home.abbrev} ${total.homeOverPct?.toFixed(0) ?? '—'}%`
              : undefined
          }
          intro="How often each club's own first-five total has gone over in this split. Bars diverge from a 50% coin flip."
        >
          <RateHeader valueLabel="Over" />
          <RateRow
            team={away}
            pct={total.awayOverPct}
            record={item.awayShowable ? (item.awaySplit?.f5_ou_record ?? null) : null}
          />
          <RateRow
            team={home}
            pct={total.homeOverPct}
            record={item.homeShowable ? (item.homeSplit?.f5_ou_record ?? null) : null}
          />
        </Disclosure>
      </div>
    </WidgetCard>
  );
}

/** Card 3 — the facts every other card is conditioned on. */
function F5MatchupSection({ item }: { item: F5FeedItem }) {
  const { game, away, home } = item;

  const rows: { team: MlbToolTeam; starter: string; hand: string; opposing: string; place: string }[] = [
    {
      team: away,
      starter: game.away_sp_name ?? 'TBD',
      hand: handSuffix(game.away_sp_hand),
      opposing: `${game.home_sp_name ?? 'TBD'}${handSuffix(game.home_sp_hand) ? ` (${handSuffix(game.home_sp_hand)})` : ''}`,
      place: 'On the road',
    },
    {
      team: home,
      starter: game.home_sp_name ?? 'TBD',
      hand: handSuffix(game.home_sp_hand),
      opposing: `${game.away_sp_name ?? 'TBD'}${handSuffix(game.away_sp_hand) ? ` (${handSuffix(game.away_sp_hand)})` : ''}`,
      place: 'At home',
    },
  ];

  return (
    <WidgetCard
      icon={<User />}
      title="Tonight's starters"
      subtitle="Every split on this page is conditioned on these two arms — offense on the opposing starter's hand, defense on the club's own."
    >
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {rows.map((row) => (
          <div key={row.team.abbrev} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
            <TeamMark team={row.team} size={30} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-bold text-foreground">
                {row.starter}
                {row.hand && (
                  <span className="ml-1 font-mono text-[10px] font-bold text-muted-foreground">
                    {row.hand}
                  </span>
                )}
              </span>
              <span className="truncate text-[10px] text-muted-foreground">
                {row.place} · faces {row.opposing}
              </span>
            </div>
          </div>
        ))}
      </div>

      {(game.venue_name || game.total_line !== null || game.f5_total_line !== null) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-black/5 pt-2 text-[11px] text-muted-foreground dark:border-white/10">
          {game.venue_name && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{game.venue_name}</span>
            </span>
          )}
          {game.f5_total_line !== null && (
            <span className="tabular-nums">
              F5 total <span className="font-bold text-foreground">{game.f5_total_line}</span>
            </span>
          )}
          {game.total_line !== null && (
            <span className="tabular-nums">
              Game total <span className="font-bold text-foreground">{game.total_line}</span>
            </span>
          )}
        </div>
      )}
    </WidgetCard>
  );
}

/** Card 4 — offense: is this split lifting or suppressing each club's scoring? */
function F5OffenseSection({ item }: { item: F5FeedItem }) {
  const { away, home, awaySplit, homeSplit, awayShowable, homeShowable } = item;

  const awayRs = awayShowable ? (awaySplit?.avg_f5_rs ?? null) : null;
  const homeRs = homeShowable ? (homeSplit?.avg_f5_rs ?? null) : null;
  const awayDiff = awayShowable ? (awaySplit?.rs_diff_vs_season ?? null) : null;
  const homeDiff = homeShowable ? (homeSplit?.rs_diff_vs_season ?? null) : null;

  const better =
    awayRs !== null && homeRs !== null && awayRs !== homeRs ? (awayRs > homeRs ? 'away' : 'home') : null;

  return (
    <WidgetCard
      icon={<Flame />}
      title="First-five offense"
      subtitle="Runs each club scores through five innings in this split, against its own all-games season baseline."
      accessory={<SampleChip games={weakestSample(item)} />}
    >
      <div className="space-y-3">
        {awayRs === null && homeRs === null ? (
          <WidgetEmpty>
            Neither club has {SAMPLE_THRESHOLDS.HIDE}+ first-five games in this split yet.
          </WidgetEmpty>
        ) : (
          <>
            <OpposedBar
              away={away}
              home={home}
              awayValue={awayRs}
              homeValue={homeRs}
              format={(v) => v.toFixed(2)}
              lean={better}
              size={28}
              emptyLabel="Only one club has enough games in this split to compare."
            />

            <div className="border-t border-black/5 pt-2 dark:border-white/10">
              <RunsHeader splitLabel="Split" />
              <RunsRow
                team={away}
                value={awayRs}
                season={awayShowable ? (awaySplit?.season_avg_f5_rs ?? null) : null}
                diff={awayDiff}
                goodWhenPositive
              />
              <RunsRow
                team={home}
                value={homeRs}
                season={homeShowable ? (homeSplit?.season_avg_f5_rs ?? null) : null}
                diff={homeDiff}
                goodWhenPositive
              />
            </div>

            <LeanCallout>
              Green means this split has been{' '}
              <span className="font-bold text-foreground">better than the club’s season norm</span>{' '}
              — a red bar says tonight’s matchup type usually costs it runs
            </LeanCallout>
          </>
        )}

        {item.smallSample && (
          <p className="border-t border-black/5 pt-2 text-[10px] leading-snug text-amber-600 dark:border-white/10 dark:text-amber-400">
            One of these splits has fewer than {SAMPLE_THRESHOLDS.SMALL} games. Early in the season
            the vs-LHP bucket fills slowly because most starters are right-handed — the numbers are
            real, the sample is thin.
          </p>
        )}
      </div>
    </WidgetCard>
  );
}

/** Card 5 — defense: runs allowed behind tonight's own starter hand. */
function F5DefenseSection({ item }: { item: F5FeedItem }) {
  const { away, home, awayDefense, homeDefense, awaySplit, homeSplit, game } = item;

  const better =
    awayDefense && homeDefense && awayDefense.avgRa !== homeDefense.avgRa
      ? awayDefense.avgRa < homeDefense.avgRa
        ? 'away'
        : 'home'
      : null;

  const handNote = (hand: typeof game.away_sp_hand) =>
    hand === 'R' ? 'behind a righty' : hand === 'L' ? 'behind a lefty' : 'starter hand unknown';

  return (
    <WidgetCard
      icon={<Shield />}
      title="First-five defense"
      subtitle="Runs each club allows through five innings when its own starter throws with tonight's hand. Fewer is better, so green means fewer."
      accessory={
        <SampleChip
          games={
            awayDefense && homeDefense
              ? Math.min(awayDefense.games, homeDefense.games)
              : (awayDefense?.games ?? homeDefense?.games ?? null)
          }
        />
      }
    >
      <div className="space-y-3">
        {!awayDefense && !homeDefense ? (
          <WidgetEmpty>
            Neither club has {SAMPLE_THRESHOLDS.HIDE}+ first-five games with a starter of tonight’s
            hand.
          </WidgetEmpty>
        ) : (
          <>
            <OpposedBar
              away={away}
              home={home}
              awayValue={awayDefense?.avgRa ?? null}
              homeValue={homeDefense?.avgRa ?? null}
              format={(v) => v.toFixed(2)}
              lean={better}
              size={28}
              emptyLabel="Only one club has enough games with this starter hand to compare."
            />

            <div className="border-t border-black/5 pt-2 dark:border-white/10">
              <RunsHeader splitLabel="Split" />
              <RunsRow
                team={away}
                value={awayDefense?.avgRa ?? null}
                season={awaySplit?.season_avg_f5_ra ?? null}
                diff={awayDefense?.diffVsSeason ?? null}
                goodWhenPositive={false}
              />
              <RunsRow
                team={home}
                value={homeDefense?.avgRa ?? null}
                season={homeSplit?.season_avg_f5_ra ?? null}
                diff={homeDefense?.diffVsSeason ?? null}
                goodWhenPositive={false}
              />
            </div>

            <LeanCallout>
              {away.abbrev} {handNote(game.away_sp_hand)} · {home.abbrev}{' '}
              {handNote(game.home_sp_hand)} — a green bar means this club gives up fewer first-five
              runs than its season norm behind that hand
            </LeanCallout>
          </>
        )}
      </div>
    </WidgetCard>
  );
}

/** The widget stack for one game, in recommendation-then-evidence order. */
export function F5SplitsSections({ item }: { item: F5FeedItem }) {
  return (
    <>
      <F5SideSection item={item} />
      <F5TotalSection item={item} />
      <F5MatchupSection item={item} />
      <F5OffenseSection item={item} />
      <F5DefenseSection item={item} />
    </>
  );
}
