import { useState, useEffect, useCallback } from 'react';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import {
  SituationalTrendRow,
  NBAGameTrendsData,
  TrendsSortMode,
  parseRecord,
} from '@/types/nbaBettingTrends';

interface UseNBABettingTrendsResult {
  games: NBAGameTrendsData[];
  isLoading: boolean;
  error: string | null;
  sortMode: TrendsSortMode;
  setSortMode: (mode: TrendsSortMode) => void;
  refetch: () => Promise<void>;
}

const MIN_GAMES_THRESHOLD = 5;
const MIN_PERCENTAGE = 55;
const MIN_ATS_DIFFERENCE = 10;

/**
 * Calculate Over/Under Consensus Strength score for a game
 */
function calculateOUConsensusStrength(game: NBAGameTrendsData): number {
  let totalScore = 0;

  const situations = [
    {
      awayOverPct: game.awayTeam.ou_last_game_over_pct,
      awayUnderPct: game.awayTeam.ou_last_game_under_pct,
      awayRecord: game.awayTeam.ou_last_game_record,
      homeOverPct: game.homeTeam.ou_last_game_over_pct,
      homeUnderPct: game.homeTeam.ou_last_game_under_pct,
      homeRecord: game.homeTeam.ou_last_game_record,
    },
    {
      awayOverPct: game.awayTeam.ou_fav_dog_over_pct,
      awayUnderPct: game.awayTeam.ou_fav_dog_under_pct,
      awayRecord: game.awayTeam.ou_fav_dog_record,
      homeOverPct: game.homeTeam.ou_fav_dog_over_pct,
      homeUnderPct: game.homeTeam.ou_fav_dog_under_pct,
      homeRecord: game.homeTeam.ou_fav_dog_record,
    },
    {
      awayOverPct: game.awayTeam.ou_side_fav_dog_over_pct,
      awayUnderPct: game.awayTeam.ou_side_fav_dog_under_pct,
      awayRecord: game.awayTeam.ou_side_fav_dog_record,
      homeOverPct: game.homeTeam.ou_side_fav_dog_over_pct,
      homeUnderPct: game.homeTeam.ou_side_fav_dog_under_pct,
      homeRecord: game.homeTeam.ou_side_fav_dog_record,
    },
    {
      awayOverPct: game.awayTeam.ou_rest_bucket_over_pct,
      awayUnderPct: game.awayTeam.ou_rest_bucket_under_pct,
      awayRecord: game.awayTeam.ou_rest_bucket_record,
      homeOverPct: game.homeTeam.ou_rest_bucket_over_pct,
      homeUnderPct: game.homeTeam.ou_rest_bucket_under_pct,
      homeRecord: game.homeTeam.ou_rest_bucket_record,
    },
    {
      awayOverPct: game.awayTeam.ou_rest_comp_over_pct,
      awayUnderPct: game.awayTeam.ou_rest_comp_under_pct,
      awayRecord: game.awayTeam.ou_rest_comp_record,
      homeOverPct: game.homeTeam.ou_rest_comp_over_pct,
      homeUnderPct: game.homeTeam.ou_rest_comp_under_pct,
      homeRecord: game.homeTeam.ou_rest_comp_record,
    },
  ];

  situations.forEach(situation => {
    const bothFavorOver =
      situation.awayOverPct !== null && situation.awayOverPct > MIN_PERCENTAGE &&
      situation.homeOverPct !== null && situation.homeOverPct > MIN_PERCENTAGE;

    const bothFavorUnder =
      situation.awayUnderPct !== null && situation.awayUnderPct > MIN_PERCENTAGE &&
      situation.homeUnderPct !== null && situation.homeUnderPct > MIN_PERCENTAGE;

    if (bothFavorOver) {
      const awayGames = parseRecord(situation.awayRecord).total;
      const homeGames = parseRecord(situation.homeRecord).total;

      if (awayGames >= MIN_GAMES_THRESHOLD && homeGames >= MIN_GAMES_THRESHOLD) {
        const totalGames = awayGames + homeGames;
        const avgPct = ((situation.awayOverPct || 0) * awayGames + (situation.homeOverPct || 0) * homeGames) / totalGames;
        const score = avgPct * Math.min(awayGames, homeGames);
        totalScore += score;
      }
    }

    if (bothFavorUnder) {
      const awayGames = parseRecord(situation.awayRecord).total;
      const homeGames = parseRecord(situation.homeRecord).total;

      if (awayGames >= MIN_GAMES_THRESHOLD && homeGames >= MIN_GAMES_THRESHOLD) {
        const totalGames = awayGames + homeGames;
        const avgPct = ((situation.awayUnderPct || 0) * awayGames + (situation.homeUnderPct || 0) * homeGames) / totalGames;
        const score = avgPct * Math.min(awayGames, homeGames);
        totalScore += score;
      }
    }
  });

  return totalScore;
}

