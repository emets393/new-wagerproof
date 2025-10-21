import { useState, useEffect, useCallback } from 'react';
import { getLiveScores } from '@/services/liveScoresService';
import { LiveGame } from '@/types/liveScores';

export function useLiveScores() {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGames = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const liveGames = await getLiveScores();
      setGames(liveGames);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch live scores'));
      console.error('Error fetching live scores:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();

    // Refresh every 2 minutes
    const interval = setInterval(fetchGames, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchGames]);

  const hasLiveGames = games.length > 0;

  return {
    games,
    isLoading,
    error,
    hasLiveGames,
    refetch: fetchGames
  };
}

