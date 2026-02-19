import { useRevenueCatWeb } from '@/hooks/useRevenueCatWeb';
import { useIsAdmin } from '@/hooks/useIsAdmin';

const FREE_MAX_AGENTS = 1;
const PRO_MAX_ACTIVE_AGENTS = 10;
const PRO_MAX_TOTAL_AGENTS = 30;

export function useAgentEntitlements() {
  const { hasProAccess } = useRevenueCatWeb();
  const { isAdmin } = useIsAdmin();

  const isPro = hasProAccess || isAdmin;

  const canCreateAnotherAgent = (activeCount: number, totalCount: number): boolean => {
    if (isAdmin) {
      return true;
    }
    if (isPro) {
      return activeCount < PRO_MAX_ACTIVE_AGENTS && totalCount < PRO_MAX_TOTAL_AGENTS;
    }
    return activeCount < FREE_MAX_AGENTS;
  };

  return {
    isPro,
    isAdmin,
    maxActiveAgents: isAdmin ? null : isPro ? PRO_MAX_ACTIVE_AGENTS : FREE_MAX_AGENTS,
    maxTotalAgents: isAdmin ? null : isPro ? PRO_MAX_TOTAL_AGENTS : FREE_MAX_AGENTS,
    canCreateAnotherAgent,
  };
}
