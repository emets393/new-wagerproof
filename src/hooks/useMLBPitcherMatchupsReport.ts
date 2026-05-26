// Reworked: this hook used to read from `public.mlb_pitcher_matchups_report`
// (a precomputed table whose UI was wiped in the matchups revamp). We now
// compute the daily best-props ranking client-side from the same data the
// matchups page already pulls — no extra round-trips and the algorithm is
// versioned in `src/utils/dailyPropsReport.ts`.
//
// The hook ALSO returns the underlying data maps so the report page can mount
// the same `PlayerPropDetail` panel the matchups page uses when a user expands
// a pick. That keeps the "see the whole card" view a single component change.
import { useMemo } from 'react';
import { useTodaysMatchupGames } from '@/hooks/useTodaysMatchupGames';
import { useAllMatchupData } from '@/hooks/useAllMatchupData';
import { useAllPlayerProps } from '@/hooks/useAllPlayerProps';
import { useAllPitcherRecentStarts } from '@/hooks/useAllPitcherRecentStarts';
import { useLeagueBenchmarks } from '@/hooks/useLeagueBenchmarks';
import { buildDailyPropsReport, type DailyPropsReport } from '@/utils/dailyPropsReport';
import { seasonFromDate } from '@/utils/mlbPitcherMatchups';
import type {
  LeagueBenchmarks,
  MatchupGame,
  PitcherMatchupData,
} from '@/types/mlb-matchups';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import type { PitcherStartLog } from '@/hooks/usePitcherRecentStarts';

export type { DailyPropsReport, PropPick, PickTier, PickRationale } from '@/utils/dailyPropsReport';

export interface UseDailyPropsReportResult {
  report: DailyPropsReport | null;
  isLoading: boolean;
  isError: boolean;
  season: number;
  gameByPk: Map<number, MatchupGame>;
  propsByGamePk: Map<number, MlbPlayerPropRow[]>;
  matchupByGamePk: Map<number, PitcherMatchupData>;
  benchmarksR: LeagueBenchmarks;
  benchmarksL: LeagueBenchmarks;
}

export function useMLBPitcherMatchupsReport(): UseDailyPropsReportResult {
  const { data: games = [], isLoading: gamesLoading, isError } = useTodaysMatchupGames();
  const season = games[0] ? seasonFromDate(games[0].official_date) : new Date().getFullYear();

  const { dataByGamePk, isLoading: matchupLoading } = useAllMatchupData(games, games.length > 0);
  const { propsByGamePk, isLoading: propsLoading } = useAllPlayerProps(games, games.length > 0);
  const { data: pitcherStartsByPitcherId = new Map<number, PitcherStartLog[]>() } =
    useAllPitcherRecentStarts(games, season, games.length > 0);

  const { data: benchmarksR = {} } = useLeagueBenchmarks(season, 'R');
  const { data: benchmarksL = {} } = useLeagueBenchmarks(season, 'L');

  const gameByPk = useMemo(() => new Map(games.map(g => [g.game_pk, g])), [games]);

  const report = useMemo<DailyPropsReport | null>(() => {
    if (games.length === 0) return null;
    if (propsByGamePk.size === 0) return null;
    return buildDailyPropsReport({
      games,
      propsByGamePk,
      matchupByGamePk: dataByGamePk,
      pitcherStartsByPitcherId,
      benchmarksR,
      benchmarksL,
    });
  }, [games, propsByGamePk, dataByGamePk, pitcherStartsByPitcherId, benchmarksR, benchmarksL]);

  return {
    report,
    isLoading: gamesLoading || matchupLoading || propsLoading,
    isError,
    season,
    gameByPk,
    propsByGamePk,
    matchupByGamePk: dataByGamePk,
    benchmarksR,
    benchmarksL,
  };
}

// Convenience alias matching the new feature name.
export const useDailyPropsReport = useMLBPitcherMatchupsReport;
