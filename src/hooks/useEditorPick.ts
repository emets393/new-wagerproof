import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { useAuth } from '@/contexts/AuthContext';
import debug from '@/utils/debug';

export function useEditorPick(gameId: string, gameType: 'nfl' | 'cfb' | 'nba' | 'ncaab') {
  const { adminModeEnabled } = useAdminMode();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isStarred, setIsStarred] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pickId, setPickId] = useState<string | null>(null);

  useEffect(() => {
    if (!adminModeEnabled || !user) {
      setIsStarred(false);
      return;
    }

    checkIfStarred();
  }, [gameId, gameType, adminModeEnabled, user]);

  const checkIfStarred = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('editors_picks')
        .select('id')
        .eq('game_id', gameId)
        .eq('game_type', gameType)
        .eq('editor_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is the "no rows returned" error, which is expected
        debug.error('Error checking if starred:', error);
        return;
      }

      if (data) {
        setIsStarred(true);
        setPickId(data.id);
      } else {
        setIsStarred(false);
        setPickId(null);
      }
    } catch (error) {
      debug.error('Error checking if starred:', error);
    }
  };

  const toggleStar = async () => {
    if (!user) {
      debug.warn('No user logged in');
      return;
    }

    if (!gameId) {
      debug.error('No gameId provided to useEditorPick hook');
      toast({
        title: 'Error',
        description: 'Game ID is missing. Cannot create pick.',
        variant: 'destructive',
      });
      return;
    }

    debug.log('🌟 Toggling star for:', { gameId, gameType, isStarred });

    setIsLoading(true);
    try {
      if (isStarred && pickId) {
        // Remove the pick
        const { error } = await supabase
          .from('editors_picks')
          .delete()
          .eq('id', pickId);

        if (error) throw error;

        setIsStarred(false);
        setPickId(null);
        toast({
          title: 'Removed from Editor Picks',
          description: 'Game removed from your editor picks.',
        });
      } else {
        // Create a new draft pick
        debug.log('📝 Creating new pick with data:', {
          game_id: gameId,
          game_type: gameType,
          editor_id: user.id,
          selected_bet_type: 'spread',
          is_published: false,
        });

        const { data, error } = await supabase
          .from('editors_picks')
          .insert({
            game_id: gameId,
            game_type: gameType,
            editor_id: user.id,
            selected_bet_type: 'spread_home', // Default to home spread
            is_published: false,
          })
          .select()
          .single();

        if (error) {
          debug.error('❌ Insert error:', error);
          throw error;
        }

        debug.log('✅ Pick created:', data);

        setIsStarred(true);
        setPickId(data.id);
        toast({
          title: 'Added to Editor Picks',
          description: 'Go to Editor Picks page to add notes and publish.',
        });
      }
    } catch (error) {
      debug.error('Error toggling star:', error);
      toast({
        title: 'Error',
        description: 'Failed to update editor pick. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isStarred,
    isLoading,
    toggleStar,
    showStar: adminModeEnabled,
  };
}

