import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { fetchPerformanceForAgents } from '@/services/agentPerformanceService';
import type { AgentPerformance, Sport } from '@/types/agent';

export interface FollowedAgent {
  avatar_id: string;
  name: string;
  avatar_emoji: string;
  avatar_color: string;
  is_favorite: boolean;
}

/** Followed agent enriched with profile + performance for the "Following" cards. */
export interface FollowedAgentDetailed {
  avatar_id: string;
  name: string;
  avatar_emoji: string;
  avatar_color: string;
  preferred_sports: Sport[];
  is_favorite: boolean;
  notify_on_pick: boolean;
  performance: AgentPerformance | null;
}

interface FollowedAgentOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch agents the current user follows, with basic profile info.
 */
export function useFollowedAgents(options?: FollowedAgentOptions) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['followed-agents', user?.id],
    queryFn: async (): Promise<FollowedAgent[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('user_avatar_follows')
        .select('avatar_id, is_favorite, avatar_profiles(name, avatar_emoji, avatar_color)')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching followed agents:', error);
        throw error;
      }

      return (data || []).map((row: any) => ({
        avatar_id: row.avatar_id,
        name: row.avatar_profiles?.name || 'Unknown',
        avatar_emoji: row.avatar_profiles?.avatar_emoji || '',
        avatar_color: row.avatar_profiles?.avatar_color || '#666666',
        is_favorite: row.is_favorite ?? false,
      }));
    },
    enabled: !!user?.id && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch followed agents with full profile + performance, sorted with
 * favorited follows first (then by net units, then name). Powers the "Following"
 * section on My Agents. Followed agents are SPECTATOR-ONLY (no generate/run).
 */
export function useFollowedAgentsDetailed(options?: FollowedAgentOptions) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['followed-agents', 'detailed', user?.id],
    queryFn: async (): Promise<FollowedAgentDetailed[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('user_avatar_follows')
        .select(
          'avatar_id, is_favorite, notify_on_pick, avatar_profiles(name, avatar_emoji, avatar_color, preferred_sports)',
        )
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching followed agents (detailed):', error);
        throw error;
      }

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
        preferred_sports: (row.avatar_profiles?.preferred_sports as Sport[]) || [],
        is_favorite: row.is_favorite ?? false,
        notify_on_pick: row.notify_on_pick ?? false,
        performance: perfMap.get(row.avatar_id) || null,
      }));

      // Favorited follows first, then best net units, then name.
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

/**
 * Toggle a follow's `is_favorite` flag (own row only). Column-level UPDATE grant
 * allows only is_favorite / notify_on_pick — never identity columns.
 */
export function useToggleFollowFavorite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ avatarId, isFavorite }: { avatarId: string; isFavorite: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('user_avatar_follows')
        .update({ is_favorite: isFavorite })
        .eq('user_id', user.id)
        .eq('avatar_id', avatarId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followed-agents'] });
      queryClient.invalidateQueries({ queryKey: ['favorite-agent-ids'] });
    },
  });
}

/** Toggle a follow's `notify_on_pick` flag (own row only). */
export function useToggleFollowNotify() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ avatarId, notify }: { avatarId: string; notify: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
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

/**
 * Hook to get favorite agent IDs (own widget favorites + followed favorites).
 */
export function useFavoriteAgentIds(options?: FollowedAgentOptions) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['favorite-agent-ids', user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!user?.id) return [];

      // Fetch own agents that are widget favorites
      const ownPromise = supabase
        .from('avatar_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_widget_favorite', true);

      // Fetch followed agents that are favorited
      const followedPromise = supabase
        .from('user_avatar_follows')
        .select('avatar_id')
        .eq('user_id', user.id)
        .eq('is_favorite', true);

      const [ownResult, followedResult] = await Promise.all([ownPromise, followedPromise]);

      if (ownResult.error) {
        console.error('Error fetching own favorite agents:', ownResult.error);
      }
      if (followedResult.error) {
        console.error('Error fetching followed favorite agents:', followedResult.error);
      }

      const ownIds = (ownResult.data || []).map((r: any) => r.id);
      const followedIds = (followedResult.data || []).map((r: any) => r.avatar_id);

      return [...new Set([...ownIds, ...followedIds])];
    },
    enabled: !!user?.id && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}
