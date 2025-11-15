import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Button as MovingBorderButton } from '@/components/ui/moving-border';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertCircle, History, TrendingUp, BarChart, ScatterChart, Brain, Target, Users, Calendar, Clock, Info, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Zap, Search, X } from 'lucide-react';
import debug from '@/utils/debug';
import { LiquidButton } from '@/components/animate-ui/components/buttons/liquid';
import { Link } from 'react-router-dom';
import NFLGameCard from '@/components/NFLGameCard';
import { BackgroundGradient } from '@/components/ui/background-gradient';
import { MiniWagerBotChat } from '@/components/MiniWagerBotChat';
import { StarButton } from '@/components/StarButton';
import { useAuth } from '@/contexts/AuthContext';
import { chatSessionManager } from '@/utils/chatSession';
import { trackPredictionViewed, trackGameAnalysisOpened, trackFilterApplied, trackSortApplied } from '@/lib/mixpanel';
import PolymarketWidget from '@/components/PolymarketWidget';
import { useFreemiumAccess } from '@/hooks/useFreemiumAccess';
import { FreemiumUpgradeBanner } from '@/components/FreemiumUpgradeBanner';
import { Lock, Sparkles } from 'lucide-react';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { AIPayloadViewer } from '@/components/AIPayloadViewer';
import { getGameCompletions, getHighValueBadges, getPageHeaderData } from '@/services/aiCompletionService';
import { PageHeaderValueFinds } from '@/components/PageHeaderValueFinds';
import { HighValueBadge } from '@/components/HighValueBadge';
import { GameDetailsModal } from '@/components/GameDetailsModal';
import { areCompletionsEnabled } from '@/utils/aiCompletionSettings';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { GameTailSection } from '@/components/GameTailSection';
import { CardFooter } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getNBATeamColors, getNBATeamInitials } from '@/utils/teamColors';
import { useSportsPageCache } from '@/hooks/useSportsPageCache';

interface NBAPrediction {
  id: string;
  away_team: string;
  home_team: string;
  home_ml: number | null;
  away_ml: number | null;
  home_spread: number | null;
  away_spread: number | null;
  over_line: number | null;
  game_date: string;
  game_time: string;
  training_key: string;
  unique_id: string;
  // Model predictions
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  run_id: string | null;
  // Edge values (delta) - like College Basketball
  home_spread_diff?: number | null;
  over_line_diff?: number | null;
  // Public betting splits (may not exist for basketball)
  spread_splits_label: string | null;
  total_splits_label: string | null;
  ml_splits_label: string | null;
}

interface TeamMapping {
  team_id: number;
  team_name: string;
  abbreviation: string;
  logo_url: string;
}

