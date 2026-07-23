import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchPerformanceForAgents } from '@/services/agentPerformanceService';
import type { AgentPerformance, Sport } from '@/types/agent';

/** Followed agent enriched with profile + performance for the "Following" cards. */
export interface FollowedAgentDetailed {
  avatar_id: string;
  name: string;
  avatar_emoji: string;
  avatar_color: string;
  sprite_index: number | null;
  preferred_sports: Sport[];
  last_generated_at: string | null;
  is_favorite: boolean;
  notify_on_pick: boolean;
  performance: AgentPerformance | null;
}

interface FollowedAgentOptions {
  enabled?: boolean;
}

/**
 * Followed agents with profile + performance, favorited first.
 * Spectator-only — never generate/run these from the list.
 */
export function useFollowedAgentsDetailed(options?: FollowedAgentOptions) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['followed-agents', 'detailed', user?.id],
    queryFn: async (): Promise<FollowedAgentDetailed[]> => {
      if (!user?.id) return [];

      const { data, error } = await (supabase as any)
        .from('user_avatar_follows')
        .select(
          'avatar_id, is_favorite, notify_on_pick, avatar_profiles(name, avatar_emoji, avatar_color, sprite_index, preferred_sports, last_generated_at)',
        )
        .eq('user_id', user.id);

      if (error) throw error;

      const rows = (data || []).filter((r: any) => r.avatar_profiles);
      const ids = rows.map((r: any) => r.avatar_id);
      const perfMap = ids.length
        ? await fetchPerformanceForAgents(ids).catch(() => new Map<string, AgentPerformance>())
        : new Map<string, AgentPerformance>();

      const mapped: FollowedAgentDetailed[] = rows.map((row: any) => ({
        avatar_id: row.avatar_id,
        name: row.avatar_profiles?.name || 'Unknown',
        avatar_emoji: row.avatar_profiles?.avatar_emoji || '',
        avatar_color: row.avatar_profiles?.avatar_color || '#666666',
        sprite_index: row.avatar_profiles?.sprite_index ?? null,
        preferred_sports: (row.avatar_profiles?.preferred_sports as Sport[]) || [],
        last_generated_at: row.avatar_profiles?.last_generated_at ?? null,
        is_favorite: row.is_favorite ?? false,
        notify_on_pick: row.notify_on_pick ?? false,
        performance: perfMap.get(row.avatar_id) || null,
      }));

      mapped.sort((a, b) => {
        if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
        const au = a.performance?.net_units ?? -Infinity;
        const bu = b.performance?.net_units ?? -Infinity;
        if (au !== bu) return bu - au;
        return a.name.localeCompare(b.name);
      });

      return mapped;
    },
    enabled: !!user?.id && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/** Remove an agent from the caller's follow list. */
export function useUnfollowAgent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (avatarId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await (supabase as any)
        .from('user_avatar_follows')
        .delete()
        .eq('user_id', user.id)
        .eq('avatar_id', avatarId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followed-agents'] });
    },
  });
}

/** Toggle is_favorite on own follow row only (column-level UPDATE grant). */
export function useToggleFollowFavorite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ avatarId, isFavorite }: { avatarId: string; isFavorite: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await (supabase as any)
        .from('user_avatar_follows')
        .update({ is_favorite: isFavorite })
        .eq('user_id', user.id)
        .eq('avatar_id', avatarId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followed-agents'] });
    },
  });
}

/** Toggle notify_on_pick on own follow row only. */
export function useToggleFollowNotify() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ avatarId, notify }: { avatarId: string; notify: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await (supabase as any)
        .from('user_avatar_follows')
        .update({ notify_on_pick: notify })
        .eq('user_id', user.id)
        .eq('avatar_id', avatarId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followed-agents'] });
    },
  });
}
