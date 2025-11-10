import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TailingUser } from '@/types/game-tails';
import debug from '@/utils/debug';

export function useCommunityPickTails(pickId: string | null) {
  const [tailingUsers, setTailingUsers] = useState<TailingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPickTails = useCallback(async () => {
    if (!pickId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch upvotes for this pick
      const { data: votes, error: votesError } = await supabase
        .from('community_pick_votes')
        .select('user_id')
        .eq('pick_id', pickId)
        .eq('vote_type', 'upvote');

      if (votesError) {
        debug.error('Error fetching pick votes:', votesError);
        setError(votesError.message);
        return;
      }

      if (!votes || votes.length === 0) {
        setTailingUsers([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(votes.map(v => v.user_id))];

      // Fetch emails directly from auth.users using a direct query
      const { data: authData, error: authError } = await supabase
        .from('auth.users')
        .select('id, email')
        .in('id', userIds);

      if (authError) {
        debug.log('Could not fetch from auth.users, trying alternative:', authError);
        
        // Try to fetch user profiles (if table exists)
        try {
          const { data: profiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('user_id, display_name, email')
            .in('user_id', userIds);

          if (!profilesError && profiles) {
            const users: TailingUser[] = profiles.map(p => ({
              user_id: p.user_id,
              display_name: p.display_name,
              email: p.email,
            }));
            setTailingUsers(users);
            return;
          }
        } catch (e) {
          debug.log('Error fetching user profiles:', e);
        }

        // Final fallback - just user IDs
        const users: TailingUser[] = userIds.map(userId => ({
          user_id: userId,
          display_name: undefined,
          email: undefined,
        }));
        setTailingUsers(users);
        return;
      }

      // Create email map from auth data
      const emailMap = new Map(authData?.map(u => [u.id, u.email]) || []);

      // Try to fetch display names from user_profiles
      try {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

        const users: TailingUser[] = userIds.map(userId => ({
          user_id: userId,
          display_name: profileMap.get(userId),
          email: emailMap.get(userId),
        }));

        setTailingUsers(users);
      } catch (e) {
        debug.log('Could not fetch profiles, using emails only:', e);
        // Use just emails
        const users: TailingUser[] = userIds.map(userId => ({
          user_id: userId,
          display_name: undefined,
          email: emailMap.get(userId),
        }));
        setTailingUsers(users);
      }
    } catch (err: any) {
      debug.error('Exception fetching pick tails:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pickId]);

  useEffect(() => {
    fetchPickTails();
  }, [fetchPickTails]);

  // Real-time subscription for vote changes
  useEffect(() => {
    if (!pickId) return;

    const channel = supabase
      .channel(`pick_votes:${pickId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_pick_votes',
          filter: `pick_id=eq.${pickId}`,
        },
        () => {
          fetchPickTails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pickId, fetchPickTails]);

  return {
    tailingUsers,
    loading,
    error,
    refetch: fetchPickTails,
  };
}

