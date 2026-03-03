import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface FollowedAgent {
  avatar_id: string;
  name: string;
  avatar_emoji: string;
  avatar_color: string;
  is_favorite: boolean;
}

/**
 * Hook to fetch agents the current user follows, with basic profile info.
 */
export function useFollowedAgents() {
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
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get favorite agent IDs (own widget favorites + followed favorites).
 */
export function useFavoriteAgentIds() {
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
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}
