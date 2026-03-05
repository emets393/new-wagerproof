import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getForceAgentV2Only, setForceAgentV2Only } from '@/services/agentV2DebugSettings';

const AGENT_V2_DEBUG_QUERY_KEY = ['agent-v2-debug-settings'] as const;

export function useAgentV2DebugSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: AGENT_V2_DEBUG_QUERY_KEY,
    queryFn: getForceAgentV2Only,
    staleTime: Infinity,
    initialData: false,
  });

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await setForceAgentV2Only(enabled);
      return enabled;
    },
    onSuccess: (enabled) => {
      queryClient.setQueryData(AGENT_V2_DEBUG_QUERY_KEY, enabled);
    },
  });

  return {
    forceV2Only: !!query.data,
    isLoading: query.isLoading,
    isUpdating: mutation.isPending,
    setForceV2Only: mutation.mutateAsync,
  };
}