export default function NBA() {
  const { user } = useAuth();
  const { isFreemiumUser } = useFreemiumAccess();
  const { adminModeEnabled } = useAdminMode();
  const { showNFLMoneylinePills } = useDisplaySettings();
  
  // Session cache hook
  const { getCachedData, setCachedData, clearCache, restoreScrollPosition } = useSportsPageCache<NBAPrediction>('nba');
  
  const [predictions, setPredictions] = useState<NBAPrediction[]>([]);
  const [teamMappings, setTeamMappings] = useState<TeamMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(['All Games']);
  const [sortKey, setSortKey] = useState<'none' | 'ml' | 'spread' | 'ou'>('none');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // AI Completion state
  const [aiCompletions, setAiCompletions] = useState<Record<string, Record<string, string>>>({});
  const [payloadViewerOpen, setPayloadViewerOpen] = useState(false);
  const [selectedPayloadGame, setSelectedPayloadGame] = useState<NBAPrediction | null>(null);
  
  // Value Finds state
  const [highValueBadges, setHighValueBadges] = useState<Map<string, any>>(new Map());
  const [pageHeaderData, setPageHeaderData] = useState<{ summary_text: string; compact_picks: any[] } | null>(null);
  const [valueFindsLoading, setValueFindsLoading] = useState(true);
  const [valueFindId, setValueFindId] = useState<string | null>(null);
  const [valueFindPublished, setValueFindPublished] = useState<boolean>(false);
  
  // Focused card state for light beams effect
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [sortAscending, setSortAscending] = useState<boolean>(false);
  
  // Public Betting Facts expanded state - tracks which cards have expanded betting facts
  const [expandedBettingFacts, setExpandedBettingFacts] = useState<Record<string, boolean>>({});
  
  // Modal state - tracks which game is selected for modal
  const [selectedGameForModal, setSelectedGameForModal] = useState<NBAPrediction | null>(null);
  
  // Match simulator UI states per game id
  const [simLoadingById, setSimLoadingById] = useState<Record<string, boolean>>({});
  const [simRevealedById, setSimRevealedById] = useState<Record<string, boolean>>({});
  
  // Track predictions viewed when loaded
  useEffect(() => {
    if (!loading && predictions.length > 0) {
      trackPredictionViewed('NBA' as any, predictions.length, activeFilters.join(','), sortKey);
    }
  }, [loading, predictions.length]);

  // Fetch Value Finds data on mount and periodically
  useEffect(() => {
    fetchValueFinds();
    
    // Refresh value finds every 30 seconds to catch publish/unpublish changes
    const interval = setInterval(() => {
      fetchValueFinds();
    }, 30000); // 30 seconds
    
    // Also refresh when the tab becomes visible (user switches back to the tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchValueFinds();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [adminModeEnabled]); // Re-fetch when admin mode changes

  const fetchValueFinds = async () => {
    try {
      setValueFindsLoading(true);
      const [badges, headerData] = await Promise.all([
        getHighValueBadges('nba'),
        getPageHeaderData('nba', adminModeEnabled), // Pass admin mode to include unpublished data
      ]);

      // Convert badges array to Map for easy lookup
      const badgesMap = new Map();
      badges.forEach(badge => {
        badgesMap.set(badge.game_id, badge);
      });
      
      setHighValueBadges(badgesMap);
      
      if (headerData) {
        setPageHeaderData(headerData.data);
        setValueFindId(headerData.id || null);
        setValueFindPublished(headerData.published || false);
      } else {
        setPageHeaderData(null);
        setValueFindId(null);
        setValueFindPublished(false);
      }
    } catch (error) {
      debug.error('Error fetching value finds:', error);
    } finally {
      setValueFindsLoading(false);
    }
  };

  // Sorting helpers (displayed probability = max(p, 1-p))
  const getDisplayedMlProb = (p: number | null): number | null => {
    if (p === null || p === undefined) return null;
    return p >= 0.5 ? p : 1 - p;
  };
  const getDisplayedSpreadProb = (p: number | null): number | null => {
    if (p === null || p === undefined) return null;
    return p >= 0.5 ? p : 1 - p;
  };
  const getDisplayedOuProb = (p: number | null): number | null => {
    if (p === null || p === undefined) return null;
    return p >= 0.5 ? p : 1 - p;
  };


  // Build context for WagerBot with all current game data (formatted as markdown)
  const buildNBAContext = (preds: NBAPrediction[]): string => {
    try {
      if (!preds || preds.length === 0) return '';
      
      const contextParts = preds.slice(0, 20).map((pred, idx) => { // Limit to 20 games to manage token count
        try {
          const awayTeam = pred.away_team || 'Unknown';
          const homeTeam = pred.home_team || 'Unknown';
          const gameDate = pred.game_date ? new Date(pred.game_date).toLocaleDateString() : 'TBD';
          const gameTime = pred.game_time || 'TBD';
          
          return `
### Game ${idx + 1}: ${awayTeam} @ ${homeTeam}

**Date/Time:** ${gameDate} ${gameTime}

**Betting Lines:**
- Spread: ${homeTeam} ${pred.home_spread || 'N/A'}
- Moneyline: Away ${pred.away_ml || 'N/A'} / Home ${pred.home_ml || 'N/A'}
- Over/Under: ${pred.over_line || 'N/A'}

**Model Predictions (EPA Model):**
- ML Probability: ${pred.home_away_ml_prob ? (pred.home_away_ml_prob * 100).toFixed(1) + '%' : 'N/A'}
- Spread Cover Probability: ${pred.home_away_spread_cover_prob ? (pred.home_away_spread_cover_prob * 100).toFixed(1) + '%' : 'N/A'}
- O/U Probability: ${pred.ou_result_prob ? (pred.ou_result_prob * 100).toFixed(1) + '%' : 'N/A'}

**Public Betting Splits:**
- Spread: ${pred.spread_splits_label || 'N/A'}
- Total: ${pred.total_splits_label || 'N/A'}
- Moneyline: ${pred.ml_splits_label || 'N/A'}

---`;
        } catch (err) {
          debug.error('Error building context for game:', pred, err);
          return '';
        }
      }).filter(Boolean).join('\n');
      
      return `# 🏀 NBA Games Data

I have access to **${preds.length} total games**. Here's the detailed breakdown:

${contextParts}

*Note: I can help you analyze these matchups, identify value opportunities, and answer questions about specific games.*`;
    } catch (error) {
      debug.error('Error building NBA context:', error);
      return ''; // Return empty string if there's an error
    }
  };

  // Memoize the context to prevent infinite re-renders
  // Use predictions.length and first game ID as dependency to avoid array reference issues
  const nbaContext = useMemo(() => {
    const context = buildNBAContext(predictions);
    
    // Debug logging for context - Show what we're sending to the AI
    if (context && predictions.length > 0) {
      debug.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #3b82f6; font-weight: bold');
      debug.log('%c🏀 NBA - DATA SENT TO AI', 'color: #3b82f6; font-weight: bold; font-size: 14px');
      debug.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #3b82f6; font-weight: bold');
      debug.log(`\n📈 Total Games: ${predictions.length}\n`);
      
      // Show summary of each game
      predictions.slice(0, 10).forEach((pred, idx) => {
        const gameDate = pred.game_date ? new Date(pred.game_date).toLocaleDateString() : 'TBD';
        const gameTime = pred.game_time || 'TBD';
        debug.log(`%c🏀 Game ${idx + 1}: ${pred.away_team} @ ${pred.home_team}`, 'color: #f59e0b; font-weight: bold');
        debug.log(`   📅 Date/Time: ${gameDate} ${gameTime}`);
        debug.log(`   📊 Lines:`);
        debug.log(`      • Spread: ${pred.home_team} ${pred.home_spread || 'N/A'}`);
        debug.log(`      • Moneyline: Away ${pred.away_ml || 'N/A'} / Home ${pred.home_ml || 'N/A'}`);
        debug.log(`      • Over/Under: ${pred.over_line || 'N/A'}`);
        debug.log(`   🤖 Model Predictions:`);
        debug.log(`      • ML Probability: ${pred.home_away_ml_prob ? (pred.home_away_ml_prob * 100).toFixed(1) + '%' : 'N/A'}`);
        debug.log(`      • Spread Cover Prob: ${pred.home_away_spread_cover_prob ? (pred.home_away_spread_cover_prob * 100).toFixed(1) + '%' : 'N/A'}`);
        debug.log(`      • O/U Probability: ${pred.ou_result_prob ? (pred.ou_result_prob * 100).toFixed(1) + '%' : 'N/A'}`);
        debug.log(`   📈 Public Splits: Spread: ${pred.spread_splits_label || 'N/A'}, Total: ${pred.total_splits_label || 'N/A'}`);
        debug.log('');
      });
      
      if (predictions.length > 10) {
        debug.log(`   ... and ${predictions.length - 10} more games`);
      }
      
      debug.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #3b82f6; font-weight: bold');
      debug.log(`%c✅ Full context length: ${context.length} characters`, 'color: #3b82f6');
      debug.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'color: #3b82f6; font-weight: bold');
      
      // Also log raw context for copy-paste debugging
      console.groupCollapsed('📋 Raw Context (click to expand)');
      debug.log(context);
      console.groupEnd();
    }
    
    return context;
  }, [predictions.length, predictions[0]?.id]);

  // Helper function to calculate color luminance
  const getColorLuminance = (hexColor: string): number => {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Calculate relative luminance using the formula
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };

  // Helper function to get contrasting text color for team circles
  const getContrastingTextColor = (bgColor1: string, bgColor2: string): string => {
    const lum1 = getColorLuminance(bgColor1);
    const lum2 = getColorLuminance(bgColor2);
    const avgLuminance = (lum1 + lum2) / 2;
    
    // If average luminance is dark, use white text; if light, use dark text
    return avgLuminance < 0.5 ? '#ffffff' : '#000000';
  };

  // Get appropriate team color for dark mode
  const getTeamColorForMode = (teamColors: { primary: string; secondary: string }): string => {
    // In dark mode, always choose the brighter color
    if (document.documentElement.classList.contains('dark')) {
      const primaryLuminance = getColorLuminance(teamColors.primary);
      const secondaryLuminance = getColorLuminance(teamColors.secondary);
      
      // Return whichever color is brighter (higher luminance)
      return secondaryLuminance > primaryLuminance ? teamColors.secondary : teamColors.primary;
    }
    // In light mode, use primary
    return teamColors.primary;
  };

  // Check if a game should be displayed based on active filters and search
  const shouldDisplayGame = (prediction: NBAPrediction): boolean => {
    // First check search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const awayTeam = prediction.away_team.toLowerCase();
      const homeTeam = prediction.home_team.toLowerCase();
      
      if (!awayTeam.includes(query) && !homeTeam.includes(query)) {
        return false;
      }
    }
    
    // Then check filters
    if (activeFilters.includes('All Games')) return true;
    
    // For now, just return true since we don't have betting splits data yet
    // This will be updated when we add the sharp money logic
    return true;
  };

  // Check if a specific label should be highlighted
  const shouldHighlightLabel = (label: string | null): boolean => {
    if (!label || activeFilters.includes('All Games')) return false;
    
    return activeFilters.some(filter => {
      if (filter === 'All Games') return false;
      
      // Create flexible matching patterns for each filter type
      const patterns = {
        'Sharp Money': ['sharp'],
        'Public Bets': ['public'],
        'Consensus Bets': ['consensus']
      };
      
      const patternsToMatch = patterns[filter as keyof typeof patterns] || [];
      
      return patternsToMatch.some(pattern => 
        label.toLowerCase().includes(pattern)
      );
    });
  };

  // Parse betting split labels to extract structured data
  const parseBettingSplit = (label: string | null): { 
    team: string; 
    percentage: number; 
    isSharp: boolean; 
    isPublic: boolean;
    direction?: string; // For totals: "over" or "under"
  } | null => {
    if (!label) return null;
    
    const lowerLabel = label.toLowerCase();
    
    // Extract percentage
    const percentMatch = label.match(/(\d+)%/);
    const percentage = percentMatch ? parseInt(percentMatch[1]) : 50;
    
    // Determine if sharp or public
    const isSharp = lowerLabel.includes('sharp');
    const isPublic = lowerLabel.includes('public');
    
    // Extract team name or direction
    let team = '';
    let direction = undefined;
    
    // Check for Over/Under (for totals)
    if (lowerLabel.includes('over')) {
      direction = 'over';
      team = 'Over';
    } else if (lowerLabel.includes('under')) {
      direction = 'under';
      team = 'Under';
    } else {
      // Extract team name (usually after "on" keyword)
      const teamMatch = label.match(/on\s+([A-Za-z\s]+?)(?:\s*\(|$)/);
      if (teamMatch) {
        team = teamMatch[1].trim();
      }
    }
    
    return { team, percentage, isSharp, isPublic, direction };
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Force new chat session on refresh
      debug.log('🔄 Refresh triggered - clearing chat session to force new context');
      if (user) {
        chatSessionManager.clearPageSession(user.id, 'nba');
      }
      
      debug.log('Fetching NBA data...');
      
      // Step 1: Fetch ALL games from nba_input_values_view
      debug.log('📊 Querying nba_input_values_view for all games...');
      const { data: nbaGames, error: gamesError } = await collegeFootballSupabase
        .from('nba_input_values_view')
        .select('*')
        .order('game_date', { ascending: true })
        .order('tipoff_time_et', { ascending: true });

      if (gamesError) {
        debug.error('Error fetching NBA games from nba_input_values_view:', gamesError);
        setError(`Games error: ${gamesError.message}`);
        setLoading(false);
        return;
      }

      debug.log('✅ NBA games fetched from nba_input_values_view:', nbaGames?.length || 0);
      
      // Step 2: Fetch predictions from nba_predictions (latest run_id)
      debug.log('📊 Fetching model predictions from nba_predictions...');
      const { data: latestRun, error: runError } = await collegeFootballSupabase
        .from('nba_predictions')
        .select('run_id, as_of_ts_utc')
        .order('as_of_ts_utc', { ascending: false })
        .limit(1)
        .maybeSingle();

      let predictionsMap = new Map();
      
      if (!runError && latestRun) {
        debug.log('Latest run_id:', latestRun.run_id);
        const gameIds = (nbaGames || []).map(g => g.game_id);
        const { data: predictions, error: predsError } = await collegeFootballSupabase
          .from('nba_predictions')
          .select('game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread, run_id')
          .eq('run_id', latestRun.run_id)
          .in('game_id', gameIds);

        if (!predsError && predictions) {
          debug.log('✅ Predictions fetched:', predictions.length);
          predictions.forEach(pred => {
            predictionsMap.set(pred.game_id, pred);
          });
        } else {
          debug.warn('No predictions found or error:', predsError);
        }
      } else {
        debug.warn('No prediction run_id found (table may be empty)');
      }
      
      // Step 3: Fetch team mappings for logos
      const { data: teamMappingsData, error: teamMappingsError } = await collegeFootballSupabase
        .from('nba_teams_master')
        .select('*');
      
      if (teamMappingsError) {
        debug.error('Error fetching team mappings:', teamMappingsError);
      } else {
        debug.log('✅ Team mappings fetched:', teamMappingsData?.length);
      }
      
      // Normalize team mapping data structure
      const teamMappings = (teamMappingsData || []).map((team: any) => ({
        team_id: team.team_id || team.id,
        team_name: team.team_name || team.name || team.full_name,
        abbreviation: team.abbreviation || team.abbr || team.short_name,
        logo_url: team.logo_url || team.logo || '/placeholder.svg'
      }));
      
      setTeamMappings(teamMappings);

      // Step 4: Merge games with predictions
      // game_id in nba_input_values_view = game_id in nba_predictions
      const predictionsWithData = (nbaGames || []).map((game) => {
        const prediction = predictionsMap.get(game.game_id);
        const gameIdStr = String(game.game_id);
        
        // Calculate away moneyline from home moneyline
        const homeML = game.home_moneyline;
        let awayML = null;
        if (homeML) {
          awayML = homeML > 0 ? -(homeML + 100) : 100 - homeML;
        }
        
        // Calculate edge values (delta) - like College Basketball
        const vegasHomeSpread = game.home_spread;
        const modelFairHomeSpread = prediction?.model_fair_home_spread || null;
        const homeSpreadDiff = (vegasHomeSpread !== null && modelFairHomeSpread !== null)
          ? vegasHomeSpread - modelFairHomeSpread
          : null;
        
        const vegasTotal = game.total_line;
        const modelFairTotal = prediction?.model_fair_total || null;
        const overLineDiff = (vegasTotal !== null && modelFairTotal !== null)
          ? modelFairTotal - vegasTotal
          : null;
        
        // Calculate spread cover probability based on model's predicted margin vs Vegas spread
        let spreadCoverProb = null;
        if (prediction && prediction.model_fair_home_spread !== null && game.home_spread !== null) {
          // If model's fair spread is more favorable to home team than Vegas, home is likely to cover
          // E.g., model says -10, Vegas says -7 → home team is undervalued, higher chance to cover
          const spreadDiff = Math.abs(prediction.model_fair_home_spread - game.home_spread);
          if (prediction.model_fair_home_spread < game.home_spread) {
            // Model thinks home should be favored more → home likely covers
            spreadCoverProb = 0.5 + Math.min(spreadDiff * 0.05, 0.35); // Cap at 0.85
          } else {
            // Model thinks away should be favored more → away likely covers
            spreadCoverProb = 0.5 - Math.min(spreadDiff * 0.05, 0.35); // Floor at 0.15
          }
        } else if (prediction?.home_win_prob) {
          // Fallback: use home_win_prob as proxy
          spreadCoverProb = prediction.home_win_prob;
        }
        
        // Calculate over/under probability based on predicted total vs Vegas line
        let ouProb = null;
        if (prediction && prediction.model_fair_total !== null && game.total_line !== null) {
          const totalDiff = prediction.model_fair_total - game.total_line;
          if (totalDiff > 0) {
            // Model predicts higher total → over is likely
            ouProb = 0.5 + Math.min(Math.abs(totalDiff) * 0.02, 0.35); // Cap at 0.85
          } else {
            // Model predicts lower total → under is likely
            ouProb = 0.5 - Math.min(Math.abs(totalDiff) * 0.02, 0.35); // Floor at 0.15
          }
        }
        
        return {
          id: gameIdStr,
          away_team: game.away_team,
          home_team: game.home_team,
          training_key: gameIdStr,
          unique_id: gameIdStr,
          // Betting lines from input values
          home_ml: homeML,
          away_ml: awayML,
          home_spread: game.home_spread,
          away_spread: game.home_spread ? -game.home_spread : null,
          over_line: game.total_line,
          // Game date/time
          game_date: game.game_date || '',
          game_time: game.tipoff_time_et || '',
          // Add prediction probabilities
          home_away_ml_prob: prediction?.home_win_prob || null,
          home_away_spread_cover_prob: spreadCoverProb,
          ou_result_prob: ouProb,
          run_id: prediction?.run_id || null,
          // Edge values (delta) - like College Basketball
          home_spread_diff: homeSpreadDiff,
          over_line_diff: overLineDiff,
          // Model predicted spread (for modal display)
          pred_spread: modelFairHomeSpread,
          pred_over_line: prediction?.model_fair_total || null,
          // Vegas lines for reference
          api_spread: vegasHomeSpread,
          api_over_line: vegasTotal,
          // Score predictions for match simulator
          home_score_pred: prediction?.home_score_pred || null,
          away_score_pred: prediction?.away_score_pred || null,
          // Public betting splits (not available for basketball)
          spread_splits_label: null,
          ml_splits_label: null,
          total_splits_label: null,
        };
      });

      debug.log(`✅ Showing ALL ${predictionsWithData.length} games (${predictionsMap.size} have predictions)`);

      setPredictions(predictionsWithData);
      setTeamMappings(teamMappings);
      setLastUpdated(new Date());
      
      // Save to cache
      setCachedData({
        predictions: predictionsWithData,
        teamMappings: teamMappings,
        lastUpdated: Date.now(),
        searchQuery,
        sortKey,
        sortAscending,
        scrollPosition: 0,
        activeFilters,
      });
    } catch (err) {
      debug.error('Error fetching data:', err);
      setError(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch AI completions for all games
  const fetchAICompletions = async (games: NBAPrediction[]) => {
    // Check if completions are enabled
    if (!areCompletionsEnabled('nba' as any)) {
      debug.log('NBA completions are disabled via emergency toggle, skipping fetch');
      setAiCompletions({});
      return;
    }
    
    debug.log('Fetching AI completions for', games.length, 'games');
    const completionsMap: Record<string, Record<string, string>> = {};
    
    for (const game of games) {
      // Try multiple gameId formats to match what might be stored
      const gameIdOptions = [
        game.training_key,
        game.unique_id,
        game.id,
        `${game.away_team}_${game.home_team}`,
        String((game as any).game_id || game.id)
      ].filter(Boolean) as string[];
      
      debug.log(`Game ${game.away_team} @ ${game.home_team} - Trying gameIds:`, gameIdOptions);
      
      for (const gameId of gameIdOptions) {
        try {
          const completions = await getGameCompletions(gameId, 'nba');
          if (Object.keys(completions).length > 0) {
            debug.log(`Found completions for gameId: ${gameId}`, completions);
            // Use the first valid gameId format for the map
            const primaryGameId = game.training_key || game.unique_id || gameId;
            completionsMap[primaryGameId] = completions;
            break; // Found completions, no need to try other formats
          }
        } catch (error) {
          debug.error(`Error fetching completions for ${gameId}:`, error);
        }
      }
    }
    
    debug.log('AI completions fetched:', Object.keys(completionsMap).length, 'games have completions');
    debug.log('Completion map:', completionsMap);
    setAiCompletions(completionsMap);
  };

  // Refresh completions after generating a new one
  const handleCompletionGenerated = async (gameId: string, widgetType: string) => {
    debug.log('Completion generated, refreshing for game:', gameId);
    try {
      const completions = await getGameCompletions(gameId, 'nba');
      setAiCompletions(prev => ({
        ...prev,
        [gameId]: completions
      }));
    } catch (error) {
      debug.error(`Error refreshing completions for ${gameId}:`, error);
    }
  };

  // Check cache on mount, fetch if no cache or expired
  useEffect(() => {
    const cached = getCachedData();
    
    if (cached && cached.predictions.length > 0) {
      // Restore from cache
      setPredictions(cached.predictions);
      if (cached.teamMappings) {
        setTeamMappings(cached.teamMappings);
      }
      setLastUpdated(new Date(cached.lastUpdated));
      setSearchQuery(cached.searchQuery || '');
      // Validate sortKey type
      const validSortKey = cached.sortKey as 'none' | 'ml' | 'spread' | 'ou';
      if (['none', 'ml', 'spread', 'ou'].includes(validSortKey)) {
        setSortKey(validSortKey);
      } else {
        setSortKey('none');
      }
      setSortAscending(cached.sortAscending || false);
      setActiveFilters(cached.activeFilters || ['All Games']);
      setLoading(false);
      
      // Restore scroll position after render
      if (cached.scrollPosition > 0) {
        restoreScrollPosition(cached.scrollPosition);
      }
    } else {
      // No cache, fetch fresh data
      fetchData();
    }
  }, []);
  
  // Update cache when UI state changes (debounced to avoid excessive writes)
  useEffect(() => {
    if (predictions.length === 0) return;
    
    // Debounce cache updates to avoid excessive sessionStorage writes
    const timeoutId = setTimeout(() => {
      const cached = getCachedData();
      if (cached) {
        setCachedData({
          ...cached,
          searchQuery,
          sortKey,
          sortAscending,
          activeFilters,
        });
      }
    }, 500); // Wait 500ms after last change
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery, sortKey, sortAscending, activeFilters, predictions.length]);
  
  // Fetch AI completions when predictions are loaded
  useEffect(() => {
    if (predictions.length > 0) {
      fetchAICompletions(predictions);
    }
  }, [predictions]);

  // Function to get team initials for circle display
  const getTeamInitials = (teamName: string): string => {
    const mapping = teamMappings.find(m => m.team_name === teamName);
    if (mapping?.abbreviation) return mapping.abbreviation;
    return getNBATeamInitials(teamName);
  };

  // Function to get full team name (city + team name)
  const getFullTeamName = (teamName: string): { city: string; name: string } => {
    // For NBA, team names are usually "City Team" format
    // Split on common patterns if needed, otherwise use full name
    return {
      city: teamName,
      name: ''
    };
  };

  const getTeamLogo = (teamName: string): string => {
    if (!teamName) return '/placeholder.svg';
    
    // First try database mapping
    const mapping = teamMappings.find(m => {
      if (!m?.team_name) return false;
      return m.team_name === teamName || 
        teamName.includes(m.team_name) ||
        m.team_name.includes(teamName);
    });
    
    if (mapping?.logo_url && mapping.logo_url !== '/placeholder.svg' && mapping.logo_url.trim() !== '') {
      return mapping.logo_url;
    }
    
    // Fallback to ESPN NBA logo URLs
    const espnLogoMap: { [key: string]: string } = {
      'Atlanta Hawks': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
      'Boston Celtics': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
      'Brooklyn Nets': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
      'Charlotte Hornets': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
      'Chicago Bulls': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
      'Cleveland Cavaliers': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
      'Dallas Mavericks': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
      'Denver Nuggets': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
      'Detroit Pistons': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
      'Golden State Warriors': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
      'Houston Rockets': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
      'Indiana Pacers': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
      'LA Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
      'Los Angeles Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
      'Los Angeles Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
      'Memphis Grizzlies': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
      'Miami Heat': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
      'Milwaukee Bucks': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
      'Minnesota Timberwolves': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
      'New Orleans Pelicans': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
      'New York Knicks': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
      'Oklahoma City Thunder': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
      'Orlando Magic': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
      'Philadelphia 76ers': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
      'Phoenix Suns': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
      'Portland Trail Blazers': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
      'Sacramento Kings': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
      'San Antonio Spurs': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
      'Toronto Raptors': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
      'Utah Jazz': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
      'Washington Wizards': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
    };
    
    // Try exact match first
    if (espnLogoMap[teamName]) {
      return espnLogoMap[teamName];
    }
    
    // Try case-insensitive match
    const lowerTeamName = teamName.toLowerCase();
    const matchedKey = Object.keys(espnLogoMap).find(key => key.toLowerCase() === lowerTeamName);
    if (matchedKey) {
      return espnLogoMap[matchedKey];
    }
    
    // Try partial match (team name contains mapping key or vice versa)
    for (const [key, url] of Object.entries(espnLogoMap)) {
      if (teamName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(teamName.toLowerCase())) {
        return url;
      }
    }
    
    debug.log(`⚠️ No logo found for team: ${teamName}`);
    return '/placeholder.svg';
  };

  const formatMoneyline = (ml: number | null): string => {
    if (ml === null || ml === undefined) return '-';
    if (ml > 0) return `+${ml}`;
    return ml.toString();
  };

  const formatSpread = (spread: number | null): string => {
    if (spread === null || spread === undefined) return '-';
    if (spread > 0) return `+${spread}`;
    return spread.toString();
  };

  const convertTimeToEST = (timeString: string | null | undefined): string => {
    if (!timeString || timeString.trim() === '') {
      return 'TBD';
    }

    try {
      let date: Date;
      
      // Check if it's an ISO datetime string (e.g., "2025-11-14T00:30:00Z" or "2025-11-14 00:30:00+00")
      if (timeString.includes('T') || timeString.includes(' ') && timeString.length > 10) {
        // Parse as ISO datetime
        date = new Date(timeString);
        if (isNaN(date.getTime())) {
          debug.error('Invalid ISO datetime:', timeString);
          return 'TBD';
        }
      } else {
        // Assume it's a simple time string (e.g., "15:30:00" or "15:30")
        const parts = timeString.split(':');
        if (parts.length < 2) {
          debug.error('Invalid time format:', timeString);
          return 'TBD';
        }
        
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        
        if (isNaN(hours) || isNaN(minutes)) {
          debug.error('Invalid time values:', timeString);
          return 'TBD';
        }
        
        // Create date for today with UTC time
        const today = new Date();
        date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hours, minutes, 0));
      }
      
      // Convert to EST/EDT using timezone-aware conversion
      const timeStr = date.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      // Determine if it's EST or EDT by checking the offset
      // EST is UTC-5, EDT is UTC-4
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        timeZoneName: 'short'
      });
      const parts = formatter.formatToParts(date);
      const tzName = parts.find(part => part.type === 'timeZoneName')?.value || 'EST';
      
      return `${timeStr} ${tzName}`;
    } catch (error) {
      debug.error('Error formatting time:', error, timeString);
      return 'TBD';
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatCompactDate = (dateString: string): string => {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };
  // Build sorted list according to current sort selection
  const getSortedPredictions = (): NBAPrediction[] => {
    const list = predictions.filter(shouldDisplayGame);
    const byDateTime = (a: NBAPrediction, b: NBAPrediction) => {
      const dateComparison = a.game_date.localeCompare(b.game_date);
      if (dateComparison !== 0) return dateComparison;
      return a.game_time.localeCompare(b.game_time);
    };
    if (sortKey === 'none') {
      const sorted = [...list].sort(byDateTime);
      return sortAscending ? sorted.reverse() : sorted;
    }
    const score = (p: NBAPrediction): number => {
      if (sortKey === 'ml') return getDisplayedMlProb(p.home_away_ml_prob) ?? -1;
      if (sortKey === 'spread') return getDisplayedSpreadProb(p.home_away_spread_cover_prob) ?? -1;
      return getDisplayedOuProb(p.ou_result_prob) ?? -1;
    };
    const sorted = [...list].sort((a, b) => {
      const sb = score(b) - score(a);
      if (sb !== 0) return sb;
      return byDateTime(a, b);
    });
    // Apply ascending/descending based on sortAscending flag
    return sortAscending ? sorted.reverse() : sorted;
  };


  // Helper function to round to nearest 0.5 or whole number
  const roundToNearestHalf = (value: number): number => {
    return Math.round(value * 2) / 2;
  };

  // Helper function to format edge value (rounds to nearest 0.5)
  const formatEdge = (value: number | null): string => {
    if (value === null || isNaN(value)) return '-';
    const rounded = roundToNearestHalf(Math.abs(value));
    return rounded.toString();
  };

  // Helper function to get edge team info (like College Basketball)
  const getEdgeInfo = (homeSpreadDiff: number | null, awayTeam: string, homeTeam: string) => {
    if (homeSpreadDiff === null || isNaN(homeSpreadDiff)) return null;
    
    const isHomeEdge = homeSpreadDiff > 0;
    const teamName = isHomeEdge ? homeTeam : awayTeam;
    const edgeValue = Math.abs(homeSpreadDiff);
    
    return {
      teamName,
      edgeValue: roundToNearestHalf(edgeValue),
      isHomeEdge,
      displayEdge: formatEdge(homeSpreadDiff)
    };
  };


  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">NBA</h1>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">NBA</h1>
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs sm:text-sm px-2 py-0.5">
            BETA
          </Badge>
        </div>
      </div>
      
      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search matchups by team name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sort Controls with Refresh and Last Updated */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <Button
          variant={sortKey === 'none' ? 'default' : 'outline'}
          className={`${
            sortKey === 'none' 
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40' 
              : 'bg-white dark:bg-gray-800 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700'
          } text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto whitespace-nowrap transition-all duration-200 border border-gray-200 dark:border-gray-700`}
          onClick={() => {
            if (sortKey === 'none') {
              setSortAscending(!sortAscending);
            } else {
              setSortKey('none');
              setSortAscending(false);
            }
          }}
          title="Sort by game time (click to toggle direction)"
        >
          <span className="hidden sm:inline">Sort: Time</span>
          <span className="sm:hidden">Time</span>
          {sortKey === 'none' && (sortAscending ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
        </Button>
        <Button
          variant={sortKey === 'spread' ? 'default' : 'outline'}
          disabled={isFreemiumUser}
          className={`${
            sortKey === 'spread' 
              ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md shadow-purple-500/30 hover:shadow-lg hover:shadow-purple-500/40' 
              : 'bg-white dark:bg-gray-800 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 dark:hover:from-gray-700 dark:hover:to-gray-700'
          } text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto whitespace-nowrap transition-all duration-200 border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
          onClick={() => {
            if (sortKey === 'spread') {
              setSortAscending(!sortAscending);
            } else {
              setSortKey('spread');
              setSortAscending(false);
            }
          }}
          title={isFreemiumUser ? "Subscribe to unlock sorting" : "Sort by highest Spread probability (click to toggle direction)"}
        >
          {isFreemiumUser && <Lock className="h-3 w-3 mr-1" />}
          <span className="hidden sm:inline">Sort: Spread</span>
          <span className="sm:hidden">Spread</span>
          {sortKey === 'spread' && (sortAscending ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
        </Button>
        <Button
          variant={sortKey === 'ou' ? 'default' : 'outline'}
          disabled={isFreemiumUser}
          className={`${
            sortKey === 'ou' 
              ? 'bg-gradient-to-r from-green-600 to-emerald-700 text-white shadow-md shadow-green-500/30 hover:shadow-lg hover:shadow-green-500/40' 
              : 'bg-white dark:bg-gray-800 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-gray-700 dark:hover:to-gray-700'
          } text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto whitespace-nowrap transition-all duration-200 border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
          onClick={() => {
            if (sortKey === 'ou') {
              setSortAscending(!sortAscending);
            } else {
              setSortKey('ou');
              setSortAscending(false);
            }
          }}
          title={isFreemiumUser ? "Subscribe to unlock sorting" : "Sort by highest Over/Under probability (click to toggle direction)"}
        >
          {isFreemiumUser && <Lock className="h-3 w-3 mr-1" />}
          <span className="hidden sm:inline">Sort: O/U</span>
          <span className="sm:hidden">O/U</span>
          {sortKey === 'ou' && (sortAscending ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
        </Button>
        </div>
        
        {/* Refresh and Last Updated */}
        <div className="flex flex-wrap items-center gap-2">
          {lastUpdated && (
            <span className="text-xs sm:text-sm text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <LiquidButton 
            onClick={() => {
              clearCache();
              fetchData();
            }} 
            disabled={loading} 
            variant="outline"
            className="bg-slate-50 dark:bg-muted text-foreground border-border text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2"
          >
            <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </LiquidButton>
        </div>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <br />
            <span className="text-sm text-muted-foreground">
              Check the browser console for more details.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {predictions.length === 0 && !error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold mb-2">No Predictions Found</h3>
              <p className="text-muted-foreground">
                No NBA predictions were found in the database.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6 sm:space-y-8">
        <div className="-mx-4 md:mx-0">
          <div className="grid gap-2 sm:gap-3 md:gap-4 auto-rows-fr" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))' }}>
            {/* AI Value Finds Header - First Card in Grid */}
            {(valueFindsLoading || pageHeaderData) && (
              <PageHeaderValueFinds
                sportType="nba"
                summaryText={pageHeaderData?.summary_text || ''}
                compactPicks={pageHeaderData?.compact_picks || []}
                valueFindId={valueFindId || undefined}
                isPublished={valueFindPublished}
                onTogglePublish={fetchValueFinds}
                onDelete={fetchValueFinds}
                isLoading={valueFindsLoading}
              />
            )}
            {getSortedPredictions()
              .map((prediction, index) => {
              // Freemium logic: Only show first 2 games, blur the rest
              const isLocked = isFreemiumUser && index >= 2;
              const awayTeamColors = getNBATeamColors(prediction.away_team);
              const homeTeamColors = getNBATeamColors(prediction.home_team);
              
              // Get high value badge for this game
              const gameId = prediction.training_key || prediction.unique_id;
              const highValueBadge = highValueBadges.get(gameId);
              
              // Debug log to check what ID fields are available
              if (index === 0) {
                debug.log('🏀 NBA Prediction sample:', {
                  id: prediction.id,
                  unique_id: prediction.unique_id,
                  training_key: prediction.training_key,
                  away_team: prediction.away_team,
                  home_team: prediction.home_team,
                  allKeys: Object.keys(prediction),
                  hasHighValueBadge: !!highValueBadge
                });
              }
              
              return (
                <TooltipProvider key={`tooltip-provider-${prediction.id}`} delayDuration={200}>
                  <div key={prediction.id} className="relative">
                    <NFLGameCard
                      isHovered={focusedCardId === prediction.id && !isLocked}
                      onMouseEnter={() => !isLocked && setFocusedCardId(prediction.id)}
                      onMouseLeave={() => setFocusedCardId(null)}
                      awayTeamColors={awayTeamColors}
                      homeTeamColors={homeTeamColors}
                      homeSpread={prediction.home_spread}
                      awaySpread={prediction.away_spread}
                      className={isLocked ? 'blur-sm opacity-50' : ''}
                    >
                  {/* Star Button for Admin Mode */}
                  <StarButton gameId={prediction.training_key} gameType="nba" />
                  
                  {/* AI Payload Viewer Button for Admin Mode */}
                  {adminModeEnabled && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-14 z-10 bg-purple-500/80 hover:bg-purple-600 border-purple-400 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPayloadGame(prediction);
                        setPayloadViewerOpen(true);
                      }}
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      AI Payload
                    </Button>
                  )}
                
                <CardContent className="space-y-4 sm:space-y-6 pt-4 pb-4 sm:pt-6 sm:pb-6">
                  {/* High Value Badge */}
                  {highValueBadge && !isFreemiumUser && (
                    <div className="flex justify-center -mt-2 mb-2">
                      <HighValueBadge
                        pick={highValueBadge.recommended_pick}
                        confidence={highValueBadge.confidence}
                        tooltipText={highValueBadge.tooltip_text}
                      />
                    </div>
                  )}
                  
                  {/* Game Date and Time */}
                  <div className="text-center space-y-2">
                    <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                      {formatCompactDate(prediction.game_date)}
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-white/80 bg-gray-100/80 dark:bg-white/5 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full border border-gray-300 dark:border-white/20 inline-block">
                      {convertTimeToEST(prediction.game_time)}
                    </div>
                  </div>

                  {/* Team Logos and Betting Info */}
                  <div className="space-y-3 sm:space-y-4 pt-2">
                    <div className="flex justify-between items-start">
                      {/* Away Team */}
                      <div className="text-center flex-1">
                        {(() => {
                          const logoUrl = getTeamLogo(prediction.away_team);
                          const hasLogo = logoUrl && logoUrl !== '/placeholder.svg' && logoUrl.trim() !== '';
                          
                          return (
                            <div className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-2 sm:mb-3 rounded-full flex items-center justify-center border-2 transition-transform duration-200 hover:scale-105 shadow-lg overflow-hidden bg-white dark:bg-gray-800"
                              style={{
                                borderColor: `${awayTeamColors.primary}`,
                                background: hasLogo ? 'transparent' : `linear-gradient(135deg, ${awayTeamColors.primary}, ${awayTeamColors.secondary})`
                              }}
                            >
                              {hasLogo ? (
                                <img 
                                  src={logoUrl} 
                                  alt={prediction.away_team}
                                  className="w-full h-full object-contain p-1"
                                  onError={(e) => {
                                    // Fallback to circle with initials if image fails to load
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent && !parent.querySelector('.fallback-initials')) {
                                      const fallback = document.createElement('span');
                                      fallback.className = 'text-xs sm:text-sm font-bold drop-shadow-md fallback-initials';
                                      fallback.style.color = getContrastingTextColor(awayTeamColors.primary, awayTeamColors.secondary);
                                      fallback.textContent = getTeamInitials(prediction.away_team);
                                      parent.style.background = `linear-gradient(135deg, ${awayTeamColors.primary}, ${awayTeamColors.secondary})`;
                                      parent.appendChild(fallback);
                                    }
                                  }}
                                />
                              ) : (
                                <span 
                                  className="text-xs sm:text-sm font-bold drop-shadow-md"
                                  style={{ color: getContrastingTextColor(awayTeamColors.primary, awayTeamColors.secondary) }}
                                >
                                  {getTeamInitials(prediction.away_team)}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-0.5">
                          {getFullTeamName(prediction.away_team).city}
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-gray-600 dark:text-white/70 mb-2">
                          {getFullTeamName(prediction.away_team).name}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500 dark:text-white/60 mb-1">
                          Spread: {formatSpread(prediction.away_spread)}
                        </div>
                        <div className="text-sm sm:text-base font-bold text-blue-600 dark:text-blue-400">
                          {formatMoneyline(prediction.away_ml)}
                        </div>
                      </div>

                      {/* @ Symbol and Total */}
                      <div className="text-center px-2 sm:px-4 flex flex-col items-center justify-center">
                        <span className="text-4xl sm:text-5xl font-bold text-gray-300 dark:text-white/40 mb-2 sm:mb-3">@</span>
                        <div className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-white bg-gray-100/80 dark:bg-white/5 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full border border-gray-300 dark:border-white/20">
                          Total: {prediction.over_line || '-'}
                        </div>
                      </div>

                      {/* Home Team */}
                      <div className="text-center flex-1">
                        {(() => {
                          const logoUrl = getTeamLogo(prediction.home_team);
                          const hasLogo = logoUrl && logoUrl !== '/placeholder.svg' && logoUrl.trim() !== '';
                          
                          return (
                            <div className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-2 sm:mb-3 rounded-full flex items-center justify-center border-2 transition-transform duration-200 hover:scale-105 shadow-lg overflow-hidden bg-white dark:bg-gray-800"
                              style={{
                                borderColor: `${homeTeamColors.primary}`,
                                background: hasLogo ? 'transparent' : `linear-gradient(135deg, ${homeTeamColors.primary}, ${homeTeamColors.secondary})`
                              }}
                            >
                              {hasLogo ? (
                                <img 
                                  src={logoUrl} 
                                  alt={prediction.home_team}
                                  className="w-full h-full object-contain p-1"
                                  onError={(e) => {
                                    // Fallback to circle with initials if image fails to load
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent && !parent.querySelector('.fallback-initials')) {
                                      const fallback = document.createElement('span');
                                      fallback.className = 'text-xs sm:text-sm font-bold drop-shadow-md fallback-initials';
                                      fallback.style.color = getContrastingTextColor(homeTeamColors.primary, homeTeamColors.secondary);
                                      fallback.textContent = getTeamInitials(prediction.home_team);
                                      parent.style.background = `linear-gradient(135deg, ${homeTeamColors.primary}, ${homeTeamColors.secondary})`;
                                      parent.appendChild(fallback);
                                    }
                                  }}
                                />
                              ) : (
                                <span 
                                  className="text-xs sm:text-sm font-bold drop-shadow-md"
                                  style={{ color: getContrastingTextColor(homeTeamColors.primary, homeTeamColors.secondary) }}
                                >
                                  {getTeamInitials(prediction.home_team)}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-0.5">
                          {getFullTeamName(prediction.home_team).city}
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-gray-600 dark:text-white/70 mb-2">
                          {getFullTeamName(prediction.home_team).name}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500 dark:text-white/60 mb-1">
                          Spread: {formatSpread(prediction.home_spread)}
                        </div>
                        <div className="text-sm sm:text-base font-bold text-green-600 dark:text-green-400">
                          {formatMoneyline(prediction.home_ml)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Polymarket Widget */}
                  <div 
                    className="pt-4"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{ pointerEvents: 'auto', isolation: 'isolate' }}
                  >
                    <PolymarketWidget
                      awayTeam={prediction.away_team}
                      homeTeam={prediction.home_team}
                      gameDate={prediction.game_date}
                      awayTeamColors={awayTeamColors}
                      homeTeamColors={homeTeamColors}
                      league="nba"
                      compact={true}
                    />
                  </div>

                  {/* Compact Model Predictions - Always shown */}
                  {(
                    <div className="pt-3 sm:pt-4">
                      {/* Header */}
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Model Predictions</h4>
                      </div>
                      <div className="flex flex-wrap gap-3 justify-center items-start">
                        {/* Spread Edge - Show edge value (delta) like College Basketball */}
                        {(() => {
                          const edgeInfo = getEdgeInfo(prediction.home_spread_diff ?? null, prediction.away_team, prediction.home_team);
                          if (!edgeInfo) return null;
                          
                          const edgeValue = edgeInfo.edgeValue;
                          const confidenceColor = edgeValue >= 7 ? 'bg-green-500' : edgeValue >= 3 ? 'bg-orange-500' : 'bg-gray-500';
                          
                          return (
                            <div className={`${confidenceColor} text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap`}>
                              <Target className="h-3 w-3" />
                              <span>Edge to {getTeamInitials(edgeInfo.teamName)} +{edgeInfo.displayEdge}</span>
                            </div>
                          );
                        })()}
                        {showNFLMoneylinePills && prediction.home_away_ml_prob !== null && (() => {
                          const isHome = prediction.home_away_ml_prob > 0.5;
                          const predictedTeam = isHome ? prediction.home_team : prediction.away_team;
                          const confidencePct = Math.round((isHome ? prediction.home_away_ml_prob : 1 - prediction.home_away_ml_prob) * 100);
                          const confidenceColor = confidencePct >= 65 ? 'bg-blue-500' : confidencePct >= 58 ? 'bg-indigo-500' : 'bg-gray-500';
                          const isFadeAlert = confidencePct >= 80;
                          
                          const pillContent = (
                            <div className={`${isFadeAlert ? 'bg-blue-500/80 backdrop-blur-md' : confidenceColor} text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap`}>
                              <Users className="h-3 w-3" />
                              <span>{getTeamInitials(predictedTeam)} ML {confidencePct}%</span>
                            </div>
                          );
                          
                          return isFadeAlert ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex flex-col items-center gap-1.5 cursor-help">
                                  <MovingBorderButton
                                    borderRadius="1.5rem"
                                    containerClassName="h-auto w-auto p-0"
                                    className="bg-transparent p-0 border-0 m-0"
                                    borderClassName="bg-[radial-gradient(#3b82f6_40%,transparent_60%)]"
                                    duration={2000}
                                    as="div"
                                  >
                                    {pillContent}
                                  </MovingBorderButton>
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                    <Zap className="h-3 w-3 fill-blue-600 dark:fill-blue-400" />
                                    <span>FADE ALERT</span>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent 
                                side="top" 
                                className="max-w-xs p-3 pr-6 bg-gray-900 dark:bg-gray-800 border-gray-700 dark:border-gray-600"
                                sideOffset={8}
                                avoidCollisions={true}
                                collisionPadding={8}
                                style={{ 
                                  zIndex: 99999
                                }}
                              >
                                <p className="text-sm text-white dark:text-gray-100 leading-relaxed">
                                  When a model shows extreme confidence (80%+), it may be overreacting to a single factor. Consider analyzing other factors and potentially fading (betting against) this prediction.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ) : pillContent;
                        })()}
                        {/* Over/Under Edge - Show edge value (delta) like College Basketball */}
                        {prediction.over_line_diff !== null && (() => {
                          const isOver = prediction.over_line_diff > 0;
                          const magnitude = Math.abs(prediction.over_line_diff);
                          const displayMagnitude = roundToNearestHalf(magnitude).toString();
                          // Over = green, Under = red, 0 edge = gray
                          const confidenceColor = magnitude === 0 || magnitude < 0.1 ? 'bg-gray-500' : (isOver ? 'bg-green-500' : 'bg-red-500');
                          
                          return (
                            <div className={`${confidenceColor} text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap`}>
                              <BarChart className="h-3 w-3" />
                              <span>Edge to {isOver ? 'Over' : 'Under'} +{displayMagnitude}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Expand/Collapse Button */}
                  <div className="pt-4 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (isFreemiumUser) {
                          // Prevent modal opening for freemium users
                          return;
                        }
                        setSelectedGameForModal(prediction);
                      }}
                      disabled={isFreemiumUser}
                      className="text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      title={isFreemiumUser ? "Subscribe to view details" : ""}
                    >
                      {isFreemiumUser ? (
                        <>
                          <Lock className="h-4 w-4 mr-1" />
                          Upgrade to View Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Show More Details
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
                
                <CardFooter className="pt-0 pb-4">
                  <GameTailSection
                    gameUniqueId={prediction.training_key || prediction.unique_id}
                    sport="nba"
                    homeTeam={prediction.home_team}
                    awayTeam={prediction.away_team}
                    lines={{
                      home_ml: prediction.home_ml,
                      away_ml: prediction.away_ml,
                      home_spread: prediction.home_spread,
                      away_spread: prediction.away_spread,
                      total: prediction.over_line,
                    }}
                    compact
                  />
                </CardFooter>
              </NFLGameCard>
              
              {/* Lock Overlay for Freemium Users */}
              {isLocked && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/60 backdrop-blur-sm rounded-full p-4">
                    <Lock className="w-8 h-8 text-white" />
                  </div>
                </div>
              )}
            </div>
          </TooltipProvider>
            );
            })}
          </div>
        </div>
      </div>

      {predictions.length > 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Showing {getSortedPredictions().length} of {predictions.length} predictions
            {searchQuery && ` (filtered by "${searchQuery}")`}
          </p>
        </div>
      )}

      {/* Game Details Modal */}
      <GameDetailsModal
        isOpen={selectedGameForModal !== null}
        onClose={() => setSelectedGameForModal(null)}
        prediction={selectedGameForModal}
        league="nba"
        aiCompletions={aiCompletions}
        simLoadingById={simLoadingById}
        simRevealedById={simRevealedById}
        setSimLoadingById={setSimLoadingById}
        setSimRevealedById={setSimRevealedById}
        focusedCardId={focusedCardId}
        getTeamInitials={getTeamInitials}
        getContrastingTextColor={getContrastingTextColor}
        getFullTeamName={getFullTeamName}
        formatSpread={formatSpread}
        parseBettingSplit={parseBettingSplit}
        expandedBettingFacts={expandedBettingFacts}
        setExpandedBettingFacts={setExpandedBettingFacts}
        teamMappings={teamMappings as any}
      />

      {/* Mini WagerBot Chat */}
      <MiniWagerBotChat pageContext={nbaContext} pageId="nba" />
      
      {/* Freemium Upgrade Banner */}
      {isFreemiumUser && predictions.length > 0 && (
        <FreemiumUpgradeBanner 
          totalGames={predictions.length} 
          visibleGames={Math.min(2, predictions.length)} 
        />
      )}
      
      {/* AI Payload Viewer Modal */}
      {selectedPayloadGame && (
        <AIPayloadViewer
          open={payloadViewerOpen}
          onOpenChange={setPayloadViewerOpen}
          game={selectedPayloadGame}
          sportType={"nba" as any}
          onCompletionGenerated={handleCompletionGenerated} // Refreshes completions after generation
        />
      )}
    </div>
  );
}
