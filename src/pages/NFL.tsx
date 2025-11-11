import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertCircle, History, TrendingUp, BarChart, ScatterChart, Brain, Target, Users, CloudRain, Calendar, Clock, Info, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';
import debug from '@/utils/debug';
import { LiquidButton } from '@/components/animate-ui/components/buttons/liquid';
import { Link } from 'react-router-dom';
import NFLGameCard from '@/components/NFLGameCard';
import { BackgroundGradient } from '@/components/ui/background-gradient';
import { MiniWagerBotChat } from '@/components/MiniWagerBotChat';
import { StarButton } from '@/components/StarButton';
import { useAuth } from '@/contexts/AuthContext';
import { chatSessionManager } from '@/utils/chatSession';
import { WeatherIcon as WeatherIconComponent, IconWind } from '@/utils/weatherIcons';
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

interface NFLPrediction {
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
  // Model predictions (EPA model)
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  run_id: string | null;
  // Weather data
  temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  icon: string | null;
  // Public betting splits - using label columns
  spread_splits_label: string | null;
  total_splits_label: string | null;
  ml_splits_label: string | null;
}

interface TeamMapping {
  city_and_name: string;
  team_name: string;
  logo_url: string;
}

export default function NFL() {
  const { user } = useAuth();
  const { isFreemiumUser } = useFreemiumAccess();
  const { adminModeEnabled } = useAdminMode();
  const { showNFLMoneylinePills } = useDisplaySettings();
  const [predictions, setPredictions] = useState<NFLPrediction[]>([]);
  const [teamMappings, setTeamMappings] = useState<TeamMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(['All Games']);
  const [sortKey, setSortKey] = useState<'none' | 'ml' | 'spread' | 'ou'>('none');
  
  // AI Completion state
  const [aiCompletions, setAiCompletions] = useState<Record<string, Record<string, string>>>({});
  const [payloadViewerOpen, setPayloadViewerOpen] = useState(false);
  const [selectedPayloadGame, setSelectedPayloadGame] = useState<NFLPrediction | null>(null);
  
  // Value Finds state
  const [highValueBadges, setHighValueBadges] = useState<Map<string, any>>(new Map());
  const [pageHeaderData, setPageHeaderData] = useState<{ summary_text: string; compact_picks: any[] } | null>(null);
  const [valueFindId, setValueFindId] = useState<string | null>(null);
  const [valueFindPublished, setValueFindPublished] = useState<boolean>(false);
  
  // Focused card state for light beams effect
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [sortAscending, setSortAscending] = useState<boolean>(false);
  
  // Public Betting Facts expanded state - tracks which cards have expanded betting facts
  const [expandedBettingFacts, setExpandedBettingFacts] = useState<Record<string, boolean>>({});
  
  // Modal state - tracks which game is selected for modal
  const [selectedGameForModal, setSelectedGameForModal] = useState<NFLPrediction | null>(null);
  
  // Match simulator UI states per game id
  const [simLoadingById, setSimLoadingById] = useState<Record<string, boolean>>({});
  const [simRevealedById, setSimRevealedById] = useState<Record<string, boolean>>({});
  
  // Track predictions viewed when loaded
  useEffect(() => {
    if (!loading && predictions.length > 0) {
      trackPredictionViewed('NFL', predictions.length, activeFilters.join(','), sortKey);
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
      const [badges, headerData] = await Promise.all([
        getHighValueBadges('nfl'),
        getPageHeaderData('nfl', adminModeEnabled), // Pass admin mode to include unpublished data
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
  const buildNFLContext = (preds: NFLPrediction[]): string => {
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

**Weather:** ${pred.temperature ? pred.temperature + '°F' : 'N/A'}, Wind: ${pred.wind_speed ? pred.wind_speed + ' mph' : 'N/A'}

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
      
      return `# 🏈 NFL Games Data

I have access to **${preds.length} total games**. Here's the detailed breakdown:

${contextParts}

*Note: Probabilities are from the EPA model. I can help you analyze these matchups, identify value opportunities, and answer questions about specific games.*`;
    } catch (error) {
      debug.error('Error building NFL context:', error);
      return ''; // Return empty string if there's an error
    }
  };

  // Memoize the context to prevent infinite re-renders
  // Use predictions.length and first game ID as dependency to avoid array reference issues
  const nflContext = useMemo(() => {
    const context = buildNFLContext(predictions);
    
    // Debug logging for context - Show what we're sending to the AI
    if (context && predictions.length > 0) {
      debug.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #3b82f6; font-weight: bold');
      debug.log('%c🏈 NFL - DATA SENT TO AI', 'color: #3b82f6; font-weight: bold; font-size: 14px');
      debug.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #3b82f6; font-weight: bold');
      debug.log(`\n📈 Total Games: ${predictions.length}\n`);
      
      // Show summary of each game
      predictions.slice(0, 10).forEach((pred, idx) => {
        const gameDate = pred.game_date ? new Date(pred.game_date).toLocaleDateString() : 'TBD';
        const gameTime = pred.game_time || 'TBD';
        debug.log(`%c🏈 Game ${idx + 1}: ${pred.away_team} @ ${pred.home_team}`, 'color: #f59e0b; font-weight: bold');
        debug.log(`   📅 Date/Time: ${gameDate} ${gameTime}`);
        debug.log(`   📊 Lines:`);
        debug.log(`      • Spread: ${pred.home_team} ${pred.home_spread || 'N/A'}`);
        debug.log(`      • Moneyline: Away ${pred.away_ml || 'N/A'} / Home ${pred.home_ml || 'N/A'}`);
        debug.log(`      • Over/Under: ${pred.over_line || 'N/A'}`);
        debug.log(`   🤖 Model Predictions (EPA Model):`);
        debug.log(`      • ML Probability: ${pred.home_away_ml_prob ? (pred.home_away_ml_prob * 100).toFixed(1) + '%' : 'N/A'}`);
        debug.log(`      • Spread Cover Prob: ${pred.home_away_spread_cover_prob ? (pred.home_away_spread_cover_prob * 100).toFixed(1) + '%' : 'N/A'}`);
        debug.log(`      • O/U Probability: ${pred.ou_result_prob ? (pred.ou_result_prob * 100).toFixed(1) + '%' : 'N/A'}`);
        debug.log(`   ⛅ Weather: ${pred.temperature || 'N/A'}°F, Wind: ${pred.wind_speed || 'N/A'} mph`);
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

  // Check if a game should be displayed based on active filters
  const shouldDisplayGame = (prediction: NFLPrediction): boolean => {
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
        chatSessionManager.clearPageSession(user.id, 'nfl');
      }
      
      debug.log('Fetching NFL data...');
      
      // Step 1: Fetch ALL games from v_input_values_with_epa - this view updates on new week start
      debug.log('📊 Querying v_input_values_with_epa for all current week games...');
      const { data: nflGames, error: gamesError } = await collegeFootballSupabase
        .from('v_input_values_with_epa')
        .select('*')
        .order('game_date', { ascending: true })
        .order('game_time', { ascending: true });

      if (gamesError) {
        debug.error('Error fetching NFL games from v_input_values_with_epa:', gamesError);
        setError(`Games error: ${gamesError.message}`);
        setLoading(false);
        return;
      }

      debug.log('✅ NFL games fetched from v_input_values_with_epa:', nflGames?.length || 0);
      
      // Step 2: Fetch predictions from nfl_predictions_epa (latest run_id)
      debug.log('📊 Fetching model predictions from nfl_predictions_epa...');
      const { data: latestRun, error: runError } = await collegeFootballSupabase
        .from('nfl_predictions_epa')
        .select('run_id')
        .order('run_id', { ascending: false })
        .limit(1)
        .single();

      let predictionsMap = new Map();
      
      if (!runError && latestRun) {
        debug.log('Latest run_id:', latestRun.run_id);
        const { data: predictions, error: predsError } = await collegeFootballSupabase
          .from('nfl_predictions_epa')
          .select('training_key, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, run_id')
          .eq('run_id', latestRun.run_id);

        if (!predsError && predictions) {
          debug.log('✅ Predictions fetched:', predictions.length);
          predictions.forEach(pred => {
            predictionsMap.set(pred.training_key, pred);
          });
        } else {
          debug.warn('No predictions found or error:', predsError);
        }
      } else {
        debug.warn('No prediction run_id found');
      }
      
      // Step 2.5: Fetch betting lines for moneylines and public splits
      debug.log('📊 Fetching betting lines for ML and public splits...');
      const { data: bettingLines, error: bettingError } = await collegeFootballSupabase
        .from('nfl_betting_lines')
        .select('training_key, home_ml, away_ml, over_line, spread_splits_label, ml_splits_label, total_splits_label, as_of_ts')
        .order('as_of_ts', { ascending: false });

      let bettingLinesMap = new Map();
      
      if (!bettingError && bettingLines) {
        debug.log('✅ Betting lines fetched:', bettingLines.length);
        // Get most recent line per training_key
        bettingLines.forEach(line => {
          if (!bettingLinesMap.has(line.training_key)) {
            bettingLinesMap.set(line.training_key, line);
          }
        });
        debug.log('Unique betting lines:', bettingLinesMap.size);
      } else {
        debug.warn('No betting lines found or error:', bettingError);
      }
      
      // Step 3: Fetch team mappings for logos
      const { data: teamMappingsData, error: teamMappingsError } = await collegeFootballSupabase
        .from('nfl_team_mapping')
        .select('city_and_name, team_name');
      
      if (teamMappingsError) {
        debug.error('Error fetching team mappings:', teamMappingsError);
      } else {
        debug.log('✅ Team mappings fetched:', teamMappingsData?.length);
      }
      
      const teamMappings = (teamMappingsData || []).map(team => ({
        ...team,
        logo_url: getNFLTeamLogo(team.team_name)
      }));
      
      setTeamMappings(teamMappings);

      // Step 4: Merge games with predictions and betting lines
      // home_away_unique in v_input_values_with_epa = training_key in nfl_predictions_epa and nfl_betting_lines
      const predictionsWithData = (nflGames || []).map(game => {
        const prediction = predictionsMap.get(game.home_away_unique);
        const bettingLine = bettingLinesMap.get(game.home_away_unique);
        
        return {
          ...game,
          id: game.home_away_unique || `${game.home_team}_${game.away_team}_${game.game_date}`,
          training_key: game.home_away_unique,
          unique_id: game.home_away_unique,
          // Add prediction probabilities if available
          home_away_ml_prob: prediction?.home_away_ml_prob || null,
          home_away_spread_cover_prob: prediction?.home_away_spread_cover_prob || null,
          ou_result_prob: prediction?.ou_result_prob || null,
          run_id: prediction?.run_id || null,
          // Add Vegas lines from betting_lines table
          home_ml: bettingLine?.home_ml || null,
          away_ml: bettingLine?.away_ml || null,
          over_line: bettingLine?.over_line || game.ou_vegas_line || null,
          // Add public betting splits
          spread_splits_label: bettingLine?.spread_splits_label || null,
          ml_splits_label: bettingLine?.ml_splits_label || null,
          total_splits_label: bettingLine?.total_splits_label || null,
        };
      });

      debug.log(`✅ Showing ALL ${predictionsWithData.length} games (${predictionsMap.size} have predictions)`);

      setPredictions(predictionsWithData);
      setLastUpdated(new Date());
    } catch (err) {
      debug.error('Error fetching data:', err);
      setError(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch AI completions for all games
  const fetchAICompletions = async (games: NFLPrediction[]) => {
    // Check if completions are enabled
    if (!areCompletionsEnabled('nfl')) {
      debug.log('NFL completions are disabled via emergency toggle, skipping fetch');
      setAiCompletions({});
      return;
    }
    
    debug.log('Fetching AI completions for', games.length, 'games');
    const completionsMap: Record<string, Record<string, string>> = {};
    
    for (const game of games) {
      const gameId = game.training_key || game.unique_id;
      try {
        const completions = await getGameCompletions(gameId, 'nfl');
        if (Object.keys(completions).length > 0) {
          completionsMap[gameId] = completions;
        }
      } catch (error) {
        debug.error(`Error fetching completions for ${gameId}:`, error);
      }
    }
    
    debug.log('AI completions fetched:', Object.keys(completionsMap).length, 'games have completions');
    setAiCompletions(completionsMap);
  };

  // Refresh completions after generating a new one
  const handleCompletionGenerated = async (gameId: string, widgetType: string) => {
    debug.log('Completion generated, refreshing for game:', gameId);
    try {
      const completions = await getGameCompletions(gameId, 'nfl');
      setAiCompletions(prev => ({
        ...prev,
        [gameId]: completions
      }));
    } catch (error) {
      debug.error(`Error refreshing completions for ${gameId}:`, error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  // Fetch AI completions when predictions are loaded
  useEffect(() => {
    if (predictions.length > 0) {
      fetchAICompletions(predictions);
    }
  }, [predictions]);

  // Function to get team initials for circle display
  const getTeamInitials = (teamCity: string): string => {
    const initialsMap: { [key: string]: string } = {
      'Arizona': 'ARI',
      'Atlanta': 'ATL',
      'Baltimore': 'BAL',
      'Buffalo': 'BUF',
      'Carolina': 'CAR',
      'Chicago': 'CHI',
      'Cincinnati': 'CIN',
      'Cleveland': 'CLE',
      'Dallas': 'DAL',
      'Denver': 'DEN',
      'Detroit': 'DET',
      'Green Bay': 'GB',
      'Houston': 'HOU',
      'Indianapolis': 'IND',
      'Jacksonville': 'JAX',
      'Kansas City': 'KC',
      'Las Vegas': 'LV',
      'Los Angeles Chargers': 'LAC',
      'Los Angeles Rams': 'LAR',
      'LA Chargers': 'LAC',
      'LA Rams': 'LAR',
      'Miami': 'MIA',
      'Minnesota': 'MIN',
      'New England': 'NE',
      'New Orleans': 'NO',
      'NY Giants': 'NYG',
      'NY Jets': 'NYJ',
      'Philadelphia': 'PHI',
      'Pittsburgh': 'PIT',
      'San Francisco': 'SF',
      'Seattle': 'SEA',
      'Tampa Bay': 'TB',
      'Tennessee': 'TEN',
      'Washington': 'WSH',
    };
    return initialsMap[teamCity] || teamCity.substring(0, 3).toUpperCase();
  };

  // Function to get full team name (city + team name)
  const getFullTeamName = (teamCity: string): { city: string; name: string } => {
    const teamNameMap: { [key: string]: string } = {
      'Arizona': 'Cardinals',
      'Atlanta': 'Falcons',
      'Baltimore': 'Ravens',
      'Buffalo': 'Bills',
      'Carolina': 'Panthers',
      'Chicago': 'Bears',
      'Cincinnati': 'Bengals',
      'Cleveland': 'Browns',
      'Dallas': 'Cowboys',
      'Denver': 'Broncos',
      'Detroit': 'Lions',
      'Green Bay': 'Packers',
      'Houston': 'Texans',
      'Indianapolis': 'Colts',
      'Jacksonville': 'Jaguars',
      'Kansas City': 'Chiefs',
      'Las Vegas': 'Raiders',
      'Los Angeles Chargers': 'Chargers',
      'Los Angeles Rams': 'Rams',
      'LA Chargers': 'Chargers',
      'LA Rams': 'Rams',
      'Miami': 'Dolphins',
      'Minnesota': 'Vikings',
      'New England': 'Patriots',
      'New Orleans': 'Saints',
      'NY Giants': 'Giants',
      'NY Jets': 'Jets',
      'Philadelphia': 'Eagles',
      'Pittsburgh': 'Steelers',
      'San Francisco': '49ers',
      'Seattle': 'Seahawks',
      'Tampa Bay': 'Buccaneers',
      'Tennessee': 'Titans',
      'Washington': 'Commanders',
    };
    return {
      city: teamCity,
      name: teamNameMap[teamCity] || ''
    };
  };

  // Function to get NFL team colors
  const getNFLTeamColors = (teamName: string): { primary: string; secondary: string } => {
    const colorMap: { [key: string]: { primary: string; secondary: string } } = {
      'Arizona': { primary: '#97233F', secondary: '#000000' },
      'Atlanta': { primary: '#A71930', secondary: '#000000' },
      'Baltimore': { primary: '#241773', secondary: '#9E7C0C' },
      'Buffalo': { primary: '#00338D', secondary: '#C60C30' },
      'Carolina': { primary: '#0085CA', secondary: '#101820' },
      'Chicago': { primary: '#0B162A', secondary: '#C83803' },
      'Cincinnati': { primary: '#FB4F14', secondary: '#000000' },
      'Cleveland': { primary: '#311D00', secondary: '#FF3C00' },
      'Dallas': { primary: '#003594', secondary: '#869397' },
      'Denver': { primary: '#FB4F14', secondary: '#002244' },
      'Detroit': { primary: '#0076B6', secondary: '#B0B7BC' },
      'Green Bay': { primary: '#203731', secondary: '#FFB612' },
      'Houston': { primary: '#03202F', secondary: '#A71930' },
      'Indianapolis': { primary: '#002C5F', secondary: '#A2AAAD' },
      'Jacksonville': { primary: '#101820', secondary: '#D7A22A' },
      'Kansas City': { primary: '#E31837', secondary: '#FFB81C' },
      'Las Vegas': { primary: '#000000', secondary: '#A5ACAF' },
      'Los Angeles Chargers': { primary: '#0080C6', secondary: '#FFC20E' },
      'Los Angeles Rams': { primary: '#003594', secondary: '#FFA300' },
      'LA Chargers': { primary: '#0080C6', secondary: '#FFC20E' },
      'LA Rams': { primary: '#003594', secondary: '#FFA300' },
      'Miami': { primary: '#008E97', secondary: '#FC4C02' },
      'Minnesota': { primary: '#4F2683', secondary: '#FFC62F' },
      'New England': { primary: '#002244', secondary: '#C60C30' },
      'New Orleans': { primary: '#101820', secondary: '#D3BC8D' },
      'NY Giants': { primary: '#0B2265', secondary: '#A71930' },
      'NY Jets': { primary: '#125740', secondary: '#000000' },
      'Philadelphia': { primary: '#004C54', secondary: '#A5ACAF' },
      'Pittsburgh': { primary: '#FFB612', secondary: '#101820' },
      'San Francisco': { primary: '#AA0000', secondary: '#B3995D' },
      'Seattle': { primary: '#002244', secondary: '#69BE28' },
      'Tampa Bay': { primary: '#D50A0A', secondary: '#FF7900' },
      'Tennessee': { primary: '#0C2340', secondary: '#4B92DB' },
      'Washington': { primary: '#5A1414', secondary: '#FFB612' },
    };
    return colorMap[teamName] || { primary: '#6B7280', secondary: '#9CA3AF' };
  };

  // Function to get NFL team logo URLs
  const getNFLTeamLogo = (teamName: string): string => {
    const logoMap: { [key: string]: string } = {
      'Arizona': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
      'Atlanta': 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
      'Baltimore': 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
      'Buffalo': 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
      'Carolina': 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
      'Chicago': 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
      'Cincinnati': 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
      'Cleveland': 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
      'Dallas': 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
      'Denver': 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
      'Detroit': 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
      'Green Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
      'Houston': 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
      'Indianapolis': 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
      'Jacksonville': 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
      'Kansas City': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
      'Las Vegas': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
      'Los Angeles Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
      'Los Angeles Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
      'LA Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
      'LA Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
      'Miami': 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
      'Minnesota': 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
      'New England': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
      'New Orleans': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
      'NY Giants': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
      'NY Jets': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
      'Philadelphia': 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
      'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
      'San Francisco': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
      'Seattle': 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
      'Tampa Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
      'Tennessee': 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
      'Washington': 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
    };
    return logoMap[teamName] || '/placeholder.svg';
  };

  const getTeamLogo = (teamName: string): string => {
    const mapping = teamMappings.find(m => m.team_name === teamName);
    debug.log(`Looking for logo for team: ${teamName}, found mapping:`, mapping);
    return mapping?.logo_url || '/placeholder.svg';
  };

  // Weather display component using Tabler icons
  const WeatherIcon = ({ iconCode, temperature, windSpeed }: { 
    iconCode: string | null; 
    temperature: number | null; 
    windSpeed: number | null; 
  }) => {
    if (!iconCode) return null;

    return (
      <div className="text-center">
        <div className="flex items-center justify-center space-x-4 mb-2">
          <div className="w-16 h-16 flex items-center justify-center">
            <WeatherIconComponent 
              code={iconCode}
              size={64}
              className="stroke-current text-gray-800 dark:text-white"
            />
          </div>

          {temperature !== null && (
            <div className="text-lg font-bold text-gray-900 dark:text-white min-w-[60px] text-center">
              {Math.round(temperature)}°F
            </div>
          )}

          {windSpeed !== null && windSpeed > 0 && (
            <div className="flex items-center space-x-2 min-w-[70px]">
              <IconWind size={24} className="stroke-current text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-white/80">
                {Math.round(windSpeed)} mph
              </span>
            </div>
          )}
        </div>
        
        <div className="text-xs font-medium text-gray-600 dark:text-white/70 capitalize">
          {iconCode.replace(/-/g, ' ')}
        </div>
      </div>
    );
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

  const convertTimeToEST = (timeString: string): string => {
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      
      // Add 4 hours to convert UTC to EST
      const estHours = hours + 4;
      
      // Handle day overflow (if hours go past 24)
      const finalHours = estHours >= 24 ? estHours - 24 : estHours;
      
      // Create a date object for today with the adjusted time
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const day = today.getDate();
      
      const estDate = new Date(year, month, day, finalHours, minutes, 0);
      
      // Format as EST time
      return estDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }) + ' EST';
    } catch (error) {
      debug.error('Error formatting time:', error);
      return timeString;
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
  const getSortedPredictions = (): NFLPrediction[] => {
    const list = predictions.filter(shouldDisplayGame);
    const byDateTime = (a: NFLPrediction, b: NFLPrediction) => {
      const dateComparison = a.game_date.localeCompare(b.game_date);
      if (dateComparison !== 0) return dateComparison;
      return a.game_time.localeCompare(b.game_time);
    };
    if (sortKey === 'none') {
      const sorted = [...list].sort(byDateTime);
      return sortAscending ? sorted.reverse() : sorted;
    }
    const score = (p: NFLPrediction): number => {
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


  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">NFL</h1>
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
            onClick={fetchData} 
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
                No NFL predictions were found in the database.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Value Finds Header */}
      {pageHeaderData && (
        <PageHeaderValueFinds
          sportType="nfl"
          summaryText={pageHeaderData.summary_text}
          compactPicks={pageHeaderData.compact_picks}
          valueFindId={valueFindId || undefined}
          isPublished={valueFindPublished}
          onTogglePublish={fetchValueFinds}
          onDelete={fetchValueFinds}
        />
      )}

      <div className="space-y-6 sm:space-y-8">
        <div className="-mx-4 md:mx-0">
          <div className="grid gap-2 sm:gap-3 md:gap-4 auto-rows-fr" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))' }}>
            {getSortedPredictions()
              .map((prediction, index) => {
              // Freemium logic: Only show first 2 games, blur the rest
              const isLocked = isFreemiumUser && index >= 2;
              const awayTeamColors = getNFLTeamColors(prediction.away_team);
              const homeTeamColors = getNFLTeamColors(prediction.home_team);
              
              // Get high value badge for this game
              const gameId = prediction.training_key || prediction.unique_id;
              const highValueBadge = highValueBadges.get(gameId);
              
              // Debug log to check what ID fields are available
              if (index === 0) {
                debug.log('🏈 NFL Prediction sample:', {
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
                  <StarButton gameId={prediction.training_key} gameType="nfl" />
                  
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
                        {/* Logo kept in code for color reference: {getTeamLogo(prediction.away_team)} */}
                        <div 
                          className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-2 sm:mb-3 rounded-full flex items-center justify-center border-2 transition-transform duration-200 hover:scale-105 shadow-lg"
                          style={{
                            background: `linear-gradient(135deg, ${awayTeamColors.primary}, ${awayTeamColors.secondary})`,
                            borderColor: `${awayTeamColors.primary}`
                          }}
                        >
                          <span 
                            className="text-xs sm:text-sm font-bold drop-shadow-md"
                            style={{ color: getContrastingTextColor(awayTeamColors.primary, awayTeamColors.secondary) }}
                          >
                            {getTeamInitials(prediction.away_team)}
                          </span>
                        </div>
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
                        {/* Logo kept in code for color reference: {getTeamLogo(prediction.home_team)} */}
                        <div 
                          className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-2 sm:mb-3 rounded-full flex items-center justify-center border-2 transition-transform duration-200 hover:scale-105 shadow-lg"
                          style={{
                            background: `linear-gradient(135deg, ${homeTeamColors.primary}, ${homeTeamColors.secondary})`,
                            borderColor: `${homeTeamColors.primary}`
                          }}
                        >
                          <span 
                            className="text-xs sm:text-sm font-bold drop-shadow-md"
                            style={{ color: getContrastingTextColor(homeTeamColors.primary, homeTeamColors.secondary) }}
                          >
                            {getTeamInitials(prediction.home_team)}
                          </span>
                        </div>
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
                      league="nfl"
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
                      <div className="flex flex-wrap gap-2 justify-center">
                        {prediction.home_away_spread_cover_prob !== null && (() => {
                          const isHome = prediction.home_away_spread_cover_prob > 0.5;
                          const predictedTeam = isHome ? prediction.home_team : prediction.away_team;
                          const confidencePct = Math.round((isHome ? prediction.home_away_spread_cover_prob : 1 - prediction.home_away_spread_cover_prob) * 100);
                          const confidenceColor = confidencePct >= 65 ? 'bg-green-500' : confidencePct >= 58 ? 'bg-orange-500' : 'bg-red-500';
                          return (
                            <div className={`${confidenceColor} text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5`}>
                              <Target className="h-3 w-3" />
                              <span>{getTeamInitials(predictedTeam)} Spread {confidencePct}%</span>
                            </div>
                          );
                        })()}
                        {showNFLMoneylinePills && prediction.home_away_ml_prob !== null && (() => {
                          const isHome = prediction.home_away_ml_prob > 0.5;
                          const predictedTeam = isHome ? prediction.home_team : prediction.away_team;
                          const confidencePct = Math.round((isHome ? prediction.home_away_ml_prob : 1 - prediction.home_away_ml_prob) * 100);
                          const confidenceColor = confidencePct >= 65 ? 'bg-blue-500' : confidencePct >= 58 ? 'bg-indigo-500' : 'bg-gray-500';
                          return (
                            <div className={`${confidenceColor} text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5`}>
                              <Users className="h-3 w-3" />
                              <span>{getTeamInitials(predictedTeam)} ML {confidencePct}%</span>
                            </div>
                          );
                        })()}
                        {prediction.ou_result_prob !== null && (() => {
                          const isOver = prediction.ou_result_prob > 0.5;
                          const confidencePct = Math.round((isOver ? prediction.ou_result_prob : 1 - prediction.ou_result_prob) * 100);
                          const confidenceColor = confidencePct >= 65 ? 'bg-purple-500' : confidencePct >= 58 ? 'bg-pink-500' : 'bg-gray-500';
                          return (
                            <div className={`${confidenceColor} text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5`}>
                              <BarChart className="h-3 w-3" />
                              <span>{isOver ? 'Over' : 'Under'} {confidencePct}%</span>
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
                    sport="nfl"
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
            );
            })}
          </div>
        </div>
      </div>

      {predictions.length > 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Showing {predictions.length} predictions
          </p>
        </div>
      )}

      {/* Game Details Modal */}
      <GameDetailsModal
        isOpen={selectedGameForModal !== null}
        onClose={() => setSelectedGameForModal(null)}
        prediction={selectedGameForModal}
        league="nfl"
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
        teamMappings={teamMappings}
      />

      {/* Mini WagerBot Chat */}
      <MiniWagerBotChat pageContext={nflContext} pageId="nfl" />
      
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
          sportType="nfl"
          onCompletionGenerated={handleCompletionGenerated} // Refreshes completions after generation
        />
      )}
    </div>
  );
}
