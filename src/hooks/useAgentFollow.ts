import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Follow state + toggle for a public agent. Wraps the inline
 * user_avatar_follows calls previously embedded in PublicAgentDetail.
 */
export function useAgentFollow(agentId: string | undefined, options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const enabled = (options?.enabled ?? true) && !!user?.id && !!agentId;
  const queryKey = ['agents', 'follow', user?.id, agentId];

  const { data: isFollowing = false, isLoading } = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('user_avatar_follows')
        .select('id')
        .eq('user_id', user!.id)
        .eq('avatar_id', agentId!)
        .maybeSingle();
      return !!data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !agentId) return isFollowing;
      if (isFollowing) {
        await (supabase as any)
          .from('user_avatar_follows')
          .delete()
          .eq('user_id', user.id)
          .eq('avatar_id', agentId);
        return false;
      }
      await (supabase as any)
        .from('user_avatar_follows')
        .insert({ user_id: user.id, avatar_id: agentId });
      return true;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next);
    },
    // Follow is non-critical — legacy behavior swallowed errors silently.
    onError: () => {},
  });

  return {
    isFollowing,
    isLoading,
    toggleFollow: () => toggleMutation.mutate(),
    togglePending: toggleMutation.isPending,
  };
}
