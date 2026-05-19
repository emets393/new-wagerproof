import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { F5SplitRow, PitchHand, TodaysMlbGameForF5 } from '@/types/mlbF5Splits';
import { SAMPLE_THRESHOLDS } from '@/types/mlbF5Splits';
import { F5SplitGamesSubtext, F5SplitSampleValue } from './F5SplitSampleValue';
import { F5SplitsComparisonRow } from './F5SplitsComparisonRow';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  compareMetricColors,
  findSplitRow,
  formatGameDateLabel,
  formatGameTimeEt,
  formatMoneyline,
  getTeamDefenseSplitStats,
  hasEnoughSplitGames,
  pitchHandLabel,
  splitIsShowable,
} from '@/utils/mlbF5Splits';
import { espnMlb500LogoUrlFromAbbrev } from '@/utils/mlbTeamLogos';
import { F5SplitHandednessLabel } from '@/components/mlb/F5SplitHandednessLabel';
import { F5SplitsHowToReadAlert } from '@/components/mlb/F5SplitsHowToReadAlert';
import {
  offenseSectionBadgeLabel,
  offenseStatTitle,
  splitQualifierShort,
  splitQualifierTitle,
} from '@/utils/f5SplitLabels';
import { ArrowDown, ArrowUp, Info } from 'lucide-react';

interface F5SplitsGameCardProps {
  game: TodaysMlbGameForF5;
  splitLookup: Map<string, F5SplitRow>;
}

function TeamF5MlOdds({ ml }: { ml: number | null }) {
  return (
    <div className="mt-1.5 flex flex-col items-center gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        F5 ML Odds
      </span>
      <span className="text-sm font-bold text-foreground tabular-nums">
        {ml != null ? formatMoneyline(ml) : '—'}
      </span>
    </div>
  );
}

function TeamLogo({ abbrev, name }: { abbrev: string; name: string }) {
  return (
    <img
      src={espnMlb500LogoUrlFromAbbrev(abbrev)}
      alt=""
      className="h-10 w-10 sm:h-12 sm:w-12 object-contain shrink-0"
      onError={e => {
        const el = e.currentTarget;
        if (el.getAttribute('data-logo-fb') === '1') {
          el.style.display = 'none';
          return;
        }
        el.setAttribute('data-logo-fb', '1');
        el.src = espnMlb500LogoUrlFromAbbrev(abbrev === 'AZ' ? 'ARI' : abbrev);
      }}
      aria-hidden
      title={name}
    />
  );
}

