import { useState, useEffect, useCallback } from 'react';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import {
  MLBSituationalTrendRow,
  MLBGameTrendsData,
  MLBTrendsSortMode,
  toTrendPct,
} from '@/types/mlbBettingTrends';

interface UseMLBBettingTrendsResult {
  games: MLBGameTrendsData[];
  isLoading: boolean;
  error: string | null;
  sortMode: MLBTrendsSortMode;
  setSortMode: (mode: MLBTrendsSortMode) => void;
  refetch: () => Promise<void>;
}

const MIN_DIFF = 10;

/**
 * Calculate O/U Consensus Strength score for a game.
 * Matches web app logic: sums pcts when both teams agree on direction.
 */
function calculateOUConsensusStrength(game: MLBGameTrendsData): number {
  const pairs = overPctPairs(game);
  let total = 0;
  for (const [a, h] of pairs) {
    if (a !== null && h !== null && a > 55 && h > 55) {
      total += a + h;
    }
    if (a !== null && h !== null && a < 45 && h < 45) {
      total += 200 - a - h;
    }
  }
  return total;
}

/**
 * Calculate ML Dominance score for a game.
 * Matches web app logic: sums differences when gap >= MIN_DIFF.
 */
function calculateMLDominance(game: MLBGameTrendsData): number {
  const pairs = winPctPairs(game);
  let total = 0;
  for (const [a, h] of pairs) {
    if (a !== null && h !== null && Math.abs(a - h) >= MIN_DIFF) {
      total += Math.abs(a - h);
    }
  }
  return total;
}

function winPctPairs(game: MLBGameTrendsData): [number | null, number | null][] {
  return [
    [toTrendPct(game.awayTeam.win_pct_last_game), toTrendPct(game.homeTeam.win_pct_last_game)],
    [toTrendPct(game.awayTeam.win_pct_home_away), toTrendPct(game.homeTeam.win_pct_home_away)],
    [toTrendPct(game.awayTeam.win_pct_fav_dog), toTrendPct(game.homeTeam.win_pct_fav_dog)],
    [toTrendPct(game.awayTeam.win_pct_rest_bucket), toTrendPct(game.homeTeam.win_pct_rest_bucket)],
    [toTrendPct(game.awayTeam.win_pct_rest_comp), toTrendPct(game.homeTeam.win_pct_rest_comp)],
    [toTrendPct(game.awayTeam.win_pct_league), toTrendPct(game.homeTeam.win_pct_league)],
    [toTrendPct(game.awayTeam.win_pct_division), toTrendPct(game.homeTeam.win_pct_division)],
  ];
}

function overPctPairs(game: MLBGameTrendsData): [number | null, number | null][] {
  return [
    [toTrendPct(game.awayTeam.over_pct_last_game), toTrendPct(game.homeTeam.over_pct_last_game)],
    [toTrendPct(game.awayTeam.over_pct_home_away), toTrendPct(game.homeTeam.over_pct_home_away)],
    [toTrendPct(game.awayTeam.over_pct_fav_dog), toTrendPct(game.homeTeam.over_pct_fav_dog)],
    [toTrendPct(game.awayTeam.over_pct_rest_bucket), toTrendPct(game.homeTeam.over_pct_rest_bucket)],
    [toTrendPct(game.awayTeam.over_pct_rest_comp), toTrendPct(game.homeTeam.over_pct_rest_comp)],
    [toTrendPct(game.awayTeam.over_pct_league), toTrendPct(game.homeTeam.over_pct_league)],
    [toTrendPct(game.awayTeam.over_pct_division), toTrendPct(game.homeTeam.over_pct_division)],
  ];
}

/**
 * Sort games based on sort mode
 */
function sortGames(games: MLBGameTrendsData[], sortMode: MLBTrendsSortMode): MLBGameTrendsData[] {
  return [...games].sort((a, b) => {
    if (sortMode === 'ou-consensus') {
      return (b.ouConsensusScore || 0) - (a.ouConsensusScore || 0);
    } else if (sortMode === 'ml-dominance') {
      return (b.mlDominanceScore || 0) - (a.mlDominanceScore || 0);
    } else {
      // Sort by time
      if (a.gameTimeEt && b.gameTimeEt) {
        return new Date(a.gameTimeEt).getTime() - new Date(b.gameTimeEt).getTime();
      }
      if (a.gameTimeEt && !b.gameTimeEt) return -1;
      if (!a.gameTimeEt && b.gameTimeEt) return 1;
      return String(a.gameDateEt).localeCompare(String(b.gameDateEt));
    }
  });
}

