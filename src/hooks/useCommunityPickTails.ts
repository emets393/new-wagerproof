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

      // Fetch display names from profiles table
      // Note: We can't fetch emails from auth.users via REST API (it's a system table)
      // UserCircle component will work fine with just display_name - it uses first letter for avatar
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      if (profilesError) {
        debug.log('Could not fetch profiles:', profilesError);
        // Fallback - just user IDs
        const users: TailingUser[] = userIds.map(userId => ({
          user_id: userId,
          display_name: undefined,
          email: undefined,
        }));
        setTailingUsers(users);
        return;
      }

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      // Create users array with display names (no email available via REST API)
      const users: TailingUser[] = userIds.map(userId => ({
        user_id: userId,
        display_name: profileMap.get(userId),
        email: undefined, // Email not available via REST API
      }));

      setTailingUsers(users);
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

