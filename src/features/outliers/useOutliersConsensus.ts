import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { fetchGameAgentConsensus, type GameAgentConsensus } from '@/services/agentConsensusService';
import type { GamesSport } from '@/features/games/types';

/**
 * Agent consensus for the Outliers "Today's Matchups" grid.
 *
 * The /games feed hook is single-sport; this grid mixes MLB + NFL + NCAAF in
 * one wall of tiles, so it fans out one query per sport and merges the results
 * under a `${sport}:${gameId}` key — the same key the tiles already use, since
 * game ids are only unique within a sport.
 *
 * See .claude/docs/18_agent_consensus.md.
 */

export interface ConsensusRequestItem {
  /**
   * Caller's own key, echoed back as the result-map key. Tiles key on the
   * OUTLIERS slug (`ncaaf:123`) while the RPC speaks the /games vocabulary
   * (`cfb`), so the two can't be derived from one another — the caller supplies
   * the key it wants to look up by.
   */
  key: string;
  /** Sport in the /games vocabulary (cfb, not ncaaf) — what the RPC expects. */
  sport: GamesSport;
  gameId: string;
  gameDate: string;
}

const STALE_TIME = 90 * 1000;

export function useOutliersConsensus(
  items: ConsensusRequestItem[],
): Map<string, GameAgentConsensus> {
  // Collapse to one (sport, sorted dates) request per sport so the query keys
  // stay stable while tiles paginate or re-sort.
  const bySport = useMemo(() => {
    const map = new Map<GamesSport, Set<string>>();
    for (const it of items) {
      if (!it.gameDate) continue;
      if (!map.has(it.sport)) map.set(it.sport, new Set());
      map.get(it.sport)!.add(it.gameDate);
    }
    return [...map.entries()]
      .map(([sport, dates]) => ({ sport, dates: [...dates].sort() }))
      .sort((a, b) => a.sport.localeCompare(b.sport));
  }, [items]);

  const results = useQueries({
    queries: bySport.map(({ sport, dates }) => ({
      queryKey: ['agent-consensus', sport, dates],
      staleTime: STALE_TIME,
      queryFn: () => fetchGameAgentConsensus(sport, dates),
    })),
  });

  return useMemo(() => {
    // sport -> (gameId -> consensus), then re-key by each item's own key.
    const bySportData = new Map<GamesSport, Map<string, GameAgentConsensus>>();
    results.forEach((res, i) => {
      const sport = bySport[i]?.sport;
      if (sport && res.data) bySportData.set(sport, res.data);
    });

    const merged = new Map<string, GameAgentConsensus>();
    for (const it of items) {
      const hit = bySportData.get(it.sport)?.get(it.gameId);
      if (hit) merged.set(it.key, hit);
    }
    return merged;
    // `results` is a new array each render; the data references inside it are
    // stable, so key off those rather than the wrapper.
  }, [items, bySport, ...results.map((r) => r.data)]);
}
