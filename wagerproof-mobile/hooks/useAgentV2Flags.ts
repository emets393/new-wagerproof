import { useQuery } from '@tanstack/react-query';
import { fetchAgentV2Flags, defaultAgentV2Flags } from '@/services/agentV2Flags';

export function useAgentV2Flags() {
  return useQuery({
    queryKey: ['agent-v2-flags'],
    queryFn: fetchAgentV2Flags,
    staleTime: 60 * 1000,
    initialData: defaultAgentV2Flags,
  });
}