/**
 * Hook to fetch and process MLB betting trends for today's games.
 * Uses mlb_situational_trends_today with fallback to mlb_situational_trends.
 */
export function useMLBBettingTrends(): UseMLBBettingTrendsResult {
  const [games, setGames] = useState<MLBGameTrendsData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<MLBTrendsSortMode>('time');

  const fetchTrends = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching MLB situational trends data...');

      // Fetch from mlb_situational_trends_today table
      let { data: trendsData, error: trendsError } = await collegeFootballSupabase
        .from('mlb_situational_trends_today')
        .select('*')
        .order('game_date_et', { ascending: true })
        .order('game_pk', { ascending: true });

      // Fallback to regular table if today's table fails or is empty
      if (trendsError || !trendsData || trendsData.length === 0) {
        console.log('Falling back to mlb_situational_trends table');
        const fallback = await collegeFootballSupabase
          .from('mlb_situational_trends')
          .select('*')
          .order('game_date_et', { ascending: true })
          .order('game_pk', { ascending: true });

        if (fallback.error) {
          throw fallback.error;
        }
        trendsData = fallback.data;
      }

      if (!trendsData || trendsData.length === 0) {
        console.log('No MLB trends data found');
        setGames([]);
        setIsLoading(false);
        return;
      }

      console.log(`Fetched ${trendsData.length} MLB trend rows`);

      // Group by game_pk using team_side to determine away/home
      const gamesMap = new Map<number, Partial<MLBGameTrendsData>>();

      (trendsData as MLBSituationalTrendRow[]).forEach((row) => {
        const pk = Number(row.game_pk);
        if (Number.isNaN(pk)) return;
        if (row.team_side !== 'away' && row.team_side !== 'home') return;

        if (!gamesMap.has(pk)) {
          gamesMap.set(pk, {
            gamePk: pk,
            gameDateEt: row.game_date_et,
            gameTimeEt: null,
            awayTeam: row.team_side === 'away' ? row : undefined,
            homeTeam: row.team_side === 'home' ? row : undefined,
          });
        } else {
          const game = gamesMap.get(pk)!;
          if (row.team_side === 'away') game.awayTeam = row;
          if (row.team_side === 'home') game.homeTeam = row;
        }
      });

      // Filter to only games with both teams
      const gamesArray: MLBGameTrendsData[] = [];
      gamesMap.forEach((game) => {
        if (
          game.awayTeam && game.awayTeam.team_name && game.awayTeam.team_side === 'away' &&
          game.homeTeam && game.homeTeam.team_name && game.homeTeam.team_side === 'home' &&
          game.gamePk !== undefined && game.gameDateEt
        ) {
          gamesArray.push(game as MLBGameTrendsData);
        }
      });

      console.log(`Processed ${gamesArray.length} complete MLB games`);

      // Fetch game times from mlb_games_today
      const pks = gamesArray.map(g => g.gamePk);
      if (pks.length > 0) {
        const { data: gameRows, error: timesError } = await collegeFootballSupabase
          .from('mlb_games_today')
          .select('game_pk, game_time_et')
          .in('game_pk', pks);

        if (!timesError && gameRows) {
          const timeByPk = new Map<number, string | null>();
          gameRows.forEach((r: any) => {
            const pk = Math.trunc(Number(r.game_pk));
            if (!Number.isNaN(pk)) {
              timeByPk.set(pk, r.game_time_et ?? null);
            }
          });
          gamesArray.forEach(game => {
            game.gameTimeEt = timeByPk.get(game.gamePk) ?? null;
          });
        } else if (timesError) {
          console.warn('Error fetching MLB game times:', timesError);
        }
      }

      // Calculate consensus scores for each game
      gamesArray.forEach(game => {
        game.ouConsensusScore = calculateOUConsensusStrength(game);
        game.mlDominanceScore = calculateMLDominance(game);
      });

      // Sort games
      const sortedGames = sortGames(gamesArray, sortMode);
      setGames(sortedGames);
    } catch (err) {
      console.error('Error fetching MLB betting trends:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch betting trends');
    } finally {
      setIsLoading(false);
    }
  }, [sortMode]);

  // Re-sort when sortMode changes
  useEffect(() => {
    if (games.length > 0) {
      setGames(sortGames(games, sortMode));
    }
  }, [sortMode]);

  useEffect(() => {
    fetchTrends();
  }, []);

  return {
    games,
    isLoading,
    error,
    sortMode,
    setSortMode,
    refetch: fetchTrends,
  };
}
