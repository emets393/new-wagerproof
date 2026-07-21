import type { F5SplitRow, PitchHand, TodaysMlbGameForF5 } from '@/types/mlbF5Splits';
import { SAMPLE_THRESHOLDS } from '@/types/mlbF5Splits';
import {
  findSplitRow,
  getTeamDefenseSplitStats,
  hasEnoughSplitGames,
  type TeamDefenseSplitStats,
} from '@/utils/mlbF5Splits';
import { formatMlbToolTime, mlbToolTimeSortKey } from '../shared/feedUtils';
import { mlbToolTeam } from '../shared/teams';
import type { MlbToolFeedItem } from '../shared/types';
import type { Direction } from '../shared/visuals';

/**
 * Derives the two reads the tool actually makes — who wins the first five more
 * often in tonight's exact split, and whether those two offenses project over
 * or under the posted first-five total — from the raw split rows. The legacy
 * card showed every number and left both conclusions to the reader.
 */

/** A first-five win rate above this is better than a coin flip. */
export const F5_EVEN_PCT = 50;

export interface F5SideRead {
  lean: 'away' | 'home' | null;
  awayWinPct: number | null;
  homeWinPct: number | null;
  /** Points separating the two win rates; null unless both sides qualify. */
  marginPts: number | null;
}

export interface F5TotalRead {
  direction: Direction;
  /** Away avg F5 runs scored + home avg F5 runs scored, in tonight's split. */
  projected: number | null;
  line: number | null;
  /** projected − line. Sign drives `direction`, so the two always agree. */
  gap: number | null;
  awayOverPct: number | null;
  homeOverPct: number | null;
  avgOverPct: number | null;
}

export interface F5FeedItem extends MlbToolFeedItem {
  game: TodaysMlbGameForF5;
  /** Away offense vs tonight's home starter hand; null when the split is too thin. */
  awaySplit: F5SplitRow | null;
  homeSplit: F5SplitRow | null;
  /** True when the split row exists AND clears the display minimum. */
  awayShowable: boolean;
  homeShowable: boolean;
  awayDefense: TeamDefenseSplitStats | null;
  homeDefense: TeamDefenseSplitStats | null;
  side: F5SideRead;
  total: F5TotalRead;
  /**
   * Either offense split is under 10 games. Almost always an "opposing starter
   * is left-handed" artifact early in the season — most starters are righties,
   * so the vs-LHP bucket fills slowly.
   */
  smallSample: boolean;
}

function pctOrNull(row: F5SplitRow | null, showable: boolean, key: 'f5_win_pct' | 'f5_over_pct') {
  if (!row || !showable) return null;
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : null;
}

function avgOrNull(row: F5SplitRow | null, showable: boolean, key: 'avg_f5_rs' | 'season_avg_f5_rs') {
  if (!row || !showable) return null;
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : null;
}

function buildSideRead(
  awaySplit: F5SplitRow | null,
  homeSplit: F5SplitRow | null,
  awayShowable: boolean,
  homeShowable: boolean,
): F5SideRead {
  const awayWinPct = pctOrNull(awaySplit, awayShowable, 'f5_win_pct');
  const homeWinPct = pctOrNull(homeSplit, homeShowable, 'f5_win_pct');
  if (awayWinPct === null || homeWinPct === null || awayWinPct === homeWinPct) {
    return { lean: null, awayWinPct, homeWinPct, marginPts: null };
  }
  return {
    lean: awayWinPct > homeWinPct ? 'away' : 'home',
    awayWinPct,
    homeWinPct,
    marginPts: Math.abs(awayWinPct - homeWinPct),
  };
}

function buildTotalRead(
  game: TodaysMlbGameForF5,
  awaySplit: F5SplitRow | null,
  homeSplit: F5SplitRow | null,
  awayShowable: boolean,
  homeShowable: boolean,
): F5TotalRead {
  const awayRs = avgOrNull(awaySplit, awayShowable, 'avg_f5_rs');
  const homeRs = avgOrNull(homeSplit, homeShowable, 'avg_f5_rs');
  const awayOverPct = pctOrNull(awaySplit, awayShowable, 'f5_over_pct');
  const homeOverPct = pctOrNull(homeSplit, homeShowable, 'f5_over_pct');

  const overPcts = [awayOverPct, homeOverPct].filter((p): p is number => p !== null);
  const avgOverPct =
    overPcts.length > 0 ? overPcts.reduce((a, b) => a + b, 0) / overPcts.length : null;

  const projected = awayRs !== null && homeRs !== null ? awayRs + homeRs : null;
  const line = game.f5_total_line;
  // Direction is derived from the same gap the card prints, so the arrow can
  // never contradict the number beside it (WIDGET_DESIGN rule 10).
  const gap = projected !== null && line !== null ? projected - line : null;
  const direction: Direction = gap === null || gap === 0 ? null : gap > 0 ? 'over' : 'under';

  return { direction, projected, line, gap, awayOverPct, homeOverPct, avgOverPct };
}

/** Starting-pitcher hand as a display suffix, e.g. "Skubal (LHP)". */
export function handSuffix(hand: PitchHand): string {
  return hand === 'R' ? 'RHP' : hand === 'L' ? 'LHP' : '';
}

/** Family name only — the feed caption has no room for "Tarik Skubal". */
export function lastName(name: string | null): string {
  if (!name) return 'TBD';
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

export function buildF5FeedItems(
  games: TodaysMlbGameForF5[],
  lookup: Map<string, F5SplitRow>,
): F5FeedItem[] {
  return games
    .map((game) => {
      // Offense splits key off the OPPOSING starter's hand; defense splits key
      // off the team's own starter. Getting these backwards silently returns a
      // real-looking but wrong row, which is why they're derived here once.
      const awaySplit = findSplitRow(lookup, game.away_abbr, 'away', game.home_sp_hand);
      const homeSplit = findSplitRow(lookup, game.home_abbr, 'home', game.away_sp_hand);
      const awayShowable = hasEnoughSplitGames(awaySplit);
      const homeShowable = hasEnoughSplitGames(homeSplit);

      const smallSample =
        (awaySplit != null && awaySplit.games < SAMPLE_THRESHOLDS.SMALL) ||
        (homeSplit != null && homeSplit.games < SAMPLE_THRESHOLDS.SMALL);

      return {
        id: String(game.game_pk),
        gamePk: game.game_pk,
        away: mlbToolTeam(game.away_abbr, game.away_team_name),
        home: mlbToolTeam(game.home_abbr, game.home_team_name),
        gameDate: game.official_date,
        gameTimeLabel: formatMlbToolTime(game.game_time_et),
        timeSortKey: mlbToolTimeSortKey(game.official_date, game.game_time_et),
        game,
        awaySplit,
        homeSplit,
        awayShowable,
        homeShowable,
        awayDefense: getTeamDefenseSplitStats(awaySplit, game.away_sp_hand),
        homeDefense: getTeamDefenseSplitStats(homeSplit, game.home_sp_hand),
        side: buildSideRead(awaySplit, homeSplit, awayShowable, homeShowable),
        total: buildTotalRead(game, awaySplit, homeSplit, awayShowable, homeShowable),
        smallSample,
      } satisfies F5FeedItem;
    })
    .sort((a, b) => a.timeSortKey.localeCompare(b.timeSortKey));
}
