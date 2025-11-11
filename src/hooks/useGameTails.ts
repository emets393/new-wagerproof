import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { GameTail, TailingUser } from '@/types/game-tails';
import debug from '@/utils/debug';

export function useGameTails(gameUniqueId: string | null) {
  const { user } = useAuth();
  const [tails, setTails] = useState<GameTail[]>([]);
  const [userTail, setUserTail] = useState<GameTail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGameTails = useCallback(async () => {
    if (!gameUniqueId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('game_tails')
        .select('*')
        .eq('game_unique_id', gameUniqueId);

      if (fetchError) {
        debug.error('Error fetching game tails:', fetchError);
        setError(fetchError.message);
        return;
      }

      // Get unique user IDs to fetch their profile data
      const userIds = [...new Set((data || []).map(t => t.user_id))];

      if (userIds.length > 0) {
        // Fetch display names from profiles table (this should always work as we control it)
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

        // Try to fetch user emails from auth.users (might fail due to RLS, so we have a fallback)
        let emailMap = new Map<string, string>();
        
        try {
          const { data: authData } = await supabase
            .from('auth.users')
            .select('id, email')
            .in('id', userIds);

          emailMap = new Map(authData?.map(u => [u.id, u.email]) || []);
        } catch (e) {
          debug.log('Could not fetch emails from auth.users:', e);
          // Continue without emails - we have display_name which is enough
        }

        // Enrich tails with user data
        const enrichedTails = (data || []).map(tail => ({
          ...tail,
          user: {
            display_name: profileMap.get(tail.user_id),
            email: emailMap.get(tail.user_id),
          },
        }));

        setTails(enrichedTails);

        // Find current user's tail if logged in
        if (user) {
          const usersTail = enrichedTails.find(t => t.user_id === user.id);
          setUserTail(usersTail || null);
        }
      } else {
        setTails(data || []);
      }
    } catch (err: any) {
      debug.error('Exception fetching game tails:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [gameUniqueId, user]);

  useEffect(() => {
    fetchGameTails();
  }, [fetchGameTails]);

  // Real-time subscription
  useEffect(() => {
    if (!gameUniqueId) return;

    const channel = supabase
      .channel(`game_tails:${gameUniqueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_tails',
          filter: `game_unique_id=eq.${gameUniqueId}`,
        },
        () => {
          fetchGameTails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameUniqueId, fetchGameTails]);

  const createGameTail = async (
    sport: string,
    teamSelection: 'home' | 'away',
    pickType: 'moneyline' | 'spread' | 'over_under'
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user || !gameUniqueId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const { error: insertError } = await supabase
        .from('game_tails')
        .insert({
          user_id: user.id,
          game_unique_id: gameUniqueId,
          sport,
          team_selection: teamSelection,
          pick_type: pickType,
        });

      if (insertError) {
        debug.error('Error creating game tail:', insertError);
        return { success: false, error: insertError.message };
      }

      await fetchGameTails();
      return { success: true };
    } catch (err: any) {
      debug.error('Exception creating game tail:', err);
      return { success: false, error: err.message };
    }
  };

  const deleteGameTail = async (tailId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const { error: deleteError } = await supabase
        .from('game_tails')
        .delete()
        .eq('id', tailId)
        .eq('user_id', user.id);

      if (deleteError) {
        debug.error('Error deleting game tail:', deleteError);
        return { success: false, error: deleteError.message };
      }

      await fetchGameTails();
      return { success: true };
    } catch (err: any) {
      debug.error('Exception deleting game tail:', err);
      return { success: false, error: err.message };
    }
  };

  const getTailingUsers = (): TailingUser[] => {
    // For now, return user_ids - we'll enhance this to fetch actual user profiles
    return tails.map(tail => ({
      user_id: tail.user_id,
      display_name: undefined,
      email: undefined,
    }));
  };

  return {
    tails,
    userTail,
    loading,
    error,
    createGameTail,
    deleteGameTail,
    getTailingUsers,
    refetch: fetchGameTails,
  };
}

