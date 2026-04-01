import { useCallback } from 'react';
import { useProAccess } from '@/hooks/useProAccess';
import { useIsOffline } from '@/hooks/useNetworkState';

const FREE_AGENT_LIMIT = 1;
const FREE_LEADERBOARD_MIN_RANK = 6;
const FREE_LEADERBOARD_MAX_RANK = 10;
const PRO_MAX_ACTIVE_AGENTS = 10;
const PRO_MAX_TOTAL_AGENTS = 30;

export function useAgentEntitlements() {
  const { isPro, isAdmin, isLoading } = useProAccess();
  const isOffline = useIsOffline();

  const canCreateAnotherAgent = useCallback(
    (existingActiveAgentCount: number, existingTotalAgentCount: number = existingActiveAgentCount): boolean => {
      if (isAdmin) return true;
      if (isPro) {
        return existingTotalAgentCount < PRO_MAX_TOTAL_AGENTS;
      }
      return existingActiveAgentCount < FREE_AGENT_LIMIT;
    },
    [isPro, isAdmin]
  );

  const canViewAgentPicks = isPro || isAdmin;
  const canCreatePublicAgent = isPro || isAdmin;
  const canUseAutopilot = isPro || isAdmin;

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
    isOffline,
    // When offline and not pro, the lock may be due to network — UI should show
    // "offline" messaging instead of a paywall prompt
    isLockedDueToNetwork: isOffline && !isPro && !isAdmin,
    canViewAgentPicks,
    canCreatePublicAgent,
    canUseAutopilot,
    canCreateAnotherAgent,
    canViewLeaderboardRank,
    maxActiveAgents: isAdmin ? null : isPro ? PRO_MAX_ACTIVE_AGENTS : FREE_AGENT_LIMIT,
    maxTotalAgents: isAdmin ? null : isPro ? PRO_MAX_TOTAL_AGENTS : FREE_AGENT_LIMIT,
    freeAgentLimit: FREE_AGENT_LIMIT,
    proMaxActiveAgents: PRO_MAX_ACTIVE_AGENTS,
    proMaxTotalAgents: PRO_MAX_TOTAL_AGENTS,
    freeLeaderboardMinRank: FREE_LEADERBOARD_MIN_RANK,
    freeLeaderboardMaxRank: FREE_LEADERBOARD_MAX_RANK,
  };
}
