
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, RefreshCw, Filter, TrendingUp } from 'lucide-react';
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
  dominant_side?: string;
  roi?: {
    roi_percentage: number;
    total_games: number;
    wins: number;
    losses: number;
    last_updated: string;
  };
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
  dominant_side?: string;
}

const SavedPatterns: React.FC = () => {
  const [savedPatterns, setSavedPatterns] = useState<SavedPattern[]>([]);
  const [todayMatches, setTodayMatches] = useState<PatternMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isCalculatingROI, setIsCalculatingROI] = useState(false);
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

      // Get saved patterns with ROI data
      const { data: patterns, error: patternsError } = await supabase
        .from('saved_trend_patterns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (patternsError) {
        throw patternsError;
      }

      // Get ROI data for each pattern
      const patternsWithROI = await Promise.all(
        (patterns || []).map(async (pattern) => {
          const { data: roiData, error: roiError } = await supabase
            .from('pattern_roi')
            .select('roi_percentage, total_games, wins, losses, last_updated')
            .eq('saved_pattern_id', pattern.id)
            .maybeSingle();

          return {
            ...pattern,
            roi: roiData ? {
              roi_percentage: roiData.roi_percentage,
              total_games: roiData.total_games,
              wins: roiData.wins,
              losses: roiData.losses,
              last_updated: roiData.last_updated
            } : undefined
          };
        })
      );

      setSavedPatterns(patternsWithROI);
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

      const response = await fetch('https://gnjrklxotmbvnxbnnqgq.functions.supabase.co/check-saved-patterns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ userId: user.id })
      });

      const result = await response.json();
      setTodayMatches(result.matches || []);

      if (result.matches?.length > 0) {
        toast({
          title: "Matches found!",
          description: `Found ${result.matches.length} games matching your saved patterns today.`
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

  const getUniqueGames = () => {
    const gameMap = new Map<string, { unique_id: string; display: string; count: number }>();
    
    todayMatches.forEach(match => {
      const key = match.unique_id;
      if (gameMap.has(key)) {
        gameMap.get(key)!.count++;
      } else {
        gameMap.set(key, {
          unique_id: key,
          display: `${match.primary_team} vs ${match.opponent_team}`,
          count: 1
        });
      }
    });
    
    return Array.from(gameMap.values()).sort((a, b) => b.count - a.count);
  };

  const calculateAllROI = async () => {
    setIsCalculatingROI(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to calculate ROI.",
          variant: "destructive"
        });
        return;
      }

      // Call the ROI calculation function
      const response = await fetch('https://gnjrklxotmbvnxbnnqgq.functions.supabase.co/calculate-pattern-roi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Reload patterns to get updated ROI data
      await loadSavedPatterns();

      toast({
        title: "ROI calculation completed",
        description: `Calculated ROI for ${result.processed_patterns} patterns.`
      });
    } catch (error) {
      console.error('Error calculating ROI:', error);
      toast({
        title: "Error calculating ROI",
        description: error.message || "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsCalculatingROI(false);
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

  const getTargetBadgeColor = (target: string) => {
    switch (target) {
      case 'moneyline': return 'bg-blue-100 text-blue-800';
      case 'runline': return 'bg-green-100 text-green-800';
      case 'over_under': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to get the predicted team and win percentage
  const getPredictionInfo = (pattern: SavedPattern) => {
    if (pattern.target === 'over_under') {
      return {
        prediction: pattern.win_pct > pattern.opponent_win_pct ? 'Over' : 'Under',
        winPct: Math.max(pattern.win_pct, pattern.opponent_win_pct),
        isOver: pattern.win_pct > pattern.opponent_win_pct
      };
    } else {
      // For moneyline and runline, use the dominant_side field if available
      // This ensures consistent prediction logic across pages
      const higherWinPct = Math.max(pattern.win_pct, pattern.opponent_win_pct);
      const dominantSide = pattern.dominant_side || (pattern.win_pct > pattern.opponent_win_pct ? 'primary' : 'opponent');
      const isPrimaryTeamPredicted = dominantSide === 'primary';
      
      return {
        prediction: isPrimaryTeamPredicted ? 'Primary Team' : 'Opponent Team',
        winPct: higherWinPct,
        isPrimaryTeamPredicted,
        dominantSide
      };
    }
  };

  const filteredPatterns = savedPatterns.filter(pattern => {
    // Filter by target
    if (selectedFilter !== 'all' && pattern.target !== selectedFilter) {
      return false;
    }
    // Filter by game
    if (selectedGameFilter !== 'all') {
      // Only show patterns that have a match for the selected game
      return todayMatches.some(
        match => match.pattern_id === pattern.id && match.unique_id === selectedGameFilter
      );
    }
    return true;
  });

  const uniqueGames = getUniqueGames();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/80">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto"></div>
            <p className="text-white/80 mt-4">Loading saved patterns...</p>
          </div>
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
          <div className="flex items-center gap-3">
            <Button
              onClick={calculateAllROI}
              disabled={isCalculatingROI}
              className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 shadow-lg"
            >
              <TrendingUp className={`h-4 w-4 ${isCalculatingROI ? 'animate-spin' : ''}`} />
              {isCalculatingROI ? 'Calculating...' : 'Calculate ROI'}
            </Button>
            <Button
              onClick={checkTodayMatches}
              disabled={isChecking}
              className="flex items-center gap-2 bg-primary text-white hover:bg-primary/90 shadow-lg"
            >
              <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Checking...' : 'Check Today\'s Matches'}
            </Button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="space-y-4 mb-8">
          {/* Target Filter */}
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-accent" />
            <span className="text-accent font-medium">Target:</span>
            <div className="flex flex-wrap gap-2">
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
              const predictionInfo = getPredictionInfo(pattern);
              
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
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Prediction</p>
                        <p className="font-semibold text-green-600">
                          {predictionInfo.prediction}: {(predictionInfo.winPct * 100).toFixed(1)}%
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
                        <p className="text-sm text-muted-foreground">ROI</p>
                        {pattern.roi ? (
                          <p className={`font-semibold ${pattern.roi.roi_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {pattern.roi.roi_percentage >= 0 ? '+' : ''}{pattern.roi.roi_percentage.toFixed(1)}%
                          </p>
                        ) : (
                          <p className="text-muted-foreground text-sm">No Games Yet</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">ROI Games</p>
                        <p className="font-semibold text-foreground">{pattern.roi?.total_games || 0}</p>
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
                            <Button
                              onClick={() => toggleExpanded(pattern.id)}
                              className="w-full font-semibold text-base bg-primary text-white hover:bg-primary/90 transition-colors mb-3"
                              variant="default"
                            >
                              Hide Matching Games
                            </Button>
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
