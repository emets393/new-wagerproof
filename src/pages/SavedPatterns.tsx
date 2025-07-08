
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import PatternMatchCard from '@/components/PatternMatchCard';

interface SavedPattern {
  id: string;
  pattern_name: string;
  features: string[];
  target: string;
  combo: string;
  win_pct: number;
  opponent_win_pct: number;
  games: number;
  feature_count: number;
  created_at: string;
}

interface PatternMatch {
  pattern_id: string;
  pattern_name: string;
  unique_id: string;
  primary_team: string;
  opponent_team: string;
  is_home_game: boolean;
  win_pct: number;
  opponent_win_pct: number;
  target: string;
}

const SavedPatterns: React.FC = () => {
  const [savedPatterns, setSavedPatterns] = useState<SavedPattern[]>([]);
  const [todayMatches, setTodayMatches] = useState<PatternMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();

  const loadSavedPatterns = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to view saved patterns.",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase
        .from('saved_trend_patterns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setSavedPatterns(data || []);
    } catch (error) {
      console.error('Error loading saved patterns:', error);
      toast({
        title: "Error loading patterns",
        description: "Please try refreshing the page.",
        variant: "destructive"
      });
    }
  };

  const checkTodayMatches = async () => {
    setIsChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data: result, error } = await supabase.functions.invoke('check-saved-patterns', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('Error checking today matches:', error);
        toast({
          title: "Error checking matches",
          description: error.message || "Please try again later.",
          variant: "destructive"
        });
        return;
      }

      setTodayMatches(result.matches || []);

      if (result.matches?.length > 0) {
        toast({
          title: "Matches found!",
          description: `Found ${result.matches.length} games matching your saved patterns today.`
        });
      } else {
        toast({
          title: "No matches found",
          description: "No games match your saved patterns today."
        });
      }
    } catch (error) {
      console.error('Error checking today matches:', error);
      toast({
        title: "Error checking matches",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsChecking(false);
    }
  };

  const deletePattern = async (patternId: string) => {
    try {
      const { error } = await supabase
        .from('saved_trend_patterns')
        .delete()
        .eq('id', patternId);

      if (error) {
        throw error;
      }

      setSavedPatterns(prev => prev.filter(p => p.id !== patternId));
      setTodayMatches(prev => prev.filter(m => m.pattern_id !== patternId));
      
      toast({
        title: "Pattern deleted",
        description: "The pattern has been removed from your saved patterns."
      });
    } catch (error) {
      console.error('Error deleting pattern:', error);
      toast({
        title: "Error deleting pattern",
        description: "Please try again later.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const initializePage = async () => {
      setIsLoading(true);
      await loadSavedPatterns();
      await checkTodayMatches();
      setIsLoading(false);
    };

    initializePage();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading saved patterns...</div>
      </div>
    );
  }

  const getTargetBadgeColor = (target: string) => {
    switch (target) {
      case 'moneyline': return 'bg-blue-100 text-blue-800';
      case 'runline': return 'bg-green-100 text-green-800';
      case 'over_under': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Saved Trend Patterns</h1>
        <Button
          onClick={checkTodayMatches}
          disabled={isChecking}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Checking...' : 'Check Today\'s Matches'}
        </Button>
      </div>


      {/* Saved Patterns */}
      <div className="grid gap-4">
        {savedPatterns.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-600">No saved patterns yet.</p>
              <p className="text-sm text-gray-500 mt-2">
                Save patterns from the Custom Models page to monitor them for daily matches.
              </p>
            </CardContent>
          </Card>
        ) : (
          savedPatterns.map((pattern) => (
            <Card key={pattern.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{pattern.pattern_name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Saved on {format(new Date(pattern.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getTargetBadgeColor(pattern.target)}>
                      {pattern.target}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePattern(pattern.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">
                      {pattern.target === 'over_under' ? 'Over %' : 
                       pattern.target === 'runline' ? 'Primary Cover %' : 'Primary Win %'}
                    </p>
                    <p className="font-semibold text-green-600">
                      {(pattern.win_pct * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">
                      {pattern.target === 'over_under' ? 'Under %' : 
                       pattern.target === 'runline' ? 'Opponent Cover %' : 'Opponent Win %'}
                    </p>
                    <p className="font-semibold text-red-600">
                      {(pattern.opponent_win_pct * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Games</p>
                    <p className="font-semibold">{pattern.games}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Features</p>
                    <p className="font-semibold">{pattern.feature_count}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Today's Matches</p>
                    <p className="font-semibold text-blue-600">
                      {todayMatches.filter(m => m.pattern_id === pattern.id).length}
                    </p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 mb-2">Features:</p>
                  <div className="flex flex-wrap gap-1">
                    {pattern.features.map((feature, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Today's Matches for this Pattern */}
                {todayMatches.filter(m => m.pattern_id === pattern.id).length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-3 font-medium">Today's Matches:</p>
                    <div className="space-y-3">
                      {todayMatches
                        .filter(m => m.pattern_id === pattern.id)
                        .map((match, index) => (
                          <PatternMatchCard
                            key={index}
                            match={match}
                            target={pattern.target}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default SavedPatterns;