function formatDiff(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function SignedDiffValue({ value, align }: { value: number; align: 'away' | 'home' }) {
  const text = formatDiff(value);
  const flex =
    align === 'away'
      ? 'inline-flex items-center justify-center sm:justify-end gap-0.5 w-full'
      : 'inline-flex items-center justify-center sm:justify-start gap-0.5 w-full';

  if (value > 0) {
    return (
      <span className={`${flex} font-semibold text-emerald-600 dark:text-emerald-400`}>
        <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{text}</span>
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className={`${flex} font-semibold text-red-600 dark:text-red-400`}>
        <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{text}</span>
      </span>
    );
  }
  return <span className="font-semibold text-muted-foreground">{text}</span>;
}

function LhpSampleCaveat({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild touchTapMode="toggle">
        <p className="text-[10px] sm:text-[11px] text-center text-amber-600 dark:text-amber-500 mb-2 px-1 leading-snug flex items-center justify-center gap-1 cursor-help touch-manipulation">
          <Info className="h-3 w-3 shrink-0" aria-hidden />
          <span>
            vs LHP samples are limited early-season — most starters are right-handed. Cells with
            * are small sample (&lt;{SAMPLE_THRESHOLDS.SMALL} games).
          </span>
        </p>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm text-xs leading-relaxed">
        When tonight&apos;s opposing starter is left-handed, teams may have only a handful of
        first-five games in that split. We still show the real numbers with sample-size flags rather
        than hiding them.
      </TooltipContent>
    </Tooltip>
  );
}

function offenseRows(
  awaySplit: F5SplitRow | null,
  homeSplit: F5SplitRow | null,
  awayLabel: React.ReactNode,
  homeLabel: React.ReactNode,
  awayVsLhp: boolean,
  homeVsLhp: boolean,
  awayQual: string,
  homeQual: string,
): React.ReactNode {
  const awayOk = awaySplit && hasEnoughSplitGames(awaySplit);
  const homeOk = homeSplit && hasEnoughSplitGames(homeSplit);

  if (!awayOk && !homeOk) {
    return (
      <p className="text-sm text-muted-foreground italic py-2">
        Not enough data for either team (fewer than {SAMPLE_THRESHOLDS.HIDE} games in this split)
      </p>
    );
  }

  const awayGames = awaySplit?.games ?? 0;
  const homeGames = homeSplit?.games ?? 0;

  const winColors = compareMetricColors(
    awayOk ? awaySplit!.f5_win_pct : null,
    homeOk ? homeSplit!.f5_win_pct : null,
    'higher',
  );
  const overColors = compareMetricColors(
    awayOk ? awaySplit!.f5_over_pct : null,
    homeOk ? homeSplit!.f5_over_pct : null,
    'higher',
  );
  const rsColors = compareMetricColors(
    awayOk ? awaySplit!.avg_f5_rs : null,
    homeOk ? homeSplit!.avg_f5_rs : null,
    'higher',
  );
  const seasonRsColors = compareMetricColors(
    awayOk ? awaySplit!.season_avg_f5_rs : null,
    homeOk ? homeSplit!.season_avg_f5_rs : null,
    'higher',
  );

  const bothComparable = awayOk && homeOk;

  return (
    <>
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title={offenseStatTitle('📊 First-five record', awayQual, homeQual)}
        away={
          awaySplit ? (
            <F5SplitSampleValue games={awayGames} vsLhp={awayVsLhp}>
              {awaySplit.f5_record}
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
        home={
          homeSplit ? (
            <F5SplitSampleValue games={homeGames} vsLhp={homeVsLhp}>
              {homeSplit.f5_record}
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
        awaySubtext={
          awayOk ? (
            <F5SplitGamesSubtext
              games={awayGames}
              suffix={`${awaySplit!.f5_win_pct}% win rate`}
            />
          ) : undefined
        }
        homeSubtext={
          homeOk ? (
            <F5SplitGamesSubtext
              games={homeGames}
              suffix={`${homeSplit!.f5_win_pct}% win rate`}
            />
          ) : undefined
        }
        awayClassName={bothComparable ? winColors.away : undefined}
        homeClassName={bothComparable ? winColors.home : undefined}
      />
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title={offenseStatTitle('📈 First-five over/under', awayQual, homeQual)}
        away={
          awaySplit ? (
            <F5SplitSampleValue games={awayGames} vsLhp={awayVsLhp}>
              {awaySplit.f5_ou_record}
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
        home={
          homeSplit ? (
            <F5SplitSampleValue games={homeGames} vsLhp={homeVsLhp}>
              {homeSplit.f5_ou_record}
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
        awaySubtext={
          awayOk ? (
            <F5SplitGamesSubtext games={awayGames} suffix={`${awaySplit!.f5_over_pct}% over`} />
          ) : undefined
        }
        homeSubtext={
          homeOk ? (
            <F5SplitGamesSubtext games={homeGames} suffix={`${homeSplit!.f5_over_pct}% over`} />
          ) : undefined
        }
        awayClassName={bothComparable ? overColors.away : undefined}
        homeClassName={bothComparable ? overColors.home : undefined}
      />
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title={offenseStatTitle('⚡ Avg first-five runs scored', awayQual, homeQual)}
        away={
          awaySplit ? (
            <F5SplitSampleValue games={awayGames} vsLhp={awayVsLhp}>
              {awaySplit.avg_f5_rs.toFixed(2)}
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
        home={
          homeSplit ? (
            <F5SplitSampleValue games={homeGames} vsLhp={homeVsLhp}>
              {homeSplit.avg_f5_rs.toFixed(2)}
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
        awayClassName={bothComparable ? rsColors.away : undefined}
        homeClassName={bothComparable ? rsColors.home : undefined}
      />
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title="📅 Season avg first-five runs scored (all games, all hands)"
        away={
          awaySplit ? (
            <F5SplitSampleValue games={awayGames} vsLhp={awayVsLhp}>
              {awaySplit.season_avg_f5_rs.toFixed(2)}
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
        home={
          homeSplit ? (
            <F5SplitSampleValue games={homeGames} vsLhp={homeVsLhp}>
              {homeSplit.season_avg_f5_rs.toFixed(2)}
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
        awayClassName={bothComparable ? seasonRsColors.away : undefined}
        homeClassName={bothComparable ? seasonRsColors.home : undefined}
      />
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title="↔️ Difference vs season (runs scored)"
        away={
          awaySplit ? (
            <F5SplitSampleValue games={awayGames} vsLhp={awayVsLhp}>
              <SignedDiffValue value={awaySplit.rs_diff_vs_season} align="away" />
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
        home={
          homeSplit ? (
            <F5SplitSampleValue games={homeGames} vsLhp={homeVsLhp}>
              <SignedDiffValue value={homeSplit.rs_diff_vs_season} align="home" />
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
      />
    </>
  );
}

function defenseRows(
  awaySplit: F5SplitRow | null,
  homeSplit: F5SplitRow | null,
  awayHand: PitchHand,
  homeHand: PitchHand,
  awayLabel: React.ReactNode,
  homeLabel: React.ReactNode,
): React.ReactNode {
  const awayDef = getTeamDefenseSplitStats(awaySplit, awayHand);
  const homeDef = getTeamDefenseSplitStats(homeSplit, homeHand);

  if (!awayDef && !homeDef) {
    return (
      <p className="text-sm text-muted-foreground italic py-2">
        Not enough data for either team (fewer than {SAMPLE_THRESHOLDS.HIDE} games with this starter
        hand)
      </p>
    );
  }

  const handLabel = (h: PitchHand) => (h === 'R' ? 'right' : h === 'L' ? 'left' : '');

  const raColors = compareMetricColors(awayDef?.avgRa, homeDef?.avgRa, 'lower');
  const awaySeasonOk = awaySplit && splitIsShowable(awaySplit.games);
  const homeSeasonOk = homeSplit && splitIsShowable(homeSplit.games);
  const seasonRaColors = compareMetricColors(
    awaySeasonOk ? awaySplit!.season_avg_f5_ra : null,
    homeSeasonOk ? homeSplit!.season_avg_f5_ra : null,
    'lower',
  );
  const awayHandLbl = handLabel(awayHand);
  const homeHandLbl = handLabel(homeHand);
  const bothComparable = !!awayDef && !!homeDef;

  return (
    <>
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title="🛡️ Avg first-five runs allowed in this split"
        away={
          awayDef ? (
            <F5SplitSampleValue games={awayDef.games}>
              {awayDef.avgRa.toFixed(2)}
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
        home={
          homeDef ? (
            <F5SplitSampleValue games={homeDef.games}>
              {homeDef.avgRa.toFixed(2)}
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
        awaySubtext={
          awayDef ? (
            <F5SplitGamesSubtext
              games={awayDef.games}
              suffix={awayHandLbl ? `${awayHandLbl}-handed starter` : undefined}
            />
          ) : undefined
        }
        homeSubtext={
          homeDef ? (
            <F5SplitGamesSubtext
              games={homeDef.games}
              suffix={homeHandLbl ? `${homeHandLbl}-handed starter` : undefined}
            />
          ) : undefined
        }
        awayClassName={bothComparable ? raColors.away : undefined}
        homeClassName={bothComparable ? raColors.home : undefined}
      />
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title="📅 Season avg first-five runs allowed"
        away={
          awaySplit && awaySeasonOk ? (
            <F5SplitSampleValue games={awaySplit.games}>
              {awaySplit.season_avg_f5_ra.toFixed(2)}
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
        home={
          homeSplit && homeSeasonOk ? (
            <F5SplitSampleValue games={homeSplit.games}>
              {homeSplit.season_avg_f5_ra.toFixed(2)}
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
        awayClassName={awaySeasonOk && homeSeasonOk ? seasonRaColors.away : undefined}
        homeClassName={awaySeasonOk && homeSeasonOk ? seasonRaColors.home : undefined}
      />
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title="↔️ Difference vs season (runs allowed)"
        away={
          awayDef ? (
            <F5SplitSampleValue games={awayDef.games}>
              <SignedDiffValue value={awayDef.diffVsSeason} align="away" />
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
        home={
          homeDef ? (
            <F5SplitSampleValue games={homeDef.games}>
              <SignedDiffValue value={homeDef.diffVsSeason} align="home" />
            </F5SplitSampleValue>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )
        }
      />
    </>
  );
}

export function F5SplitsGameCard({ game, splitLookup }: F5SplitsGameCardProps) {
  const awaySplit = findSplitRow(splitLookup, game.away_abbr, 'away', game.home_sp_hand);
  const homeSplit = findSplitRow(splitLookup, game.home_abbr, 'home', game.away_sp_hand);

  const awayVsLhp = game.home_sp_hand === 'L';
  const homeVsLhp = game.away_sp_hand === 'L';
  const showLhpCaveat =
    (awayVsLhp && awaySplit != null && awaySplit.games < SAMPLE_THRESHOLDS.SMALL) ||
    (homeVsLhp && homeSplit != null && homeSplit.games < SAMPLE_THRESHOLDS.SMALL);

  const lines: string[] = [];
  if (game.total_line != null) lines.push(`Game total: ${game.total_line}`);
  if (game.f5_total_line != null) lines.push(`First-5 total: ${game.f5_total_line}`);

  const awayDefLabel =
    game.away_sp_hand === 'R' || game.away_sp_hand === 'L'
      ? `when starting a ${game.away_sp_hand === 'R' ? 'right' : 'left'}-handed pitcher`
      : null;
  const homeDefLabel =
    game.home_sp_hand === 'R' || game.home_sp_hand === 'L'
      ? `when starting a ${game.home_sp_hand === 'R' ? 'right' : 'left'}-handed pitcher`
      : null;

  const awayOffenseQual =
    game.home_sp_hand === 'R' || game.home_sp_hand === 'L'
      ? splitQualifierShort('away', game.home_sp_hand)
      : 'away split';
  const homeOffenseQual =
    game.away_sp_hand === 'R' || game.away_sp_hand === 'L'
      ? splitQualifierShort('home', game.away_sp_hand)
      : 'home split';

  const awayOffenseHeader =
    game.home_sp_hand === 'R' || game.home_sp_hand === 'L'
      ? splitQualifierTitle('away', game.home_sp_hand)
      : null;
  const homeOffenseHeader =
    game.away_sp_hand === 'R' || game.away_sp_hand === 'L'
      ? splitQualifierTitle('home', game.away_sp_hand)
      : null;

  const awayColumnLabel =
    awayOffenseHeader != null ? (
      <span className="inline-flex flex-col items-center gap-0.5 max-w-full">
        <span className="truncate w-full">{game.away_abbr}</span>
        <span className="text-[9px] font-normal normal-case tracking-normal text-muted-foreground leading-tight">
          <F5SplitHandednessLabel
            homeAway="away"
            oppSpHand={game.home_sp_hand as 'R' | 'L'}
            games={awaySplit?.games}
            variant="title"
            className="text-[9px] font-normal text-muted-foreground"
          />
        </span>
      </span>
    ) : (
      game.away_abbr
    );

  const homeColumnLabel =
    homeOffenseHeader != null ? (
      <span className="inline-flex flex-col items-center gap-0.5 max-w-full">
        <span className="truncate w-full">{game.home_abbr}</span>
        <span className="text-[9px] font-normal normal-case tracking-normal text-muted-foreground leading-tight">
          <F5SplitHandednessLabel
            homeAway="home"
            oppSpHand={game.away_sp_hand as 'R' | 'L'}
            games={homeSplit?.games}
            variant="title"
            className="text-[9px] font-normal text-muted-foreground"
          />
        </span>
      </span>
    ) : (
      game.home_abbr
    );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-3 sm:px-6 pb-3 pt-4 space-y-3 bg-muted/30">
        <div className="flex items-start justify-center gap-2 sm:gap-6">
          <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
            <TeamLogo abbrev={game.away_abbr} name={game.away_team_name} />
            <span className="text-base sm:text-lg font-bold text-foreground">{game.away_abbr}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground text-center leading-tight line-clamp-2 px-0.5">
              {game.away_team_name}
              {awayOffenseHeader && (game.home_sp_hand === 'R' || game.home_sp_hand === 'L') ? (
                <>
                  {' · '}
                  <F5SplitHandednessLabel
                    homeAway="away"
                    oppSpHand={game.home_sp_hand}
                    games={awaySplit?.games}
                    variant="title"
                    className="text-[10px] sm:text-xs text-muted-foreground"
                  />
                </>
              ) : null}
            </span>
            <TeamF5MlOdds ml={game.f5_away_ml} />
          </div>
          <span className="text-base sm:text-lg font-bold text-muted-foreground shrink-0 pt-8">@</span>
          <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
            <TeamLogo abbrev={game.home_abbr} name={game.home_team_name} />
            <span className="text-base sm:text-lg font-bold text-foreground">{game.home_abbr}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground text-center leading-tight line-clamp-2 px-0.5">
              {game.home_team_name}
              {homeOffenseHeader && (game.away_sp_hand === 'R' || game.away_sp_hand === 'L') ? (
                <>
                  {' · '}
                  <F5SplitHandednessLabel
                    homeAway="home"
                    oppSpHand={game.away_sp_hand}
                    games={homeSplit?.games}
                    variant="title"
                    className="text-[10px] sm:text-xs text-muted-foreground"
                  />
                </>
              ) : null}
            </span>
            <TeamF5MlOdds ml={game.f5_home_ml} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <Badge variant="secondary" className="font-medium text-xs px-2 py-0.5">
              📅 {formatGameDateLabel(game.official_date)}
            </Badge>
            <Badge variant="outline" className="font-medium text-xs px-2 py-0.5">
              {formatGameTimeEt(game.game_time_et)}
            </Badge>
          </div>
          {game.venue_name ? (
            <span className="text-xs sm:text-sm text-muted-foreground text-center px-2 leading-snug">
              {game.venue_name}
            </span>
          ) : null}
        </div>
        {lines.length > 0 ? (
          <ul className="space-y-1 text-[11px] sm:text-xs text-muted-foreground max-w-sm mx-auto w-full">
            {lines.map(line => (
              <li key={line} className="text-center leading-snug">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </CardHeader>

      <CardContent className="px-3 sm:px-6 pt-2 pb-4 space-y-4 sm:space-y-5">
        <F5SplitsHowToReadAlert
          gamePk={game.game_pk}
          awayAbbr={game.away_abbr}
          homeAbbr={game.home_abbr}
          awayOppHand={game.home_sp_hand}
          homeOppHand={game.away_sp_hand}
        />
        <section>
          <h3 className="text-xs sm:text-sm font-bold text-foreground mb-1.5 text-center leading-snug px-1">
            ⚾ Tonight&apos;s pitching matchup
          </h3>
          <div className="rounded-lg border border-border/60 bg-card/40 px-1.5 sm:px-3 overflow-hidden">
            <F5SplitsComparisonRow
              awayLabel={game.away_abbr}
              homeLabel={game.home_abbr}
              title="⚾ Starting pitcher"
              away={
                <span className="text-xs sm:text-sm leading-snug">
                  {game.away_sp_name ?? 'TBD'}
                  {game.away_sp_hand ? ` (${pitchHandLabel(game.away_sp_hand)})` : ''}
                </span>
              }
              home={
                <span className="text-xs sm:text-sm leading-snug">
                  {game.home_sp_name ?? 'TBD'}
                  {game.home_sp_hand ? ` (${pitchHandLabel(game.home_sp_hand)})` : ''}
                </span>
              }
            />
            <F5SplitsComparisonRow
              awayLabel={game.away_abbr}
              homeLabel={game.home_abbr}
              title="🎯 Opposing starter"
              away={
                <span className="text-xs sm:text-sm leading-snug">
                  {game.home_sp_name ?? 'TBD'}
                  {game.home_sp_hand ? ` (${pitchHandLabel(game.home_sp_hand)})` : ''}
                </span>
              }
              home={
                <span className="text-xs sm:text-sm leading-snug">
                  {game.away_sp_name ?? 'TBD'}
                  {game.away_sp_hand ? ` (${pitchHandLabel(game.away_sp_hand)})` : ''}
                </span>
              }
            />
            <F5SplitsComparisonRow
              awayLabel={game.away_abbr}
              homeLabel={game.home_abbr}
              title="📍 Location"
              away="On the Road"
              home="At Home"
            />
          </div>
        </section>

        <Separator />

        <section>
          <h3 className="text-xs sm:text-sm font-bold text-foreground mb-1 text-center leading-snug px-1 flex flex-wrap items-center justify-center gap-2">
            <span>🔥 First-five offensive performance in this split</span>
            <Badge variant="outline" className="text-[10px] sm:text-xs font-normal">
              {offenseSectionBadgeLabel(
                game.away_abbr,
                game.home_abbr,
                game.home_sp_hand,
                game.away_sp_hand,
              )}
            </Badge>
          </h3>
          <p className="text-[10px] sm:text-[11px] text-center text-muted-foreground mb-1 px-1 leading-snug">
            <span className="sm:hidden">Matchup splits only · green = better</span>
            <span className="hidden sm:inline">
              Each column is that team&apos;s road/home record vs tonight&apos;s opposing starter hand ·
              green = better tonight
            </span>
          </p>
          <LhpSampleCaveat show={showLhpCaveat} />
          <div className="rounded-lg border border-border/60 bg-card/40 px-1.5 sm:px-3 overflow-hidden">
            {offenseRows(
              awaySplit,
              homeSplit,
              awayColumnLabel,
              homeColumnLabel,
              awayVsLhp,
              homeVsLhp,
              awayOffenseQual,
              homeOffenseQual,
            )}
          </div>
        </section>

        <Separator />

        <section>
          <h3 className="text-xs sm:text-sm font-bold text-foreground mb-1 text-center leading-snug px-1">
            🛡️ First-five defensive performance
          </h3>
          <p className="text-[10px] sm:text-[11px] text-center text-muted-foreground mb-2 px-1 leading-snug">
            <span className="sm:hidden">Own starter hand · green = fewer runs allowed</span>
            <span className="hidden sm:inline">
              {awayDefLabel && homeDefLabel
                ? `Away ${awayDefLabel} · Home ${homeDefLabel} · green = fewer runs allowed`
                : 'Based on each team’s own starter hand · green = fewer runs allowed'}
            </span>
          </p>
          <div className="rounded-lg border border-border/60 bg-card/40 px-1.5 sm:px-3 overflow-hidden">
            {defenseRows(
              awaySplit,
              homeSplit,
              game.away_sp_hand,
              game.home_sp_hand,
              game.away_abbr,
              game.home_abbr,
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
