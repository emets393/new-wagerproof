import { Activity, Flame, Shield, TrendingDown, TrendingUp } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import type { BullpenFatigue } from '@/hooks/useMLBRegressionReport';
import {
  Callout,
  Disclosure,
  DivergingBar,
  GapCompare,
  StatCell,
  TeamMark,
  ThresholdMeter,
  VerdictChip,
  fmt,
  signed,
} from '../shared';
import type { RegressionBatting, RegressionGame, RegressionPitcher, RegressionTeam } from '../../types';
import { regressionTeamAbbr } from '../../buildFeed';

/** Match a report row's team name back to one of this game's two teams. */
function teamFor(game: RegressionGame, name: string | null | undefined): RegressionTeam {
  const abbrev = regressionTeamAbbr(name);
  return abbrev === game.home.abbrev ? game.home : game.away;
}

/** Header row shared by every per-team regression entry: logo, who, verdict. */
function EntryHeader({
  team,
  title,
  caption,
  chip,
}: {
  team: RegressionTeam;
  title: string;
  caption?: string | null;
  chip: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamMark team={team} size={32} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[14px] font-bold leading-tight text-foreground">{title}</span>
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {team.abbrev}
          {caption ? ` · ${caption}` : ''}
        </span>
      </div>
      <span className="ml-auto shrink-0">{chip}</span>
    </div>
  );
}

/**
 * "Are tonight's starters pitching over or under their heads?"
 *
 * ERA is the result; xFIP is what the strikeouts, walks and fly balls say the
 * result should have been. The gap between them is the whole card, so it gets
 * the facing-figures treatment rather than being left for the reader to subtract.
 */
export function PitcherRegressionSection({ game }: { game: RegressionGame }) {
  if (game.pitchers.length === 0) return null;

  return (
    <WidgetCard
      icon={<Flame />}
      title="Starting pitchers"
      subtitle="Starters whose run prevention has drifted from what their strikeouts, walks and contact allowed support."
    >
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {game.pitchers.map((p, i) => (
          <PitcherEntry key={`${p.pitcher_name}-${i}`} pitcher={p} game={game} />
        ))}
      </div>
    </WidgetCard>
  );
}

function PitcherEntry({ pitcher, game }: { pitcher: RegressionPitcher; game: RegressionGame }) {
  const team = teamFor(game, pitcher.team_name);
  const improving = pitcher.direction === 'positive';
  const gap = pitcher.era_minus_xfip ?? 0;

  return (
    <div className="space-y-3 py-3 first:pt-0 last:pb-0">
      <EntryHeader
        team={team}
        title={pitcher.pitcher_name}
        caption={`${pitcher.starts} starts · ${fmt(pitcher.ip, 1)} IP`}
        chip={
          improving ? (
            <VerdictChip tone="success" icon={<TrendingUp className="h-3 w-3" />}>
              Due to improve
            </VerdictChip>
          ) : (
            <VerdictChip tone="danger" icon={<TrendingDown className="h-3 w-3" />}>
              Due to slip
            </VerdictChip>
          )
        }
      />

      <GapCompare
        leftLabel="ERA (actual)"
        leftValue={fmt(pitcher.era)}
        rightLabel="xFIP (deserved)"
        rightValue={fmt(pitcher.xfip)}
        gap={signed(gap, 2)}
        gapCaption="runs"
        gapIsGood={improving}
      />

      <Callout>
        <span className="font-bold text-foreground">{pitcher.pitcher_name}</span>'s ERA sits{' '}
        <span className="font-bold text-foreground">{Math.abs(gap).toFixed(2)} runs</span>{' '}
        {improving ? 'above' : 'below'} what his peripherals support — a{' '}
        <span className="font-bold text-foreground">{pitcher.severity}</span> gap, so expect his run
        prevention to {improving ? 'improve' : 'slip'}.
      </Callout>

      <Disclosure
        title="Full pitching profile"
        summary={`${pitcher.starts} starts`}
        intro="Season rates plus the change over his last three starts. A positive trend means the number got worse."
      >
        <div className="grid grid-cols-4 gap-x-2 gap-y-2.5">
          <StatCell label="xERA" value={fmt(pitcher.xera)} title="Expected ERA from batted-ball quality" />
          <StatCell label="FIP" value={fmt(pitcher.fip)} title="ERA estimate using strikeouts, walks and home runs only" />
          <StatCell
            label="WHIP"
            value={fmt(pitcher.whip)}
            tone={pitcher.whip == null ? null : pitcher.whip >= 1.35 ? 'bad' : pitcher.whip <= 1.1 ? 'good' : null}
            title="Walks plus hits per inning. Elite under 1.10, concerning over 1.35"
          />
          <StatCell
            label="xwOBA"
            value={pitcher.xwoba != null ? pitcher.xwoba.toFixed(3) : '—'}
            tone={pitcher.xwoba == null ? null : pitcher.xwoba >= 0.34 ? 'bad' : pitcher.xwoba <= 0.26 ? 'good' : null}
            title="Quality of contact allowed"
          />
          <StatCell label="K%" value={fmt(pitcher.k_pct, 1, '%')} title="Strikeout rate" />
          <StatCell
            label="BB%"
            value={fmt(pitcher.bb_pct, 1, '%')}
            tone={pitcher.bb_pct != null && pitcher.bb_pct >= 12 ? 'bad' : null}
            title="Walk rate — higher is worse control"
          />
          <StatCell label="HR/9" value={fmt(pitcher.hr_per_9)} title="Home runs allowed per nine innings" />
          <StatCell
            label="xFIP L3"
            value={pitcher.trend_xfip != null ? signed(pitcher.trend_xfip, 2) : '—'}
            tone={
              pitcher.trend_xfip == null
                ? null
                : pitcher.trend_xfip > 0.3
                  ? 'bad'
                  : pitcher.trend_xfip < -0.3
                    ? 'good'
                    : null
            }
            title="Change in xFIP over his last three starts"
          />
        </div>
      </Disclosure>
    </div>
  );
}

