import { useQuery } from '@tanstack/react-query';
import { fetchPresetArchetypes } from '@/services/agentService';
import { PresetArchetype } from '@/types/agent';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const archetypeKeys = {
  all: ['archetypes'] as const,
  list: () => [...archetypeKeys.all, 'list'] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to fetch all preset archetype templates
 */
export function usePresetArchetypes() {
  return useQuery({
    queryKey: archetypeKeys.list(),
    queryFn: fetchPresetArchetypes,
    staleTime: 30 * 60 * 1000, // 30 minutes - archetypes rarely change
    gcTime: 60 * 60 * 1000, // 1 hour cache time (formerly cacheTime)
  });
}

/**
 * Hook to get a specific archetype by ID from the cached list
 */
export function useArchetypeById(archetypeId: string | null) {
  const { data: archetypes, ...rest } = usePresetArchetypes();

  const archetype = archetypeId
    ? archetypes?.find((a) => a.id === archetypeId) || null
    : null;

  return {
    archetype,
    archetypes,
    ...rest,
  };
}

/**
 * Hook to get archetypes filtered by recommended sports
 */
export function useArchetypesBySport(sport: string) {
  const { data: archetypes, ...rest } = usePresetArchetypes();

  const filteredArchetypes = archetypes?.filter(
    (a) => a.recommended_sports.includes(sport as any)
  ) || [];

  return {
    archetypes: filteredArchetypes,
    allArchetypes: archetypes,
    ...rest,
  };
}
