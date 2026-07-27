import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchGameAgentConsensus, type GameAgentConsensus } from '@/services/agentConsensusService';
import type { GameFeedItem, GamesSport } from '../types';

// Shorter than the 5-minute feed TTL: counts move through the day as agents
// generate (observed ~1 new pick/minute on a busy MLB slate), while the slate
// itself does not.
const STALE_TIME = 90 * 1000;

// Module-level so the identity is stable across renders and components — a
// per-render `new Map()` would allocate on every pass and break memo equality
// for any consumer that depends on the returned map.
const EMPTY = new Map<string, GameAgentConsensus>();

/**
 * Agent consensus for every game in the current feed, keyed by game id.
 *
 * Deliberately NOT fetched inside the per-sport adapters: the flag threshold
 * scales with the whole slate's volume, so it can only be computed once the
 * full set of games for a date is known. One RPC serves the entire feed.
 */
export function useAgentConsensus(
  sport: GamesSport,
  games: GameFeedItem[],
): Map<string, GameAgentConsensus> {
  // Distinct game dates present in the feed, sorted so the query key is stable
  // across refetches that return the same slate in a different order.
  const dates = React.useMemo(() => {
    const set = new Set<string>();
    for (const g of games) {
      if (g.gameDate) set.add(g.gameDate);
    }
    return [...set].sort();
  }, [games]);

  const { data } = useQuery({
    queryKey: ['agent-consensus', sport, dates],
    staleTime: STALE_TIME,
    enabled: dates.length > 0,
    queryFn: () => fetchGameAgentConsensus(sport, dates),
  });

  return data ?? EMPTY;
}