/** League-average BABIP. Every batting bar diverges from here, not from zero. */
const LEAGUE_BABIP = 0.3;

/**
 * "Are these lineups scoring what their contact deserves?"
 *
 * wOBA is the result; xwOBACon is the quality of contact behind it. A lineup
 * hitting the ball hard with nothing to show for it is the buy signal.
 */
export function BattingRegressionSection({ game }: { game: RegressionGame }) {
  if (game.batting.length === 0) return null;

  return (
    <WidgetCard
      icon={<Activity />}
      title="Team offense"
      subtitle="Lineups whose run output has drifted from the quality of contact they are actually making."
    >
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {game.batting.map((b, i) => (
          <BattingEntry key={`${b.team_name}-${i}`} batting={b} game={game} />
        ))}
      </div>
    </WidgetCard>
  );
}

function BattingEntry({ batting, game }: { batting: RegressionBatting; game: RegressionGame }) {
  const team = teamFor(game, batting.team_name);
  const heating = batting.direction === 'heat';
  const gap = batting.woba_gap;
  const babipDelta = batting.babip != null ? batting.babip - LEAGUE_BABIP : null;

  return (
    <div className="space-y-3 py-3 first:pt-0 last:pb-0">
      <EntryHeader
        team={team}
        title={batting.team_name}
        caption={`${batting.games} games`}
        chip={
          heating ? (
            <VerdictChip tone="success" icon={<TrendingUp className="h-3 w-3" />}>
              Due to heat up
            </VerdictChip>
          ) : (
            <VerdictChip tone="danger" icon={<TrendingDown className="h-3 w-3" />}>
              Due to cool down
            </VerdictChip>
          )
        }
      />

      <GapCompare
        leftLabel="wOBA (actual)"
        leftValue={batting.woba != null ? batting.woba.toFixed(3) : '—'}
        rightLabel="Contact quality"
        rightValue={batting.xwobacon != null ? batting.xwobacon.toFixed(3) : '—'}
        gap={gap != null ? signed(gap, 3) : '—'}
        gapCaption="gap"
        gapIsGood={heating}
      />

      {/* BABIP diverges from the .300 league line: luck on balls in play is the
          single clearest tell that a hot or cold stretch is not real. */}
      <div className="flex items-center gap-2">
        <span className="w-[68px] shrink-0 text-[11px] font-semibold text-foreground">BABIP</span>
        <span className="w-12 shrink-0 text-right text-[11px] font-bold tabular-nums text-foreground">
          {batting.babip != null ? batting.babip.toFixed(3) : '—'}
        </span>
        <DivergingBar value={babipDelta} cap={0.06} invert={heating} />
        <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
          vs .300
        </span>
      </div>

      <Callout>
        {heating
          ? 'Hitting the ball better than the results show — expect the runs to follow.'
          : 'Results have outrun the contact quality — expect the runs to dry up.'}
      </Callout>

      <Disclosure
        title="Contact quality detail"
        summary={`${batting.games} games`}
        intro="Statcast season rates, with the change over the last five games. Positive trends mean improving."
      >
        <div className="grid grid-cols-4 gap-x-2 gap-y-2.5">
          <StatCell
            label="Hard hit"
            value={batting.hard_hit_pct != null ? `${(batting.hard_hit_pct * 100).toFixed(1)}%` : '—'}
            tone={
              batting.hard_hit_pct == null
                ? null
                : batting.hard_hit_pct > 0.38
                  ? 'good'
                  : batting.hard_hit_pct < 0.3
                    ? 'bad'
                    : null
            }
            title="Share of batted balls at 95 mph or more"
          />
          <StatCell
            label="Barrel"
            value={batting.barrel_pct != null ? `${(batting.barrel_pct * 100).toFixed(1)}%` : '—'}
            tone={
              batting.barrel_pct == null
                ? null
                : batting.barrel_pct > 0.08
                  ? 'good'
                  : batting.barrel_pct < 0.04
                    ? 'bad'
                    : null
            }
            title="Share of batted balls with ideal exit velocity and launch angle"
          />
          <StatCell
            label="Exit velo"
            value={fmt(batting.avg_ev, 1)}
            tone={batting.avg_ev == null ? null : batting.avg_ev > 87.5 ? 'good' : batting.avg_ev < 84.5 ? 'bad' : null}
            title="Average speed off the bat"
          />
          <StatCell label="Launch" value={fmt(batting.launch_angle, 1, '°')} title="Average launch angle" />
          <StatCell label="OBP" value={batting.obp != null ? batting.obp.toFixed(3) : '—'} />
          <StatCell label="SLG" value={batting.slg != null ? batting.slg.toFixed(3) : '—'} />
          <StatCell label="HR/G" value={fmt(batting.hr_per_game, 2)} />
          <StatCell
            label="Contact L5"
            value={batting.trend_xwobacon != null ? signed(batting.trend_xwobacon, 3) : '—'}
            tone={
              batting.trend_xwobacon == null
                ? null
                : batting.trend_xwobacon > 0.015
                  ? 'good'
                  : batting.trend_xwobacon < -0.015
                    ? 'bad'
                    : null
            }
            title="Change in contact quality over the last five games"
          />
        </div>
      </Disclosure>
    </div>
  );
}

