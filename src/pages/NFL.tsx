import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertCircle, History, TrendingUp, BarChart, ScatterChart, Brain, Target, Users, CloudRain, Calendar, Clock, Info, ChevronDown } from 'lucide-react';
import debug from '@/utils/debug';
import { LiquidButton } from '@/components/animate-ui/components/buttons/liquid';
import { Link } from 'react-router-dom';
import H2HModal from '@/components/H2HModal';
import LineMovementModal from '@/components/LineMovementModal';
import NFLGameCard from '@/components/NFLGameCard';
import HistoricalDataSection from '@/components/HistoricalDataSection';
import { BackgroundGradient } from '@/components/ui/background-gradient';
import { MiniWagerBotChat } from '@/components/MiniWagerBotChat';
import { StarButton } from '@/components/StarButton';
import { useAuth } from '@/contexts/AuthContext';
import { chatSessionManager } from '@/utils/chatSession';
import { WeatherIcon as WeatherIconComponent, IconWind } from '@/utils/weatherIcons';
import { trackPredictionViewed, trackGameAnalysisOpened, trackFilterApplied, trackSortApplied } from '@/lib/mixpanel';
import PolymarketWidget from '@/components/PolymarketWidget';

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
  const [predictions, setPredictions] = useState<NFLPrediction[]>([]);
  const [teamMappings, setTeamMappings] = useState<TeamMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(['All Games']);
  const [sortKey, setSortKey] = useState<'none' | 'ml' | 'spread' | 'ou'>('none');
  
  // H2H Modal state
  const [h2hModalOpen, setH2hModalOpen] = useState(false);
  const [selectedHomeTeam, setSelectedHomeTeam] = useState<string>('');
  const [selectedAwayTeam, setSelectedAwayTeam] = useState<string>('');

  // Line Movement Modal state
  const [lineMovementModalOpen, setLineMovementModalOpen] = useState(false);
  const [selectedUniqueId, setSelectedUniqueId] = useState<string>('');

  // Focused card state for light beams effect
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  
  // Public Betting Facts expanded state - tracks which cards have expanded betting facts
  const [expandedBettingFacts, setExpandedBettingFacts] = useState<Record<string, boolean>>({});
  
  // Track predictions viewed when loaded
  useEffect(() => {
    if (!loading && predictions.length > 0) {
      trackPredictionViewed('NFL', predictions.length, activeFilters.join(','), sortKey);
    }
  }, [loading, predictions.length]);

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

  // Open H2H modal
  const openH2HModal = (homeTeam: string, awayTeam: string) => {
    setSelectedHomeTeam(homeTeam);
    setSelectedAwayTeam(awayTeam);
    setH2hModalOpen(true);
  };

  // Close H2H modal
  const closeH2HModal = () => {
    setH2hModalOpen(false);
    setSelectedHomeTeam('');
    setSelectedAwayTeam('');
  };

  // Open Line Movement modal
  const openLineMovementModal = (uniqueId: string, homeTeam: string, awayTeam: string) => {
    setSelectedUniqueId(uniqueId);
    setSelectedHomeTeam(homeTeam);
    setSelectedAwayTeam(awayTeam);
    setLineMovementModalOpen(true);
  };

  // Close Line Movement modal
  const closeLineMovementModal = () => {
    setLineMovementModalOpen(false);
    setSelectedUniqueId('');
    setSelectedHomeTeam('');
    setSelectedAwayTeam('');
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
      
      // Get today's date in YYYY-MM-DD format for filtering
      const today = new Date().toISOString().split('T')[0];
      debug.log('Filtering games from today onwards:', today);
      
      // Fetch team mappings from database (without logo_url since it doesn't exist)
      const { data: teamMappingsData, error: teamMappingsError } = await collegeFootballSupabase
        .from('nfl_team_mapping')
        .select('city_and_name, team_name');
      
      if (teamMappingsError) {
        debug.error('Error fetching team mappings:', teamMappingsError);
      } else {
        debug.log('Team mappings fetched:', teamMappingsData);
        debug.log('Number of team mappings:', teamMappingsData?.length);
        if (teamMappingsData && teamMappingsData.length > 0) {
          debug.log('First few team mappings:', teamMappingsData.slice(0, 3));
        }
      }
      
      // Add logo URLs to the team mappings
      const teamMappings = (teamMappingsData || []).map(team => ({
        ...team,
        logo_url: getNFLTeamLogo(team.team_name)
      }));
      
      setTeamMappings(teamMappings);

      // Fetch betting lines first - get most recent row per training_key
      const { data: bettingData, error: bettingError } = await collegeFootballSupabase
        .from('nfl_betting_lines')
        .select('*')
        .gte('game_date', today)
        .order('as_of_ts', { ascending: false });

      if (bettingError) {
        debug.error('Error fetching betting lines:', bettingError);
        setError(`Betting lines error: ${bettingError.message}`);
        return;
      }

      debug.log('Betting lines fetched:', bettingData?.length || 0);

      // Create a map of most recent betting lines by training_key
      const bettingMap = new Map();
      bettingData?.forEach(bet => {
        const key = bet.training_key;
        if (!bettingMap.has(key) || new Date(bet.as_of_ts) > new Date(bettingMap.get(key).as_of_ts)) {
          bettingMap.set(key, bet);
        }
      });

      debug.log('Betting map created with', bettingMap.size, 'entries');

      // Fetch predictions - only from today onwards
      // First get the most recent run_id
      const { data: latestRun, error: runError } = await collegeFootballSupabase
        .from('nfl_predictions_epa')
        .select('run_id')
        .gte('game_date', today)
        .order('run_id', { ascending: false })
        .limit(1)
        .single();

      if (runError) {
        debug.error('Error fetching latest run_id:', runError);
        setError(`Run ID error: ${runError.message}`);
        return;
      }

      const latestRunId = latestRun?.run_id;
      if (!latestRunId) {
        debug.log('No predictions found for today onwards');
        setPredictions([]);
        setLoading(false);
        return;
      }

      // Now fetch predictions with the latest run_id
      const { data: preds, error: predsError } = await collegeFootballSupabase
        .from('nfl_predictions_epa')
        .select('training_key, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, run_id, game_date')
        .gte('game_date', today)
        .eq('run_id', latestRunId)
        .order('game_date', { ascending: true });

      if (predsError) {
        debug.error('Error fetching predictions:', predsError);
        setError(`Predictions error: ${predsError.message}`);
        return;
      }

      debug.log('Predictions fetched:', preds?.length || 0);
      if (preds && preds.length > 0) {
        debug.log('Sample prediction data:', preds[0]);
        debug.log('Available columns in prediction:', Object.keys(preds[0]));
      }

      // Fetch weather data
      const { data: weatherData, error: weatherError } = await collegeFootballSupabase
        .from('production_weather')
        .select('*');

      if (weatherError) {
        debug.error('Error fetching weather data:', weatherError);
        debug.warn('Weather data unavailable, continuing without weather info');
      }

      // Get most recent betting data per training_key
      const uniqueBettingData = bettingData ? bettingData.reduce((acc, current) => {
        const existing = acc.find(item => item.training_key === current.training_key);
        if (!existing || new Date(current.as_of_ts) > new Date(existing.as_of_ts)) {
          // Remove existing entry if it exists and add current (more recent) one
          const filtered = acc.filter(item => item.training_key !== current.training_key);
          return [...filtered, current];
        }
        return acc;
      }, [] as typeof bettingData) : [];

      // Map all data together
      const predictionsWithData = (preds || []).map(prediction => {
        // Match weather data by training_key
        const weather = weatherData?.find(w => w.training_key === prediction.training_key);
        
        // Match betting data by training_key
        const betting = uniqueBettingData?.find(b => b.training_key === prediction.training_key);
        
        debug.log('=== DEBUGGING DATA MATCHING ===');
        debug.log('Prediction training_key:', prediction.training_key);
        debug.log('Weather match found:', !!weather);
        debug.log('Betting match found:', !!betting);
        debug.log('=====================================');
        
        return {
          ...betting, // Start with betting data as base
          ...weather, // Add weather data
          // Override with prediction data
          home_away_ml_prob: prediction.home_away_ml_prob,
          home_away_spread_cover_prob: prediction.home_away_spread_cover_prob,
          ou_result_prob: prediction.ou_result_prob,
          run_id: prediction.run_id,
          game_date: prediction.game_date,
          training_key: prediction.training_key,
          // Weather data - using correct column names from production_weather
          temperature: weather?.temperature || null,
          precipitation: weather?.precipitation_pct || null,
          wind_speed: weather?.wind_speed || null,
          icon: weather?.icon || null,
          // Public betting splits - using label columns
          spread_splits_label: betting?.spread_splits_label || null,
          total_splits_label: betting?.total_splits_label || null,
          ml_splits_label: betting?.ml_splits_label || null,
        };
      });

      setPredictions(predictionsWithData);
      setLastUpdated(new Date());
    } catch (err) {
      debug.error('Error fetching data:', err);
      setError(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      return [...list].sort(byDateTime);
    }
    const score = (p: NFLPrediction): number => {
      if (sortKey === 'ml') return getDisplayedMlProb(p.home_away_ml_prob) ?? -1;
      if (sortKey === 'spread') return getDisplayedSpreadProb(p.home_away_spread_cover_prob) ?? -1;
      return getDisplayedOuProb(p.ou_result_prob) ?? -1;
    };
    return [...list].sort((a, b) => {
      const sb = score(b) - score(a);
      if (sb !== 0) return sb;
      return byDateTime(a, b);
    });
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
    <div className="container mx-auto px-4 py-6">
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
          onClick={() => setSortKey('none')}
          title="Sort by game time"
        >
          <span className="hidden sm:inline">Sort: Time</span>
          <span className="sm:hidden">Time</span>
        </Button>
        <Button
          variant={sortKey === 'spread' ? 'default' : 'outline'}
          className={`${
            sortKey === 'spread' 
              ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md shadow-purple-500/30 hover:shadow-lg hover:shadow-purple-500/40' 
              : 'bg-white dark:bg-gray-800 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 dark:hover:from-gray-700 dark:hover:to-gray-700'
          } text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto whitespace-nowrap transition-all duration-200 border border-gray-200 dark:border-gray-700`}
          onClick={() => setSortKey('spread')}
          title="Sort by highest Spread probability"
        >
          <span className="hidden sm:inline">Sort: Spread</span>
          <span className="sm:hidden">Spread</span>
        </Button>
        <Button
          variant={sortKey === 'ou' ? 'default' : 'outline'}
          className={`${
            sortKey === 'ou' 
              ? 'bg-gradient-to-r from-green-600 to-emerald-700 text-white shadow-md shadow-green-500/30 hover:shadow-lg hover:shadow-green-500/40' 
              : 'bg-white dark:bg-gray-800 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-gray-700 dark:hover:to-gray-700'
          } text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto whitespace-nowrap transition-all duration-200 border border-gray-200 dark:border-gray-700`}
          onClick={() => setSortKey('ou')}
          title="Sort by highest Over/Under probability"
        >
          <span className="hidden sm:inline">Sort: O/U</span>
          <span className="sm:hidden">O/U</span>
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

      <div className="space-y-6 sm:space-y-8">
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {getSortedPredictions()
            .map((prediction, index) => {
              const awayTeamColors = getNFLTeamColors(prediction.away_team);
              const homeTeamColors = getNFLTeamColors(prediction.home_team);
              
              // Debug log to check what ID fields are available
              if (index === 0) {
                debug.log('🏈 NFL Prediction sample:', {
                  id: prediction.id,
                  unique_id: prediction.unique_id,
                  training_key: prediction.training_key,
                  away_team: prediction.away_team,
                  home_team: prediction.home_team,
                  allKeys: Object.keys(prediction)
                });
              }
              
              return (
                <NFLGameCard
                  key={prediction.id}
                  isHovered={focusedCardId === prediction.id}
                  onMouseEnter={() => setFocusedCardId(prediction.id)}
                  onMouseLeave={() => setFocusedCardId(null)}
                  awayTeamColors={awayTeamColors}
                  homeTeamColors={homeTeamColors}
                  homeSpread={prediction.home_spread}
                  awaySpread={prediction.away_spread}
                >
                {/* Star Button for Admin Mode */}
                <StarButton gameId={prediction.training_key} gameType="nfl" />
                
                <CardContent className="space-y-4 sm:space-y-6 pt-4 pb-4 sm:pt-6 sm:pb-6">
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

                  {/* Historical Data Section */}
                  <HistoricalDataSection
                    prediction={prediction}
                    awayTeamColors={awayTeamColors}
                    homeTeamColors={homeTeamColors}
                    onH2HClick={openH2HModal}
                    onLinesClick={openLineMovementModal}
                  />

                  {/* Model Predictions Section */}
                  <div className="text-center pt-3 sm:pt-4">
                    <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-gray-200 dark:border-white/20 space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-center gap-2">
                        <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">Model Predictions</h4>
                      </div>
                      
                      {/* Spread Predictions */}
                      {prediction.home_away_spread_cover_prob !== null && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center gap-2">
                            <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Spread</h5>
                          </div>
                          {(() => {
                            const isHome = prediction.home_away_spread_cover_prob > 0.5;
                            const predictedTeam = isHome ? prediction.home_team : prediction.away_team;
                            const predictedTeamColors = isHome ? homeTeamColors : awayTeamColors;
                            const predictedSpread = isHome ? prediction.home_spread : prediction.away_spread;
                            const confidencePct = Math.round((isHome ? prediction.home_away_spread_cover_prob : 1 - prediction.home_away_spread_cover_prob) * 100);
                            const confidenceColorClass =
                              confidencePct <= 58 ? 'text-red-400' :
                              confidencePct <= 65 ? 'text-orange-400' :
                              'text-green-400';
                            const confidenceBgClass =
                              confidencePct <= 58 ? 'bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/20' :
                              confidencePct <= 65 ? 'bg-orange-100 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/20' :
                              'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20';
                            const confidenceLabel =
                              confidencePct <= 58 ? 'Low Confidence' :
                              confidencePct <= 65 ? 'Moderate Confidence' :
                              'High Confidence';
                            const spreadValue = Math.abs(Number(predictedSpread));
                            const isNegativeSpread = Number(predictedSpread) < 0;
                            const explanation =
                              confidencePct <= 58 
                                ? `For this bet to win, ${getFullTeamName(predictedTeam).city} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. With ${confidencePct}% confidence, this is a toss-up where the model sees both outcomes as nearly equally likely.`
                                : confidencePct <= 65
                                ? `For this bet to win, ${getFullTeamName(predictedTeam).city} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. The model gives this a ${confidencePct}% chance, indicating a slight advantage but still plenty of risk.`
                                : `For this bet to win, ${getFullTeamName(predictedTeam).city} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. With ${confidencePct}% confidence, the model sees a strong likelihood they'll achieve this margin.`;
                            
                            return (
                              <>
                                <div className="grid grid-cols-2 items-stretch gap-3">
                                  {/* Left: Team Circle + Name (spread) */}
                                  <div className="bg-green-100 dark:bg-green-500/10 backdrop-blur-sm rounded-lg border border-green-300 dark:border-green-500/20 p-3 flex flex-col items-center justify-center">
                                    <div 
                                      className="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center border-2 mb-2 shadow-lg"
                                      style={{
                                        background: `linear-gradient(135deg, ${predictedTeamColors.primary}, ${predictedTeamColors.secondary})`,
                                        borderColor: `${predictedTeamColors.primary}`
                                      }}
                                    >
                                      <span 
                                        className="text-xs sm:text-sm font-bold drop-shadow-md"
                                        style={{ color: getContrastingTextColor(predictedTeamColors.primary, predictedTeamColors.secondary) }}
                                      >
                                        {getTeamInitials(predictedTeam)}
                                      </span>
                                  </div>
                                    <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white text-center leading-snug">
                                      {getFullTeamName(predictedTeam).city}
                                  </span>
                                    <span className="text-xs text-gray-600 dark:text-white/70">
                                      ({formatSpread(predictedSpread)})
                                    </span>
                                  </div>
                                {/* Right: Confidence % */}
                                  <div className={`${confidenceBgClass} backdrop-blur-sm rounded-lg border p-3 flex flex-col items-center justify-center`}>
                                    <div className={`text-2xl sm:text-3xl font-extrabold leading-tight ${confidenceColorClass}`}>
                                    {confidencePct}%
                                  </div>
                                    <div className="text-xs text-gray-600 dark:text-white/60 font-medium mt-1">{confidenceLabel}</div>
                              </div>
                                </div>
                                {/* What this means */}
                                <div className="bg-gray-100 dark:bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                    <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                                  </div>
                                  <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                                    {explanation}
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* Over/Under Analysis */}
                      {prediction.ou_result_prob !== null && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center gap-2">
                            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Over / Under</h5>
                          </div>
                          {(() => {
                            const isOver = prediction.ou_result_prob! > 0.5;
                            const confidencePct = Math.round((isOver ? prediction.ou_result_prob! : 1 - prediction.ou_result_prob!) * 100);
                            const confidenceColorClass =
                              confidencePct <= 58 ? 'text-red-400' :
                              confidencePct <= 65 ? 'text-orange-400' :
                              'text-green-400';
                            const confidenceBgClass =
                              confidencePct <= 58 ? 'bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/20' :
                              confidencePct <= 65 ? 'bg-orange-100 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/20' :
                              'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20';
                            const confidenceLabel =
                              confidencePct <= 58 ? 'Low Confidence' :
                              confidencePct <= 65 ? 'Moderate Confidence' :
                              'High Confidence';
                            const arrow = isOver ? '▲' : '▼';
                            const arrowColor = isOver ? 'text-green-400' : 'text-red-400';
                            const arrowBg = isOver ? 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20' : 'bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/20';
                            const label = isOver ? 'Over' : 'Under';
                            const totalPoints = prediction.over_line;
                            const explanation =
                              confidencePct <= 58 
                                ? `For this bet to win, the combined score of both teams needs to be ${isOver ? 'MORE' : 'LESS'} than ${totalPoints} points. With ${confidencePct}% confidence, the model sees this as a coin flip—the game could go either way in terms of total scoring.`
                                : confidencePct <= 65
                                ? `For this bet to win, the combined score needs to be ${isOver ? 'MORE' : 'LESS'} than ${totalPoints} points. The model gives this a ${confidencePct}% chance, suggesting a slight ${isOver ? 'offensive' : 'defensive'} edge but the scoring environment is still uncertain.`
                                : `For this bet to win, the combined score needs to be ${isOver ? 'MORE' : 'LESS'} than ${totalPoints} points. With ${confidencePct}% confidence, the model expects a ${isOver ? 'high-scoring, offensive-oriented' : 'low-scoring, defense-dominated'} game that should clearly ${isOver ? 'exceed' : 'stay under'} this total.`;
                            
                            return (
                              <>
                                <div className="grid grid-cols-2 items-stretch gap-3">
                                {/* Left: Big arrow + OU line */}
                                  <div className={`${arrowBg} backdrop-blur-sm rounded-lg border p-3 flex flex-col items-center justify-center`}>
                                    <div className={`text-4xl sm:text-5xl font-black ${arrowColor}`}>{arrow}</div>
                                    <div className="mt-2 text-sm sm:text-base font-semibold text-gray-900 dark:text-white text-center">
                                    {label} {prediction.over_line || '-'}
                                  </div>
                                  </div>
                                {/* Right: Confidence % */}
                                  <div className={`${confidenceBgClass} backdrop-blur-sm rounded-lg border p-3 flex flex-col items-center justify-center`}>
                                    <div className={`text-2xl sm:text-3xl font-extrabold leading-tight ${confidenceColorClass}`}>
                                    {confidencePct}%
                                  </div>
                                    <div className="text-xs text-gray-600 dark:text-white/60 font-medium mt-1">{confidenceLabel}</div>
                              </div>
                                </div>
                                {/* What this means */}
                                <div className="bg-gray-100 dark:bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                    <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                                  </div>
                                  <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                                    {explanation}
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Betting Split Labels Section */}
                  {(prediction.ml_splits_label || prediction.spread_splits_label || prediction.total_splits_label) && (
                    <div className="text-center pt-3 sm:pt-4">
                      <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-gray-200 dark:border-white/20 space-y-4">
                        {/* Header - Clickable */}
                        <button
                          onClick={() => setExpandedBettingFacts(prev => ({
                            ...prev,
                            [prediction.id]: !prev[prediction.id]
                          }))}
                          className="w-full flex items-center justify-center gap-2 group hover:opacity-80 transition-opacity"
                        >
                          <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <h4 className="text-lg font-bold text-gray-900 dark:text-white">Public Betting Facts</h4>
                          <motion.div
                            animate={{ rotate: expandedBettingFacts[prediction.id] ? 180 : 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <ChevronDown className="h-5 w-5 text-gray-500 dark:text-white/60" />
                          </motion.div>
                        </button>

                        {/* Mini Previews - Collapsed State */}
                        {!expandedBettingFacts[prediction.id] && (
                            <div className="flex flex-wrap justify-center gap-2">
                              {prediction.ml_splits_label && (() => {
                                const mlData = parseBettingSplit(prediction.ml_splits_label);
                                if (!mlData || !mlData.team) return null;
                                const colorTheme = mlData.isSharp ? 'green' :
                                                  mlData.percentage >= 70 ? 'purple' :
                                                  mlData.percentage >= 60 ? 'blue' : 'neutral';
                                const bgClass = colorTheme === 'green' ? 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20' :
                                               colorTheme === 'purple' ? 'bg-purple-100 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/20' :
                                               colorTheme === 'blue' ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/20' :
                                               'bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/20';
                                return (
                                  <div className={`${bgClass} backdrop-blur-sm rounded-lg border px-3 py-2 flex items-center gap-2`}>
                                    <TrendingUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                    <span className="text-xs font-semibold text-gray-900 dark:text-white">ML: {mlData.team}</span>
                                  </div>
                                );
                              })()}
                              
                              {prediction.spread_splits_label && (() => {
                                const spreadData = parseBettingSplit(prediction.spread_splits_label);
                                if (!spreadData || !spreadData.team) return null;
                                const isHomeTeam = spreadData.team === prediction.home_team;
                                const isAwayTeam = spreadData.team === prediction.away_team;
                                if (!isHomeTeam && !isAwayTeam) return null;
                                const colorTheme = spreadData.isSharp ? 'green' :
                                                  spreadData.percentage >= 70 ? 'purple' :
                                                  spreadData.percentage >= 60 ? 'blue' : 'neutral';
                                const bgClass = colorTheme === 'green' ? 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20' :
                                               colorTheme === 'purple' ? 'bg-purple-100 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/20' :
                                               colorTheme === 'blue' ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/20' :
                                               'bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/20';
                                return (
                                  <div className={`${bgClass} backdrop-blur-sm rounded-lg border px-3 py-2 flex items-center gap-2`}>
                                    <Target className="h-3 w-3 text-green-600 dark:text-green-400" />
                                    <span className="text-xs font-semibold text-gray-900 dark:text-white">Spread: {spreadData.team}</span>
                                  </div>
                                );
                              })()}
                              
                              {prediction.total_splits_label && (() => {
                                const totalData = parseBettingSplit(prediction.total_splits_label);
                                if (!totalData || !totalData.direction) return null;
                                const isOver = totalData.direction === 'over';
                                const colorTheme = totalData.isSharp ? 'green' :
                                                  totalData.percentage >= 70 ? 'purple' :
                                                  totalData.percentage >= 60 ? 'blue' : 'neutral';
                                const bgClass = colorTheme === 'green' ? 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20' :
                                               colorTheme === 'purple' ? 'bg-purple-100 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/20' :
                                               colorTheme === 'blue' ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/20' :
                                               'bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/20';
                                const arrow = isOver ? '▲' : '▼';
                                const arrowColor = isOver ? 'text-green-400' : 'text-red-400';
                                return (
                                  <div className={`${bgClass} backdrop-blur-sm rounded-lg border px-3 py-2 flex items-center gap-2`}>
                                    <BarChart className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                                    <span className={`text-sm font-bold ${arrowColor}`}>{arrow}</span>
                                    <span className="text-xs font-semibold text-gray-900 dark:text-white">{totalData.team}</span>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                        {/* Full Details - Expanded State */}
                        {expandedBettingFacts[prediction.id] && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-4"
                          >
                        
                        {/* Moneyline Splits */}
                        {prediction.ml_splits_label && (() => {
                          const mlData = parseBettingSplit(prediction.ml_splits_label);
                          if (!mlData || !mlData.team) return null;
                          
                          const teamColors = mlData.team === prediction.home_team ? homeTeamColors : 
                                           mlData.team === prediction.away_team ? awayTeamColors : 
                                           { primary: '#6B7280', secondary: '#9CA3AF' };
                          const colorTheme = mlData.isSharp ? 'green' :
                                            mlData.percentage >= 70 ? 'purple' :
                                            mlData.percentage >= 60 ? 'blue' : 'neutral';
                          const bgClass = colorTheme === 'green' ? 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20' :
                                         colorTheme === 'purple' ? 'bg-purple-100 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/20' :
                                         colorTheme === 'blue' ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/20' :
                                         'bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/20';
                          const explanation = mlData.isSharp 
                            ? `Sharp bettors (professional, high-volume bettors) are heavily on ${mlData.team} ML. Sharp money often indicates where the true value lies, as these bettors have better information and analysis.`
                            : mlData.percentage >= 70
                            ? `There's a heavy public lean on ${mlData.team} ML. When public betting is this lopsided, there's often contrarian value on the other side, as sportsbooks adjust lines to balance their risk.`
                            : mlData.percentage >= 60
                            ? `Public bets show a moderate lean toward ${mlData.team} ML. This suggests some consensus, but the line likely still offers value on both sides.`
                            : `Public betting is relatively balanced on ${mlData.team} ML. This split suggests no strong public bias, indicating the line is well-calibrated.`;
                          
                          return (
                            <div className="space-y-3">
                              <div className="flex items-center justify-center gap-2">
                                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Moneyline</h5>
                              </div>
                              <div className="grid grid-cols-2 items-stretch gap-3">
                                <div className={`${bgClass} backdrop-blur-sm rounded-lg border p-3 flex flex-col items-center justify-center`}>
                                  {mlData.team !== 'Over' && mlData.team !== 'Under' && (
                                    <div 
                                      className="h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center border-2 mb-2 shadow-lg"
                                      style={{
                                        background: `linear-gradient(135deg, ${teamColors.primary}, ${teamColors.secondary})`,
                                        borderColor: teamColors.primary
                                      }}
                                    >
                                      <span 
                                        className="text-xs font-bold drop-shadow-md"
                                        style={{ color: getContrastingTextColor(teamColors.primary, teamColors.secondary) }}
                                      >
                                        {getTeamInitials(mlData.team)}
                                      </span>
                                    </div>
                                  )}
                                  <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white text-center">
                                    {mlData.team}
                                  </span>
                                  <span className="text-xs text-gray-600 dark:text-white/60">
                                    {mlData.isSharp ? 'Sharp Money' : 'Public'}
                                  </span>
                        </div>
                                <div className="bg-gray-100 dark:bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                    <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                      </div>
                                  <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                                    {explanation}
                                  </p>
                    </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Spread Splits */}
                        {prediction.spread_splits_label && (() => {
                          const spreadData = parseBettingSplit(prediction.spread_splits_label);
                          if (!spreadData || !spreadData.team) return null;
                          
                          // Only show if we can match the team to home or away
                          const isHomeTeam = spreadData.team === prediction.home_team;
                          const isAwayTeam = spreadData.team === prediction.away_team;
                          if (!isHomeTeam && !isAwayTeam) return null;
                          
                          const teamColors = isHomeTeam ? homeTeamColors : awayTeamColors;
                          const teamSpread = isHomeTeam ? prediction.home_spread : prediction.away_spread;
                          const colorTheme = spreadData.isSharp ? 'green' :
                                            spreadData.percentage >= 70 ? 'purple' :
                                            spreadData.percentage >= 60 ? 'blue' : 'neutral';
                          const bgClass = colorTheme === 'green' ? 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20' :
                                         colorTheme === 'purple' ? 'bg-purple-100 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/20' :
                                         colorTheme === 'blue' ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/20' :
                                         'bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/20';
                          const explanation = spreadData.isSharp 
                            ? `Sharp bettors are heavily on ${spreadData.team} ${formatSpread(teamSpread)}. Professional bettors backing this spread suggests it offers value relative to the true probability.`
                            : spreadData.percentage >= 70
                            ? `There's heavy public action on ${spreadData.team} ${formatSpread(teamSpread)}. This lopsided betting often causes sportsbooks to shade the line, potentially creating value on the less-popular side.`
                            : spreadData.percentage >= 60
                            ? `Public bets show a moderate lean toward ${spreadData.team} ${formatSpread(teamSpread)}. This is typical and suggests the spread is reasonably calibrated.`
                            : `Public betting is relatively balanced on ${spreadData.team} ${formatSpread(teamSpread)}. A near even split indicates both sides have appeal.`;
                          
                          return (
                            <div className="space-y-3">
                              <div className="flex items-center justify-center gap-2">
                                <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Spread</h5>
                              </div>
                              <div className="grid grid-cols-2 items-stretch gap-3">
                                <div className={`${bgClass} backdrop-blur-sm rounded-lg border p-3 flex flex-col items-center justify-center`}>
                                  <div 
                                    className="h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center border-2 mb-2 shadow-lg"
                                    style={{
                                      background: `linear-gradient(135deg, ${teamColors.primary}, ${teamColors.secondary})`,
                                      borderColor: teamColors.primary
                                    }}
                                  >
                                    <span 
                                      className="text-xs font-bold drop-shadow-md"
                                      style={{ color: getContrastingTextColor(teamColors.primary, teamColors.secondary) }}
                                    >
                                      {getTeamInitials(spreadData.team)}
                                    </span>
                        </div>
                                  <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white text-center">
                                    {spreadData.team}
                                  </span>
                                  <span className="text-xs text-gray-600 dark:text-white/60">
                                    {formatSpread(teamSpread)}
                                  </span>
                                </div>
                                <div className="bg-gray-100 dark:bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                    <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                                  </div>
                                  <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                                    {explanation}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Total Splits */}
                        {prediction.total_splits_label && (() => {
                          const totalData = parseBettingSplit(prediction.total_splits_label);
                          if (!totalData || !totalData.direction) return null;
                          
                          const isOver = totalData.direction === 'over';
                          const colorTheme = totalData.isSharp ? 'green' :
                                            totalData.percentage >= 70 ? 'purple' :
                                            totalData.percentage >= 60 ? 'blue' : 'neutral';
                          const bgClass = colorTheme === 'green' ? 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20' :
                                         colorTheme === 'purple' ? 'bg-purple-100 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/20' :
                                         colorTheme === 'blue' ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/20' :
                                         'bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/20';
                          const arrowColor = isOver ? 'text-green-400' : 'text-red-400';
                          const arrow = isOver ? '▲' : '▼';
                          const explanation = totalData.isSharp 
                            ? `Sharp bettors are heavily on the ${totalData.team.toLowerCase()} ${prediction.over_line}. Professional money on the ${totalData.team.toLowerCase()} suggests the total may be mispriced.`
                            : totalData.percentage >= 70
                            ? `There's heavy public action on the ${totalData.team.toLowerCase()} ${prediction.over_line}. Lopsided betting on totals often creates contrarian value, as books adjust the number to balance liability.`
                            : totalData.percentage >= 60
                            ? `Public bets show a moderate lean toward the ${totalData.team.toLowerCase()} ${prediction.over_line}. This suggests some public sentiment but the total is likely still fair.`
                            : `Public betting is relatively balanced on the ${totalData.team.toLowerCase()}. A near even split indicates the total is well-set with no clear public bias.`;
                          
                          return (
                            <div className="space-y-3">
                              <div className="flex items-center justify-center gap-2">
                                <BarChart className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Total</h5>
                              </div>
                              <div className="grid grid-cols-2 items-stretch gap-3">
                                <div className={`${bgClass} backdrop-blur-sm rounded-lg border p-3 flex flex-col items-center justify-center`}>
                                  <div className={`text-4xl font-black ${arrowColor}`}>{arrow}</div>
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white mt-2">
                                    {totalData.team} {prediction.over_line}
                                  </span>
                                  <span className="text-xs text-gray-600 dark:text-white/60">
                                    {totalData.isSharp ? 'Sharp Money' : 'Public'}
                                  </span>
                                </div>
                                <div className="bg-gray-100 dark:bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                    <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                                  </div>
                                  <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                                    {explanation}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Weather Section */}
                  <div className="text-center pt-3 sm:pt-4">
                    <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-gray-200 dark:border-white/20 space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-center gap-2">
                        <CloudRain className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">Weather</h4>
                      </div>
                      
                      {/* Weather Content */}
                      {prediction.icon ? (
                        <div className="flex justify-center">
                          <WeatherIcon 
                            iconCode={prediction.icon}
                            temperature={prediction.temperature}
                            windSpeed={prediction.wind_speed}
                          />
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-2">
                              <WeatherIconComponent 
                                code="indoor"
                                size={64}
                                className="stroke-current text-gray-800 dark:text-white"
                              />
                            </div>
                            <div className="text-xs font-medium text-gray-700 dark:text-white/80">
                              Indoor Game
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Polymarket Widget */}
                  <div className="pt-4">
                    <PolymarketWidget
                      awayTeam={prediction.away_team}
                      homeTeam={prediction.home_team}
                      gameDate={prediction.game_date}
                      awayTeamColors={awayTeamColors}
                      homeTeamColors={homeTeamColors}
                    />
                  </div>
                </CardContent>
              </NFLGameCard>
            );
            })}
        </div>
      </div>

      {predictions.length > 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Showing {predictions.length} predictions
          </p>
        </div>
      )}

      {/* H2H Modal */}
      <H2HModal
        isOpen={h2hModalOpen}
        onClose={closeH2HModal}
        homeTeam={selectedHomeTeam}
        awayTeam={selectedAwayTeam}
      />

      {/* Line Movement Modal */}
      <LineMovementModal
        isOpen={lineMovementModalOpen}
        onClose={closeLineMovementModal}
        uniqueId={selectedUniqueId}
        homeTeam={selectedHomeTeam}
        awayTeam={selectedAwayTeam}
        teamMappings={teamMappings}
      />

      {/* Mini WagerBot Chat */}
      <MiniWagerBotChat pageContext={nflContext} pageId="nfl" />
    </div>
  );
}