/**
 * Calculate ATS Dominance score for a game
 */
function calculateATSDominance(game: NBAGameTrendsData): number {
  let totalScore = 0;

  const situations = [
    {
      awayPct: game.awayTeam.ats_last_game_cover_pct,
      awayRecord: game.awayTeam.ats_last_game_record,
      homePct: game.homeTeam.ats_last_game_cover_pct,
      homeRecord: game.homeTeam.ats_last_game_record,
    },
    {
      awayPct: game.awayTeam.ats_fav_dog_cover_pct,
      awayRecord: game.awayTeam.ats_fav_dog_record,
      homePct: game.homeTeam.ats_fav_dog_cover_pct,
      homeRecord: game.homeTeam.ats_fav_dog_record,
    },
    {
      awayPct: game.awayTeam.ats_side_fav_dog_cover_pct,
      awayRecord: game.awayTeam.ats_side_fav_dog_record,
      homePct: game.homeTeam.ats_side_fav_dog_cover_pct,
      homeRecord: game.homeTeam.ats_side_fav_dog_record,
    },
    {
      awayPct: game.awayTeam.ats_rest_bucket_cover_pct,
      awayRecord: game.awayTeam.ats_rest_bucket_record,
      homePct: game.homeTeam.ats_rest_bucket_cover_pct,
      homeRecord: game.homeTeam.ats_rest_bucket_record,
    },
    {
      awayPct: game.awayTeam.ats_rest_comp_cover_pct,
      awayRecord: game.awayTeam.ats_rest_comp_record,
      homePct: game.homeTeam.ats_rest_comp_cover_pct,
      homeRecord: game.homeTeam.ats_rest_comp_record,
    },
  ];

  situations.forEach(situation => {
    if (situation.awayPct !== null && situation.homePct !== null) {
      const awayGames = parseRecord(situation.awayRecord).total;
      const homeGames = parseRecord(situation.homeRecord).total;
      const minGames = Math.min(awayGames, homeGames);

      if (minGames >= MIN_GAMES_THRESHOLD) {
        const difference = Math.abs(situation.awayPct - situation.homePct);

        if (difference > MIN_ATS_DIFFERENCE) {
          const score = difference * minGames;
          totalScore += score;
        }
      }
    }
  });

  return totalScore;
}

/**
 * Sort games based on sort mode
 */
function sortGames(games: NBAGameTrendsData[], sortMode: TrendsSortMode): NBAGameTrendsData[] {
  return [...games].sort((a, b) => {
    if (sortMode === 'ou-consensus') {
      return (b.ouConsensusScore || 0) - (a.ouConsensusScore || 0);
    } else if (sortMode === 'ats-dominance') {
      return (b.atsDominanceScore || 0) - (a.atsDominanceScore || 0);
    } else {
      // Sort by time
      if (a.tipoffTime && b.tipoffTime) {
        return a.tipoffTime.localeCompare(b.tipoffTime);
      }
      if (a.tipoffTime && !b.tipoffTime) return -1;
      if (!a.tipoffTime && b.tipoffTime) return 1;
      return new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime();
    }
  });
}

