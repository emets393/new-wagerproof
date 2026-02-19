import { useCallback } from 'react';
import { useProAccess } from '@/hooks/useProAccess';

const FREE_AGENT_LIMIT = 1;
const FREE_LEADERBOARD_MIN_RANK = 6;
const FREE_LEADERBOARD_MAX_RANK = 10;
const PRO_MAX_ACTIVE_AGENTS = 10;
const PRO_MAX_TOTAL_AGENTS = 30;

export function useAgentEntitlements() {
  const { isPro, isAdmin, isLoading } = useProAccess();

  const canCreateAnotherAgent = useCallback(
    (existingActiveAgentCount: number, existingTotalAgentCount: number = existingActiveAgentCount): boolean => {
      if (isAdmin) return true;
      if (isPro) {
        return (
          existingActiveAgentCount < PRO_MAX_ACTIVE_AGENTS &&
          existingTotalAgentCount < PRO_MAX_TOTAL_AGENTS
        );
      }
      return existingActiveAgentCount < FREE_AGENT_LIMIT;
    },
    [isPro, isAdmin]
  );

  const canViewAgentPicks = isPro || isAdmin;
  const canCreatePublicAgent = isPro || isAdmin;

  const canViewLeaderboardRank = useCallback(
    (rank: number): boolean => {
      if (isPro || isAdmin) return true;
      return rank >= FREE_LEADERBOARD_MIN_RANK && rank <= FREE_LEADERBOARD_MAX_RANK;
    },
    [isPro, isAdmin]
  );

  return {
    isLoading,
    isPro,
    isAdmin,
    canViewAgentPicks,
    canCreatePublicAgent,
    canCreateAnotherAgent,
    canViewLeaderboardRank,
    freeAgentLimit: FREE_AGENT_LIMIT,
    proMaxActiveAgents: PRO_MAX_ACTIVE_AGENTS,
    proMaxTotalAgents: PRO_MAX_TOTAL_AGENTS,
    freeLeaderboardMinRank: FREE_LEADERBOARD_MIN_RANK,
    freeLeaderboardMaxRank: FREE_LEADERBOARD_MAX_RANK,
  };
}
