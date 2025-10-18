import { useQuery } from "@tanstack/react-query";
import { getLiveScores, refreshLiveScores, checkIfRefreshNeeded } from "@/services/liveScoresService";
import { useEffect, useRef } from "react";

export function useLiveScores() {
  const hasTriggeredRefresh = useRef(false);
  
  // Query for live scores from cache
  const { data: games = [], isLoading, refetch } = useQuery({
    queryKey: ['live-scores'],
    queryFn: getLiveScores,
    refetchInterval: (query) => {
      // Only refetch every 2 minutes if there are live games
      const hasLiveGames = query.state.data && query.state.data.length > 0;
      return hasLiveGames ? 2 * 60 * 1000 : false; // 2 minutes or no refetch
    },
    staleTime: 1 * 60 * 1000, // Consider data stale after 1 minute
  });
  
  // Trigger initial refresh if needed (only once per mount)
  useEffect(() => {
    if (!hasTriggeredRefresh.current) {
      hasTriggeredRefresh.current = true;
      
      checkIfRefreshNeeded().then((needsRefresh) => {
        if (needsRefresh) {
          console.log('Triggering live scores refresh...');
          refreshLiveScores().then((result) => {
            console.log('Live scores refresh result:', result);
            // Refetch from cache after refresh
            refetch();
          });
        }
      });
    }
  }, [refetch]);
  
  const hasLiveGames = games.length > 0;
  
  return {
    games,
    isLoading,
    hasLiveGames,
    refetch
  };
}

