import { useState, useEffect, useCallback } from 'react';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { getNBATeamInitials } from '@/utils/teamColors';
import {
  GameAccuracyData,
  AccuracySortMode,
  roundToNearestHalf,
} from '@/types/modelAccuracy';

interface UseNBAModelAccuracyResult {
  games: GameAccuracyData[];
  isLoading: boolean;
  error: string | null;
  sortMode: AccuracySortMode;
  setSortMode: (mode: AccuracySortMode) => void;
  refetch: () => Promise<void>;
}

function sortGames(games: GameAccuracyData[], mode: AccuracySortMode): GameAccuracyData[] {
  const byTime = (a: GameAccuracyData, b: GameAccuracyData) => {
    if (a.gameDate !== b.gameDate) return a.gameDate.localeCompare(b.gameDate);
    return (a.tipoffTime || '').localeCompare(b.tipoffTime || '');
  };

  if (mode === 'time') return [...games].sort(byTime);

  const accuracy = (g: GameAccuracyData): number => {
    if (mode === 'spread') return g.spreadAccuracy?.accuracy_pct ?? -1;
    if (mode === 'moneyline') return g.mlAccuracy?.accuracy_pct ?? -1;
    return g.ouAccuracy?.accuracy_pct ?? -1;
  };

  return [...games].sort((a, b) => {
    const diff = accuracy(b) - accuracy(a);
    return diff !== 0 ? diff : byTime(a, b);
  });
}

export function useNBAModelAccuracy(): UseNBAModelAccuracyResult {
  const [games, setGames] = useState<GameAccuracyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<AccuracySortMode>('time');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: rows, error: viewError } = await collegeFootballSupabase
        .from('nba_todays_games_predictions_with_accuracy')
        .select('*')
        .order('game_date', { ascending: true })
        .order('tipoff_time_et', { ascending: true });

      if (viewError) {
        setError(`Failed to load: ${viewError.message}`);
        return;
      }

      const list = (rows || []) as any[];
      const merged: GameAccuracyData[] = list.map((row: any) => {
        const vegasHomeSpread = row.vegas_home_spread != null ? Number(row.vegas_home_spread) : null;
        const vegasTotal = row.vegas_total != null ? Number(row.vegas_total) : null;
        const modelFair = row.model_fair_home_spread != null ? Number(row.model_fair_home_spread) : null;
        const predTotal = row.pred_total_points != null ? Number(row.pred_total_points) : null;
        const homeSpreadDiff =
          vegasHomeSpread !== null && modelFair !== null ? vegasHomeSpread - modelFair : null;
        const overLineDiff =
          vegasTotal !== null && predTotal !== null ? predTotal - vegasTotal : null;
        const homeWinProb = row.home_win_prob != null ? Number(row.home_win_prob) : null;
        const awayWinProb = row.away_win_prob != null ? Number(row.away_win_prob) : null;
        const mlBucketKey = row.ml_bucket != null ? Number(row.ml_bucket) : null;
        const mlPickIsHome =
          row.model_ml_winner === 'home' ? true : row.model_ml_winner === 'away' ? false : null;

        const spreadAcc =
          row.spread_accuracy_pct != null && row.spread_bucket_games != null
            ? { games: Number(row.spread_bucket_games), accuracy_pct: Number(row.spread_accuracy_pct) }
            : null;
        const ouAcc =
          row.ou_accuracy_pct != null && row.ou_bucket_games != null
            ? { games: Number(row.ou_bucket_games), accuracy_pct: Number(row.ou_accuracy_pct) }
            : null;
        const mlAcc =
          row.ml_accuracy_pct != null && row.ml_bucket_games != null
            ? { games: Number(row.ml_bucket_games), accuracy_pct: Number(row.ml_accuracy_pct) }
            : null;

        return {
          gameId: row.game_id,
          awayTeam: row.away_team ?? '',
          homeTeam: row.home_team ?? '',
          awayAbbr: getNBATeamInitials(row.away_team ?? ''),
          homeAbbr: getNBATeamInitials(row.home_team ?? ''),
          gameDate: row.game_date ?? '',
          tipoffTime: row.tipoff_time_et ?? null,
          homeSpread: vegasHomeSpread,
          homeSpreadDiff,
          spreadAccuracy: spreadAcc,
          homeWinProb,
          awayWinProb,
          mlPickIsHome,
          mlPickProbRounded: mlBucketKey,
          mlAccuracy: mlAcc,
          overLine: vegasTotal,
          overLineDiff,
          ouAccuracy: ouAcc,
        };
      });

      setGames(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedGames = sortGames(games, sortMode);

  return {
    games: sortedGames,
    isLoading,
    error,
    sortMode,
    setSortMode,
    refetch: fetchData,
  };
}
