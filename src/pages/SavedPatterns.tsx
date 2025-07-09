import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, RefreshCw, Filter } from 'lucide-react';
import { format } from 'date-fns';
import PatternMatchCard from '@/components/PatternMatchCard';
import TeamDisplay from '@/components/TeamDisplay';

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
  // Betting line data
  o_u_line?: number;
  home_ml?: number;
  away_ml?: number;
  home_rl?: number;
  away_rl?: number;
}

const SavedPatterns: React.FC = () => {
  const [savedPatterns, setSavedPatterns] = useState<SavedPattern[]>([]);
  const [todayMatches, setTodayMatches] = useState<PatternMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(new Set());
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>('all');
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

  const toggleExpanded = (patternId: string) => {
    const newExpanded = new Set(expandedPatterns);
    if (newExpanded.has(patternId)) {
      newExpanded.delete(patternId);
    } else {
      newExpanded.add(patternId);
    }
    setExpandedPatterns(newExpanded);
  };

  // Extract unique games with formatted names
  const getUniqueGames = () => {
    const gameMap = new Map<string, { display: string; count: number }>();
    
    todayMatches.forEach(match => {
      if (!gameMap.has(match.unique_id)) {
        // Format as "Away @ Home" based on is_home_game flag
        const display = match.is_home_game 
          ? `${match.opponent_team} @ ${match.primary_team}`
          : `${match.primary_team} @ ${match.opponent_team}`;
        gameMap.set(match.unique_id, { display, count: 0 });
      }
    });

    // Count patterns that have matches for each game
    savedPatterns.forEach(pattern => {
      const patternMatches = todayMatches.filter(m => m.pattern_id === pattern.id);
      patternMatches.forEach(match => {
        const game = gameMap.get(match.unique_id);
        if (game) {
          game.count++;
        }
      });
    });

    return Array.from(gameMap.entries()).map(([unique_id, { display, count }]) => ({
      unique_id,
      display,
      count
    }));
  };

  const uniqueGames = getUniqueGames();

  const filteredPatterns = savedPatterns.filter(pattern => {
    // Apply target filter
    if (selectedFilter !== 'all' && pattern.target !== selectedFilter) {
      return false;
    }
    
    // Apply game filter
    if (selectedGameFilter !== 'all') {
      const patternMatches = todayMatches.filter(m => m.pattern_id === pattern.id);
      const hasMatchForSelectedGame = patternMatches.some(m => m.unique_id === selectedGameFilter);
      return hasMatchForSelectedGame;
    }
    
    return true;
  });

  useEffect(() => {
    const initializePage = async () => {
      setIsLoading(true);
      await loadSavedPatterns();
      await checkTodayMatches();
      setIsLoading(false);
    };

    initializePage();
  }, []);

  const getTargetBadgeColor = (target: string) => {
    switch (target) {
      case 'moneyline': return 'bg-blue-100 text-blue-800';
      case 'runline': return 'bg-green-100 text-green-800';
      case 'over_under': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-primary/80">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading saved patterns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/80">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-accent drop-shadow-lg">Saved Trend Patterns</h1>
            <p className="text-white/80 mt-2 text-lg">Monitor your favorite trends and see if they match today's games.</p>
          </div>
          <Button
            onClick={checkTodayMatches}
            disabled={isChecking}
            className="flex items-center gap-2 bg-primary text-white hover:bg-primary/90 shadow-lg"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking...' : 'Check Today\'s Matches'}
          </Button>
        </div>

        {/* Filter Section */}
        <div className="mb-6 space-y-4">
          {/* Target Filter */}
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-accent" />
            <span className="text-accent font-medium">Target:</span>
            <div className="flex gap-2">
              <Button
                variant={selectedFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFilter('all')}
                className={selectedFilter === 'all' ? 'bg-accent text-primary font-bold' : 'border-accent text-accent bg-background hover:bg-accent/10'}
              >
                All ({savedPatterns.length})
              </Button>
              <Button
                variant={selectedFilter === 'moneyline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFilter('moneyline')}
                className={selectedFilter === 'moneyline' ? 'bg-accent text-primary font-bold' : 'border-accent text-accent bg-background hover:bg-accent/10'}
              >
                Moneyline ({savedPatterns.filter(p => p.target === 'moneyline').length})
              </Button>
              <Button
                variant={selectedFilter === 'runline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFilter('runline')}
                className={selectedFilter === 'runline' ? 'bg-accent text-primary font-bold' : 'border-accent text-accent bg-background hover:bg-accent/10'}
              >
                Runline ({savedPatterns.filter(p => p.target === 'runline').length})
              </Button>
              <Button
                variant={selectedFilter === 'over_under' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFilter('over_under')}
                className={selectedFilter === 'over_under' ? 'bg-accent text-primary font-bold' : 'border-accent text-accent bg-background hover:bg-accent/10'}
              >
                O/U ({savedPatterns.filter(p => p.target === 'over_under').length})
              </Button>
            </div>
          </div>

          {/* Game Filter */}
          {uniqueGames.length > 0 && (
            <div className="flex items-center gap-4">
              <Filter className="h-5 w-5 text-accent" />
              <span className="text-accent font-medium">Game:</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedGameFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedGameFilter('all')}
                  className={selectedGameFilter === 'all' ? 'bg-accent text-primary font-bold' : 'border-accent text-accent bg-background hover:bg-accent/10'}
                >
                  All Games
                </Button>
                {uniqueGames.map(game => (
                  <Button
                    key={game.unique_id}
                    variant={selectedGameFilter === game.unique_id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedGameFilter(game.unique_id)}
                    className={selectedGameFilter === game.unique_id ? 'bg-accent text-primary font-bold' : 'border-accent text-accent bg-background hover:bg-accent/10'}
                  >
                    {game.display} ({game.count})
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Saved Patterns List */}
        {filteredPatterns.length === 0 ? (
          <Card className="bg-card/80 border border-border/60 shadow-lg">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                {selectedFilter === 'all' ? 'No saved patterns yet.' : `No ${selectedFilter} patterns found.`}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Save patterns from the Custom Models page to monitor them for daily matches.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredPatterns.map((pattern) => {
              const patternMatches = todayMatches.filter(m => m.pattern_id === pattern.id);
              const hasMatches = patternMatches.length > 0;
              const isExpanded = expandedPatterns.has(pattern.id);
              
              return (
                <Card key={pattern.id} className="hover:shadow-xl transition-shadow overflow-hidden border border-border/60 bg-card/80">
                  <CardHeader className="pb-4 bg-gradient-to-r from-info/20 via-info/15 to-info/10 border-b border-info/30">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg text-blue-900 font-bold">{pattern.pattern_name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Saved on {format(new Date(pattern.created_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getTargetBadgeColor(pattern.target)}>
                          {pattern.target}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deletePattern(pattern.id)}
                          className="text-red-600 hover:text-red-700 border-none bg-transparent"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {pattern.target === 'over_under' ? 'Over %' : 
                          pattern.target === 'runline' ? 'Primary Cover %' : 'Primary Win %'}
                        </p>
                        <p className="font-semibold text-green-600">
                          {(pattern.win_pct * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {pattern.target === 'over_under' ? 'Under %' : 
                          pattern.target === 'runline' ? 'Opponent Cover %' : 'Opponent Win %'}
                        </p>
                        <p className="font-semibold text-red-600">
                          {(pattern.opponent_win_pct * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Games</p>
                        <p className="font-semibold text-foreground">{pattern.games}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Features</p>
                        <p className="font-semibold text-foreground">{pattern.feature_count}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Today's Matches</p>
                        <p className="font-semibold text-primary">
                          {patternMatches.length}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Features:</p>
                      <div className="flex flex-wrap gap-1">
                        {pattern.features.map((feature, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Today's Matches for this Pattern */}
                    {hasMatches && (
                      <div className="border-t pt-4">
                        {!isExpanded ? (
                          <Button
                            onClick={() => toggleExpanded(pattern.id)}
                            className="w-full font-semibold text-base bg-primary text-white hover:bg-primary/90 transition-colors"
                            variant="default"
                          >
                            View Matching Games
                          </Button>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm text-muted-foreground font-medium">Today's Matches:</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpanded(pattern.id)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                Hide Matching Games
                              </Button>
                            </div>
                            <div className="space-y-3">
                              {patternMatches
                                .filter(match => selectedGameFilter === 'all' || match.unique_id === selectedGameFilter)
                                .map((match, index) => (
                                  <PatternMatchCard
                                    key={index}
                                    match={match}
                                    target={pattern.target}
                                  />
                                ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedPatterns;
