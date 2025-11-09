import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Eye, EyeOff } from 'lucide-react';
import { getLatestValueFinds, AIValueFind, toggleValueFindPublished } from '@/services/aiCompletionService';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { useToast } from '@/hooks/use-toast';
import debug from '@/utils/debug';
import { ValueFindEditorCard } from './ValueFindEditorCard';
import { useFreemiumAccess } from '@/hooks/useFreemiumAccess';

interface ValueFindsProps {
  sportType: 'nfl' | 'cfb';
  gamesData?: Map<string, any>; // Map of game_id to game data
}

export function ValueFindsSection({ sportType, gamesData }: ValueFindsProps) {
  const [valueFinds, setValueFinds] = useState<AIValueFind | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const { isAdminMode } = useAdminMode();
  const { toast } = useToast();
  const { isFreemiumUser } = useFreemiumAccess();

  useEffect(() => {
    fetchValueFinds();
  }, [sportType]);

  const fetchValueFinds = async () => {
    try {
      setLoading(true);
      const finds = await getLatestValueFinds(sportType, 1);
      
      debug.log(`Fetched value finds for ${sportType}:`, finds);
      
      if (finds && finds.length > 0) {
        debug.log('Value picks in first find:', finds[0].value_picks);
        debug.log('Value picks length:', finds[0].value_picks?.length);
        setValueFinds(finds[0]);
      } else {
        setValueFinds(null);
      }
    } catch (error) {
      debug.error('Error fetching value finds:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublished = async () => {
    if (!valueFinds) return;
    
    setToggling(true);
    try {
      const newStatus = !valueFinds.published;
      const result = await toggleValueFindPublished(valueFinds.id, newStatus);
      
      if (result.success) {
        setValueFinds({ ...valueFinds, published: newStatus });
        toast({
          title: newStatus ? 'Published!' : 'Unpublished',
          description: `Value Finds ${newStatus ? 'is now visible to users' : 'has been hidden from users'}`,
        });
      } else {
        throw new Error(result.error || 'Failed to update status');
      }
    } catch (error) {
      debug.error('Error toggling published status:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      });
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="mb-8">
        <div className="h-64 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 animate-pulse" />
      </div>
    );
  }

  if (!valueFinds || !valueFinds.value_picks || valueFinds.value_picks.length === 0) {
    return null;
  }

  // Hide unpublished finds from regular users
  if (!valueFinds.published && !isAdminMode) {
    return null;
  }

  const sportLabel = sportType === 'nfl' ? 'NFL' : 'College Football';

  return (
    <div className="mb-8 mt-12">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-500" />
          <h2 className="text-2xl font-bold text-white">Extra Picks - WagerBot Flagged Potential Value</h2>
        </div>
        <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-none">
          {sportLabel}
        </Badge>
        <Badge variant="outline" className="text-white/70 border-white/20">
          {new Date(valueFinds.generated_at).toLocaleDateString()}
        </Badge>
        {!valueFinds.published && isAdminMode && (
          <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
            Unpublished (Admin Only)
          </Badge>
        )}
        {isAdminMode && (
          <Button
            onClick={handleTogglePublished}
            disabled={toggling}
            size="sm"
            variant="outline"
            className="ml-auto border-white/20 hover:border-white/40"
          >
            {toggling ? (
              'Updating...'
            ) : valueFinds.published ? (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                Unpublish
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Publish
              </>
            )}
          </Button>
        )}
      </div>

      {/* Value Pick Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
        {valueFinds.value_picks.map((pick: any, index: number) => {
          const gameData = gamesData?.get(pick.game_id);
          
          return (
            <ValueFindEditorCard
              key={index}
              gameId={pick.game_id}
              matchup={pick.matchup}
              betType={pick.bet_type}
              recommendedPick={pick.recommended_pick}
              confidence={pick.confidence}
              keyFactors={pick.key_factors || []}
              explanation={pick.explanation}
              gameData={gameData}
              sportType={sportType}
              isBlurred={isFreemiumUser}
            />
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="mt-4 text-center text-xs text-white/50">
        Analysis based on model predictions, Vegas lines, public betting, and market data.
        Always do your own research before placing bets.
      </div>
    </div>
  );
}

