import { useState, useEffect, useCallback, useRef } from 'react';
import { getLiveScores } from '@/services/liveScoresService';
import { LiveGame } from '@/types/liveScores';
import { useNetworkState } from '@/hooks/useNetworkState';

export function useLiveScores() {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { isConnected, isInternetReachable } = useNetworkState();
  const isOnline = isConnected && isInternetReachable !== false;

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
    // Only fetch and poll when online — don't hammer failed requests when offline
    if (!isOnline) return;

    fetchGames();

    // Refresh every 2 minutes while online
    const interval = setInterval(fetchGames, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchGames, isOnline]);

  const hasLiveGames = games.length > 0;

  return {
    games,
    isLoading,
    loading: isLoading, // Alias for compatibility
    error,
    hasLiveGames,
    refetch: fetchGames
  };
}
