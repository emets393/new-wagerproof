import { useState, useEffect, useCallback } from 'react';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import {
  NCAABSituationalTrendRow,
  NCAABGameTrendsData,
  NCAABTrendsSortMode,
  parseNCAABRecord,
} from '@/types/ncaabBettingTrends';

interface UseNCAABBettingTrendsResult {
  games: NCAABGameTrendsData[];
  isLoading: boolean;
  error: string | null;
  sortMode: NCAABTrendsSortMode;
  setSortMode: (mode: NCAABTrendsSortMode) => void;
  refetch: () => Promise<void>;
}

const MIN_GAMES_THRESHOLD = 5;
const MIN_PERCENTAGE = 55;
const MIN_ATS_DIFFERENCE = 10;

/**
 * Calculate Over/Under Consensus Strength score for a game
 */
function calculateOUConsensusStrength(game: NCAABGameTrendsData): number {
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
      const awayGames = parseNCAABRecord(situation.awayRecord).total;
      const homeGames = parseNCAABRecord(situation.homeRecord).total;

      if (awayGames >= MIN_GAMES_THRESHOLD && homeGames >= MIN_GAMES_THRESHOLD) {
        const totalGames = awayGames + homeGames;
        const avgPct = ((situation.awayOverPct || 0) * awayGames + (situation.homeOverPct || 0) * homeGames) / totalGames;
        const score = avgPct * Math.min(awayGames, homeGames);
        totalScore += score;
      }
    }

    if (bothFavorUnder) {
      const awayGames = parseNCAABRecord(situation.awayRecord).total;
      const homeGames = parseNCAABRecord(situation.homeRecord).total;

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
function calculateATSDominance(game: NCAABGameTrendsData): number {
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
      const awayGames = parseNCAABRecord(situation.awayRecord).total;
      const homeGames = parseNCAABRecord(situation.homeRecord).total;
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
function sortGames(games: NCAABGameTrendsData[], sortMode: NCAABTrendsSortMode): NCAABGameTrendsData[] {
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
 * Hook to fetch and process NCAAB betting trends for today's games
 */
export function useNCAABBettingTrends(): UseNCAABBettingTrendsResult {
  const [games, setGames] = useState<NCAABGameTrendsData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<NCAABTrendsSortMode>('time');

  const fetchTrends = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching NCAAB situational trends data...');

      // Fetch from ncaab_game_situational_trends_today table
      let { data: trendsData, error: trendsError } = await collegeFootballSupabase
        .from('ncaab_game_situational_trends_today')
        .select('*')
        .order('game_date', { ascending: true })
        .order('game_id', { ascending: true });

      // Fallback to regular table if today's table fails or is empty
      if (trendsError || !trendsData || trendsData.length === 0) {
        console.log('Falling back to ncaab_game_situational_trends table');
        const fallback = await collegeFootballSupabase
          .from('ncaab_game_situational_trends')
          .select('*')
          .order('game_date', { ascending: true })
          .order('game_id', { ascending: true });

        if (fallback.error) {
          throw fallback.error;
        }
        trendsData = fallback.data;
      }

      if (!trendsData || trendsData.length === 0) {
        console.log('No NCAAB trends data found');
        setGames([]);
        setIsLoading(false);
        return;
      }

      console.log(`Fetched ${trendsData.length} NCAAB trend rows`);

      // Fetch team mappings for logos - generate ESPN logo URLs from team ID
      const { data: teamMappings, error: mappingError } = await collegeFootballSupabase
        .from('ncaab_team_mapping')
        .select('api_team_id');

      let teamLogoMap = new Map<number, string | null>();
      if (!mappingError && teamMappings) {
        teamMappings.forEach((mapping: any) => {
          // ESPN logo URL format: https://a.espncdn.com/i/teamlogos/ncaa/500/{teamId}.png
          const logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${mapping.api_team_id}.png`;
          teamLogoMap.set(mapping.api_team_id, logoUrl);
        });
        console.log(`NCAAB team logo mappings loaded: ${teamLogoMap.size}`);
      }

      // Group by game_id using team_side to determine away/home
      const gamesMap = new Map<number, Partial<NCAABGameTrendsData>>();

      trendsData.forEach((row: NCAABSituationalTrendRow) => {
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
            awayTeamLogo: row.team_side === 'away' ? teamLogoMap.get(row.team_id) || null : null,
            homeTeamLogo: row.team_side === 'home' ? teamLogoMap.get(row.team_id) || null : null,
          });
        } else {
          const game = gamesMap.get(row.game_id)!;
          if (row.team_side === 'away') {
            game.awayTeam = row;
            game.awayTeamLogo = teamLogoMap.get(row.team_id) || null;
          } else if (row.team_side === 'home') {
            game.homeTeam = row;
            game.homeTeamLogo = teamLogoMap.get(row.team_id) || null;
          }
        }
      });

      // Filter to only games with both teams
      const gamesArray: NCAABGameTrendsData[] = [];
      gamesMap.forEach((game) => {
        if (game.awayTeam && game.homeTeam && game.gameId !== undefined && game.gameDate) {
          gamesArray.push(game as NCAABGameTrendsData);
        }
      });

      console.log(`Processed ${gamesArray.length} complete NCAAB games`);

      // Fetch tipoff times from v_cbb_input_values
      const gameIds = gamesArray.map(g => g.gameId);
      if (gameIds.length > 0) {
        const { data: gameTimes, error: timesError } = await collegeFootballSupabase
          .from('v_cbb_input_values')
          .select('game_id, start_utc, tipoff_time_et')
          .in('game_id', gameIds);

        if (!timesError && gameTimes) {
          const timesMap = new Map<number, string | null>();
          gameTimes.forEach((gt: any) => {
            timesMap.set(gt.game_id, gt.start_utc || gt.tipoff_time_et);
          });

          gamesArray.forEach(game => {
            game.tipoffTime = timesMap.get(game.gameId) || null;
          });
        } else if (timesError) {
          console.warn('Error fetching NCAAB tipoff times:', timesError);
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
      console.error('Error fetching NCAAB betting trends:', err);
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