/** Innings that pin the workload bars to full width. */
const BULLPEN_IP_3D_MAX = 20;
const BULLPEN_IP_5D_MAX = 32;
/** Usage levels the report treats as heavy. */
const BULLPEN_IP_3D_HEAVY = 13;
const BULLPEN_IP_5D_HEAVY = 22;

/**
 * "Has either bullpen been run into the ground?"
 *
 * The raw innings mean nothing without the line they cross, so both bars carry
 * the heavy-usage tick rather than relying on a red number.
 */
export function BullpenSection({ game }: { game: RegressionGame }) {
  if (game.bullpens.length === 0) return null;

  return (
    <WidgetCard
      icon={<Shield />}
      title="Bullpen workload"
      subtitle="Relief staffs that have been leaned on the last few days, or whose form is sliding."
    >
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {game.bullpens.map((b, i) => (
          <BullpenEntry key={`${b.team_name}-${i}`} bullpen={b} game={game} />
        ))}
      </div>
    </WidgetCard>
  );
}

function BullpenEntry({ bullpen, game }: { bullpen: BullpenFatigue; game: RegressionGame }) {
  const team = teamFor(game, bullpen.team_name);
  const overworked = bullpen.flag === 'overworked';
  const trend = bullpen.trend_bp_xfip;

  return (
    <div className="space-y-3 py-3 first:pt-0 last:pb-0">
      <EntryHeader
        team={team}
        title={bullpen.team_name}
        chip={
          overworked ? (
            <VerdictChip tone="danger">Overworked</VerdictChip>
          ) : (
            <VerdictChip tone="warning">Trending worse</VerdictChip>
          )
        }
      />

      <ThresholdMeter
        value={bullpen.bp_ip_last3d}
        threshold={BULLPEN_IP_3D_HEAVY}
        max={BULLPEN_IP_3D_MAX}
        label="Innings thrown in the last 3 days"
      />
      <ThresholdMeter
        value={bullpen.bp_ip_last5d}
        threshold={BULLPEN_IP_5D_HEAVY}
        max={BULLPEN_IP_5D_MAX}
        label="Innings thrown in the last 5 days"
      />

      <div className="flex items-center gap-2">
        <span className="w-[68px] shrink-0 text-[11px] font-semibold text-foreground">Form</span>
        <span className="w-12 shrink-0 text-right text-[11px] font-bold tabular-nums text-foreground">
          {fmt(bullpen.season_bp_xfip)}
        </span>
        {/* A falling xFIP is an improving bullpen, so the bar is inverted. */}
        <DivergingBar value={trend} cap={0.8} invert />
        <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
          {trend != null ? signed(trend, 2) : '—'}
        </span>
      </div>

      <Callout>
        {overworked
          ? 'Heavy recent usage — the back end is likely to be short or tired tonight.'
          : 'Season xFIP with the recent trend beside it; a rising number means the pen is getting worse.'}
      </Callout>
    </div>
  );
}
