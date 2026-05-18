import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { F5SplitRow, PitchHand, TodaysMlbGameForF5 } from '@/types/mlbF5Splits';
import { F5SplitsComparisonRow } from './F5SplitsComparisonRow';
import {
  compareMetricColors,
  findSplitRow,
  formatGameDateLabel,
  formatGameTimeEt,
  formatMoneyline,
  getTeamDefenseSplitStats,
  hasEnoughSplitGames,
  pitchHandLabel,
} from '@/utils/mlbF5Splits';
import { espnMlb500LogoUrlFromAbbrev } from '@/utils/mlbTeamLogos';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface F5SplitsGameCardProps {
  game: TodaysMlbGameForF5;
  splitLookup: Map<string, F5SplitRow>;
}

function NotEnough() {
  return (
    <span className="text-xs sm:text-sm text-muted-foreground italic whitespace-nowrap">
      Not enough data
    </span>
  );
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

function offenseRows(
  awaySplit: F5SplitRow | null,
  homeSplit: F5SplitRow | null,
  awayLabel: string,
  homeLabel: string,
): React.ReactNode {
  const awayOk = hasEnoughSplitGames(awaySplit);
  const homeOk = hasEnoughSplitGames(homeSplit);

  if (!awayOk && !homeOk) {
    return <p className="text-sm text-muted-foreground italic py-2">Not enough data for either team</p>;
  }

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
  return (
    <>
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title="📊 First-five record in this split"
        away={awayOk ? awaySplit!.f5_record : <NotEnough />}
        home={homeOk ? homeSplit!.f5_record : <NotEnough />}
        awaySubtext={
          awayOk ? `${awaySplit!.f5_win_pct}% win rate · ${awaySplit!.games} games` : undefined
        }
        homeSubtext={
          homeOk ? `${homeSplit!.f5_win_pct}% win rate · ${homeSplit!.games} games` : undefined
        }
        awayClassName={awayOk && homeOk ? winColors.away : undefined}
        homeClassName={awayOk && homeOk ? winColors.home : undefined}
      />
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title="📈 First-five over/under in this split"
        away={awayOk ? awaySplit!.f5_ou_record : <NotEnough />}
        home={homeOk ? homeSplit!.f5_ou_record : <NotEnough />}
        awaySubtext={awayOk ? `${awaySplit!.f5_over_pct}% over` : undefined}
        homeSubtext={homeOk ? `${homeSplit!.f5_over_pct}% over` : undefined}
        awayClassName={awayOk && homeOk ? overColors.away : undefined}
        homeClassName={awayOk && homeOk ? overColors.home : undefined}
      />
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title="⚡ Avg first-five runs scored in this split"
        away={awayOk ? awaySplit!.avg_f5_rs.toFixed(2) : <NotEnough />}
        home={homeOk ? homeSplit!.avg_f5_rs.toFixed(2) : <NotEnough />}
        awayClassName={awayOk && homeOk ? rsColors.away : undefined}
        homeClassName={awayOk && homeOk ? rsColors.home : undefined}
      />
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title="📅 Season avg first-five runs scored"
        away={awayOk ? awaySplit!.season_avg_f5_rs.toFixed(2) : <NotEnough />}
        home={homeOk ? homeSplit!.season_avg_f5_rs.toFixed(2) : <NotEnough />}
        awayClassName={awayOk && homeOk ? seasonRsColors.away : undefined}
        homeClassName={awayOk && homeOk ? seasonRsColors.home : undefined}
      />
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title="↔️ Difference vs season (runs scored)"
        away={
          awayOk ? <SignedDiffValue value={awaySplit!.rs_diff_vs_season} align="away" /> : <NotEnough />
        }
        home={
          homeOk ? <SignedDiffValue value={homeSplit!.rs_diff_vs_season} align="home" /> : <NotEnough />
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
  awayLabel: string,
  homeLabel: string,
): React.ReactNode {
  const awayDef = getTeamDefenseSplitStats(awaySplit, awayHand);
  const homeDef = getTeamDefenseSplitStats(homeSplit, homeHand);

  if (!awayDef && !homeDef) {
    return <p className="text-sm text-muted-foreground italic py-2">Not enough data for either team</p>;
  }

  const handLabel = (h: PitchHand) => (h === 'R' ? 'right' : h === 'L' ? 'left' : '');

  const raColors = compareMetricColors(
    awayDef?.avgRa,
    homeDef?.avgRa,
    'lower',
  );
  const seasonRaColors = compareMetricColors(
    awaySplit && hasEnoughSplitGames(awaySplit) ? awaySplit.season_avg_f5_ra : null,
    homeSplit && hasEnoughSplitGames(homeSplit) ? homeSplit.season_avg_f5_ra : null,
    'lower',
  );
  const awayHandLbl = handLabel(awayHand);
  const homeHandLbl = handLabel(homeHand);

  return (
    <>
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title="🛡️ Avg first-five runs allowed in this split"
        away={awayDef ? awayDef.avgRa.toFixed(2) : <NotEnough />}
        home={homeDef ? homeDef.avgRa.toFixed(2) : <NotEnough />}
        awaySubtext={
          awayDef && awayHandLbl
            ? `${awayHandLbl}-handed starter · ${awayDef.games} games`
            : awayDef
              ? `based on ${awayDef.games} games`
              : undefined
        }
        homeSubtext={
          homeDef && homeHandLbl
            ? `${homeHandLbl}-handed starter · ${homeDef.games} games`
            : homeDef
              ? `based on ${homeDef.games} games`
              : undefined
        }
        awayClassName={awayDef && homeDef ? raColors.away : undefined}
        homeClassName={awayDef && homeDef ? raColors.home : undefined}
      />
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title="📅 Season avg first-five runs allowed"
        away={
          awaySplit && hasEnoughSplitGames(awaySplit) ? (
            awaySplit.season_avg_f5_ra.toFixed(2)
          ) : (
            <NotEnough />
          )
        }
        home={
          homeSplit && hasEnoughSplitGames(homeSplit) ? (
            homeSplit.season_avg_f5_ra.toFixed(2)
          ) : (
            <NotEnough />
          )
        }
        awayClassName={
          awaySplit && hasEnoughSplitGames(awaySplit) && homeSplit && hasEnoughSplitGames(homeSplit)
            ? seasonRaColors.away
            : undefined
        }
        homeClassName={
          awaySplit && hasEnoughSplitGames(awaySplit) && homeSplit && hasEnoughSplitGames(homeSplit)
            ? seasonRaColors.home
            : undefined
        }
      />
      <F5SplitsComparisonRow
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        title="↔️ Difference vs season (runs allowed)"
        away={
          awayDef ? <SignedDiffValue value={awayDef.diffVsSeason} align="away" /> : <NotEnough />
        }
        home={
          homeDef ? <SignedDiffValue value={homeDef.diffVsSeason} align="home" /> : <NotEnough />
        }
      />
    </>
  );
}

export function F5SplitsGameCard({ game, splitLookup }: F5SplitsGameCardProps) {
  const awaySplit = findSplitRow(splitLookup, game.away_abbr, 'away', game.home_sp_hand);
  const homeSplit = findSplitRow(splitLookup, game.home_abbr, 'home', game.away_sp_hand);

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

  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-3 sm:px-6 pb-3 pt-4 space-y-3 bg-muted/30">
        <div className="flex items-start justify-center gap-2 sm:gap-6">
          <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
            <TeamLogo abbrev={game.away_abbr} name={game.away_team_name} />
            <span className="text-base sm:text-lg font-bold text-foreground">{game.away_abbr}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground text-center leading-tight line-clamp-2 px-0.5">
              {game.away_team_name}
            </span>
            <TeamF5MlOdds ml={game.f5_away_ml} />
          </div>
          <span className="text-base sm:text-lg font-bold text-muted-foreground shrink-0 pt-8">@</span>
          <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
            <TeamLogo abbrev={game.home_abbr} name={game.home_team_name} />
            <span className="text-base sm:text-lg font-bold text-foreground">{game.home_abbr}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground text-center leading-tight line-clamp-2 px-0.5">
              {game.home_team_name}
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
          <h3 className="text-xs sm:text-sm font-bold text-foreground mb-1 text-center leading-snug px-1">
            🔥 First-five offensive performance in this split
          </h3>
          <p className="text-[10px] sm:text-[11px] text-center text-muted-foreground mb-2 px-1 leading-snug">
            <span className="sm:hidden">Opposing starter hand · green = better</span>
            <span className="hidden sm:inline">
              Sliced by the opposing starter&apos;s throwing hand · green = better tonight
            </span>
          </p>
          <div className="rounded-lg border border-border/60 bg-card/40 px-1.5 sm:px-3 overflow-hidden">
            {offenseRows(awaySplit, homeSplit, game.away_abbr, game.home_abbr)}
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
