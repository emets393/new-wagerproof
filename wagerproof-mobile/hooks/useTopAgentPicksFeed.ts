import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLeaderboard } from './useLeaderboard';
import { useFollowedAgents, useFavoriteAgentIds } from './useFollowedAgents';
import { fetchTopAgentPicksFeed, fetchTopAgentPicksFeedV2, enrichPicksWithOverlap } from '@/services/agentPicksService';
import { AgentPick } from '@/types/agent';
import { LeaderboardEntry } from '@/services/agentPerformanceService';
import { useAgentV2Flags } from '@/hooks/useAgentV2Flags';
import { useAuth } from '@/contexts/AuthContext';
import { trackAgentParity } from '@/services/agentPerformanceMetrics';
import { useAgentV2DebugSettings } from '@/hooks/useAgentV2DebugSettings';

export type FeedFilter = 'top10' | 'following' | 'favorites';

const TARGET_PICK_COUNT = 20;

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
  const { data: flags } = useAgentV2Flags();
  const { forceV2Only } = useAgentV2DebugSettings();
  const useV2 = forceV2Only || !!flags?.agents_v2_top_picks_enabled;
  const shadowCompare = !!flags?.agents_v2_shadow_compare_enabled;

  const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard(100, undefined, {
    enabled: !useV2 || filter === 'top10',
  });
  const { data: followedAgents, isLoading: followedLoading } = useFollowedAgents({
    enabled: filter === 'following' || (!useV2 && filter !== 'top10'),
  });
  const { data: favoriteIds, isLoading: favoritesLoading } = useFavoriteAgentIds({
    enabled: filter === 'favorites',
  });

  // Build rank + meta maps from the full leaderboard (stable via useMemo)
  const { rankMap, agentMetaMap } = useMemo(() => {
    const rMap = new Map<string, number>();
    const mMap = new Map<string, AgentMeta>();

    if (leaderboard) {
      leaderboard.forEach((entry: LeaderboardEntry, index: number) => {
        const rank = index + 1;
        rMap.set(entry.avatar_id, rank);
        mMap.set(entry.avatar_id, {
          avatar_id: entry.avatar_id,
          name: entry.name,
          avatar_emoji: entry.avatar_emoji,
          avatar_color: entry.avatar_color,
          wins: entry.wins,
          losses: entry.losses,
          pushes: entry.pushes,
          net_units: entry.net_units,
          rank,
        });
      });
    }

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
            rank: rMap.get(agent.avatar_id) ?? null,
          });
        }
      });
    }

    return { rankMap: rMap, agentMetaMap: mMap };
  }, [leaderboard, followedAgents]);

  // Determine loading / has-data
  let isResolvingIds = false;
  let queryDep: string = filter;

  if (filter === 'top10') {
    isResolvingIds = leaderboardLoading;
    queryDep = `top10-${leaderboard?.length ?? 0}`;
  } else if (filter === 'following') {
    isResolvingIds = followedLoading;
    queryDep = `following-${followedAgents?.map((a) => a.avatar_id).join(',') ?? ''}`;
  } else if (filter === 'favorites') {
    isResolvingIds = favoritesLoading;
    queryDep = `favorites-${favoriteIds?.join(',') ?? ''}`;
  }

  if (useV2) {
    queryDep = `v2-${filter}-${user?.id || 'anon'}-${forceV2Only ? 'force' : 'normal'}`;
    isResolvingIds = false;
  }

  const hasData = filter === 'top10'
    ? (leaderboard?.length ?? 0) > 0
    : filter === 'following'
    ? (followedAgents?.length ?? 0) > 0
    : (favoriteIds?.length ?? 0) > 0;

  const effectiveHasData = useV2 ? true : hasData;

  // Query fetches RAW picks only (no meta attachment — that happens in useMemo below)
  const query = useQuery({
    queryKey: ['top-agent-picks-feed', queryDep],
    queryFn: async (): Promise<AgentPick[]> => {
      if (useV2) {
        try {
          const rows = await fetchTopAgentPicksFeedV2(filter, user?.id);
          if (shadowCompare && filter === 'top10' && leaderboard?.length) {
            Promise.allSettled([
              fetchTop10Cascading(leaderboard || []),
              Promise.resolve(rows as unknown as AgentPick[]),
            ]).then(([legacyResult, v2Result]) => {
              if (legacyResult.status !== 'fulfilled' || v2Result.status !== 'fulfilled') return;
              if (legacyResult.value.length !== v2Result.value.length) {
                trackAgentParity('top_picks', 'row_count', {
                  legacy_count: legacyResult.value.length,
                  v2_count: v2Result.value.length,
                  filter,
                });
              }
            });
          }
          return rows as unknown as AgentPick[];
        } catch (err) {
          if (forceV2Only) throw err;
          // Fallback to legacy below
        }
      }

      let rawPicks: AgentPick[];

      if (filter === 'top10') {
        rawPicks = await fetchTop10Cascading(leaderboard || []);
      } else {
        const agentIds =
          filter === 'following'
            ? (followedAgents?.map((a) => a.avatar_id) || [])
            : (favoriteIds || []);

        if (agentIds.length === 0) return [];
        rawPicks = await fetchTopAgentPicksFeed(agentIds, 50);
      }

      return enrichPicksWithOverlap(rawPicks);
    },
    enabled: !isResolvingIds && effectiveHasData,
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
    isLoading: isResolvingIds || query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    agentMetaMap,
  };
}

/**
 * Start with top-10 agents. If they don't have enough picks,
 * expand the pool in batches of 10 until we hit the target or run out.
 * Returns raw picks (no meta attached yet).
 */
async function fetchTop10Cascading(
  leaderboard: LeaderboardEntry[],
): Promise<AgentPick[]> {
  if (leaderboard.length === 0) return [];

  const BATCH = 10;
  let currentBatch = 0;
  let allPicks: AgentPick[] = [];

  while (allPicks.length < TARGET_PICK_COUNT && currentBatch * BATCH < leaderboard.length) {
    const start = currentBatch * BATCH;
    const end = Math.min(start + BATCH, leaderboard.length);
    const batchIds = leaderboard.slice(start, end).map((e) => e.avatar_id);

    const picks = await fetchTopAgentPicksFeed(batchIds, 50);
    allPicks = allPicks.concat(picks);

    currentBatch++;

    if (currentBatch * BATCH >= 50 && allPicks.length === 0) break;
  }

  return allPicks.slice(0, TARGET_PICK_COUNT);
}