/**
 * Hook to fetch and process NBA betting trends for today's games
 */
export function useNBABettingTrends(): UseNBABettingTrendsResult {
  const [games, setGames] = useState<NBAGameTrendsData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<TrendsSortMode>('time');

  const fetchTrends = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching NBA situational trends data...');

      // Fetch from nba_game_situational_trends_today table
      let { data: trendsData, error: trendsError } = await collegeFootballSupabase
        .from('nba_game_situational_trends_today')
        .select('*')
        .order('game_date', { ascending: true })
        .order('game_id', { ascending: true });

      // Fallback to regular table if today's table fails or is empty
      if (trendsError || !trendsData || trendsData.length === 0) {
        console.log('Falling back to nba_game_situational_trends table');
        const fallback = await collegeFootballSupabase
          .from('nba_game_situational_trends')
          .select('*')
          .order('game_date', { ascending: true })
          .order('game_id', { ascending: true });

        if (fallback.error) {
          throw fallback.error;
        }
        trendsData = fallback.data;
      }

      if (!trendsData || trendsData.length === 0) {
        console.log('No trends data found');
        setGames([]);
        setIsLoading(false);
        return;
      }

      console.log(`Fetched ${trendsData.length} trend rows`);

      // Group by game_id using team_side to determine away/home
      const gamesMap = new Map<number, Partial<NBAGameTrendsData>>();

      trendsData.forEach((row: SituationalTrendRow) => {
        if (row.team_side !== 'away' && row.team_side !== 'home') {
          console.warn(`Invalid team_side: ${row.team_side} for game ${row.game_id}`);
          return;
        }

        if (!gamesMap.has(row.game_id)) {
          gamesMap.set(row.game_id, {
            gameId: row.game_id,
            gameDate: row.game_date,
            tipoffTime: null,
            awayTeam: row.team_side === 'away' ? row : undefined,
            homeTeam: row.team_side === 'home' ? row : undefined,
          });
        } else {
          const game = gamesMap.get(row.game_id)!;
          if (row.team_side === 'away') {
            game.awayTeam = row;
          } else if (row.team_side === 'home') {
            game.homeTeam = row;
          }
        }
      });

      // Filter to only games with both teams
      const gamesArray: NBAGameTrendsData[] = [];
      gamesMap.forEach((game) => {
        if (game.awayTeam && game.homeTeam && game.gameId !== undefined && game.gameDate) {
          gamesArray.push(game as NBAGameTrendsData);
        }
      });

      console.log(`Processed ${gamesArray.length} complete games`);

      // Fetch tipoff times from nba_input_values_view
      const gameIds = gamesArray.map(g => g.gameId);
      if (gameIds.length > 0) {
        const { data: gameTimes, error: timesError } = await collegeFootballSupabase
          .from('nba_input_values_view')
          .select('game_id, tipoff_time_et')
          .in('game_id', gameIds);

        if (!timesError && gameTimes) {
          const timesMap = new Map<number, string | null>();
          gameTimes.forEach((gt: any) => {
            timesMap.set(gt.game_id, gt.tipoff_time_et);
          });

          gamesArray.forEach(game => {
            game.tipoffTime = timesMap.get(game.gameId) || null;
          });
        } else if (timesError) {
          console.warn('Error fetching tipoff times:', timesError);
        }
      }

      // Calculate consensus scores for each game
      gamesArray.forEach(game => {
        game.ouConsensusScore = calculateOUConsensusStrength(game);
        game.atsDominanceScore = calculateATSDominance(game);
      });

      // Sort games
      const sortedGames = sortGames(gamesArray, sortMode);

      setGames(sortedGames);
    } catch (err) {
      console.error('Error fetching NBA betting trends:', err);
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
