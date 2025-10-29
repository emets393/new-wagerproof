import { useState, useEffect, useCallback } from 'react';
import { getLiveScores } from '@/services/liveScoresService';
import { LiveGame } from '@/types/liveScores';
import { useSettings } from '@/contexts/SettingsContext';

export function useLiveScores() {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { useDummyData } = useSettings();

  const fetchGames = useCallback(async () => {
    if (useDummyData) {
      // Skip fetching when using dummy data
      setIsLoading(false);
      return;
    }
    
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
  }, [useDummyData]);

  useEffect(() => {
    if (useDummyData) {
      // When using dummy data, just set loading to false
      setIsLoading(false);
      return;
    }

    fetchGames();

    // Refresh every 2 minutes
    const interval = setInterval(fetchGames, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchGames, useDummyData]);

  // When using dummy data, always return true for hasLiveGames
  const hasLiveGames = useDummyData ? true : games.length > 0;

  return {
    games,
    isLoading,
    error,
    hasLiveGames,
    refetch: fetchGames
  };
}

