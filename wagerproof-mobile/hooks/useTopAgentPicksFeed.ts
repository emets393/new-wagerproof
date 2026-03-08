import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFollowedAgents, useFavoriteAgentIds } from './useFollowedAgents';
import { fetchTopAgentPicksFeedV2 } from '@/services/agentPicksService';
import { AgentPick } from '@/types/agent';
import { useAuth } from '@/contexts/AuthContext';

export type FeedFilter = 'top10' | 'following' | 'favorites';

export interface AgentMeta {
  avatar_id: string;
  name: string;
  avatar_emoji: string;
  avatar_color: string;
  wins: number;
  losses: number;
  pushes: number;
  net_units: number;
  rank: number | null; // leaderboard rank (1-indexed), null if not ranked
}

export interface FeedPickWithAgent extends AgentPick {
  agent: AgentMeta;
}

/**
 * Orchestrator hook for the Top Agent Picks feed.
 *
 * For "top10": fetches full leaderboard (100), cascades down rankings until
 * TARGET_PICK_COUNT picks are found. Sorted by rank descending (#1 first).
 */
export function useTopAgentPicksFeed(filter: FeedFilter) {
  const { user } = useAuth();

  // Only fetch supplementary data when needed — the RPC already returns agent metadata
  const { data: followedAgents } = useFollowedAgents({
    enabled: filter === 'following',
  });
  const { data: favoriteIds } = useFavoriteAgentIds({
    enabled: filter === 'favorites',
  });

  // Build rank + meta maps from followed agents (leaderboard metadata comes from RPC)
  const { rankMap, agentMetaMap } = useMemo(() => {
    const rMap = new Map<string, number>();
    const mMap = new Map<string, AgentMeta>();

    if (followedAgents) {
      followedAgents.forEach((agent) => {
        if (!mMap.has(agent.avatar_id)) {
          mMap.set(agent.avatar_id, {
            avatar_id: agent.avatar_id,
            name: agent.name,
            avatar_emoji: agent.avatar_emoji,
            avatar_color: agent.avatar_color,
            wins: 0,
            losses: 0,
            pushes: 0,
            net_units: 0,
            rank: null,
          });
        }
      });
    }

    return { rankMap: rMap, agentMetaMap: mMap };
  }, [followedAgents]);

  const queryDep = `v2-${filter}-${user?.id || 'anon'}`;

  // Query fetches RAW picks only (no meta attachment — that happens in useMemo below)
  const query = useQuery({
    queryKey: ['top-agent-picks-feed', queryDep],
    queryFn: async (): Promise<AgentPick[]> => {
      const rows = await fetchTopAgentPicksFeedV2(filter, user?.id);
      return rows as unknown as AgentPick[];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Enrich with agent meta + sort — always uses latest rankMap/metaMap
  const picks = useMemo((): FeedPickWithAgent[] => {
    const rawPicks = query.data;
    if (!rawPicks || rawPicks.length === 0) return [];

    const enriched: FeedPickWithAgent[] = rawPicks.map((pick) => ({
      ...pick,
      agent: agentMetaMap.get(pick.avatar_id) || {
        avatar_id: pick.avatar_id,
        name: (pick as any).agent_name || 'Unknown Agent',
        avatar_emoji: (pick as any).agent_avatar_emoji || '',
        avatar_color: (pick as any).agent_avatar_color || '#666666',
        wins: (pick as any).agent_wins || 0,
        losses: (pick as any).agent_losses || 0,
        pushes: (pick as any).agent_pushes || 0,
        net_units: Number((pick as any).agent_net_units || 0),
        rank: (pick as any).agent_rank ?? rankMap.get(pick.avatar_id) ?? null,
      },
    }));

    // For top10: sort by rank ascending (#1 first), then newest within same agent
    if (filter === 'top10') {
      enriched.sort((a, b) => {
        const rankA = a.agent.rank ?? 999;
        const rankB = b.agent.rank ?? 999;
        if (rankA !== rankB) return rankA - rankB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return enriched;
  }, [query.data, agentMetaMap, rankMap, filter]);

  return {
    picks,
    error: query.error,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    agentMetaMap,
  };
}
