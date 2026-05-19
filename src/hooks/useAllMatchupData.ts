import { useQueries } from '@tanstack/react-query';
import type { MatchupGame, PitcherMatchupData } from '@/types/mlb-matchups';
import { fetchPitcherMatchupDataForGame } from '@/hooks/usePitcherMatchupData';
import { seasonFromDate } from '@/utils/mlbPitcherMatchups';

export function useAllMatchupData(games: MatchupGame[], enabled: boolean) {
  const season = games[0] ? seasonFromDate(games[0].official_date) : new Date().getFullYear();

  const queries = useQueries({
    queries: games.map(game => ({
      queryKey: ['mlb-pitcher-matchup-data', game.game_pk, game.away_sp_id, game.home_sp_id, season],
      queryFn: () => fetchPitcherMatchupDataForGame(game, season),
      enabled: enabled && game.game_pk > 0,
      staleTime: 10 * 60 * 1000,
    })),
  });

  const dataByGamePk = new Map<number, PitcherMatchupData>();
  for (let i = 0; i < games.length; i++) {
    const result = queries[i];
    if (result.data) dataByGamePk.set(games[i].game_pk, result.data);
  }

  const isLoading = queries.some(q => q.isLoading);
  const isError = queries.some(q => q.isError);

  return { dataByGamePk, isLoading, isError, queries };
}
