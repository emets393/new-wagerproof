import { useState, useEffect, useRef, useMemo } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertCircle, ChevronUp, ChevronDown, Brain, Target, BarChart, Info, Sparkles, Users, ArrowUp, ArrowDown, Box, Search, X } from 'lucide-react';
import CFBGameCard from '@/components/CFBGameCard';
import debug from '@/utils/debug';
import { Button as MovingBorderButton } from '@/components/ui/moving-border';
import { LiquidButton } from '@/components/animate-ui/components/buttons/liquid';
import { MiniWagerBotChat } from '@/components/MiniWagerBotChat';
import { StarButton } from '@/components/StarButton';
import { useAuth } from '@/contexts/AuthContext';
import { chatSessionManager } from '@/utils/chatSession';
import { WeatherIcon as WeatherIconComponent, IconWind } from '@/utils/weatherIcons';
import PolymarketWidget from '@/components/PolymarketWidget';
import { useFreemiumAccess } from '@/hooks/useFreemiumAccess';
import { FreemiumUpgradeBanner } from '@/components/FreemiumUpgradeBanner';
import { Lock } from 'lucide-react';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { AIPayloadViewer } from '@/components/AIPayloadViewer';
import { getGameCompletions, getHighValueBadges, getPageHeaderData } from '@/services/aiCompletionService';
import { PageHeaderValueFinds } from '@/components/PageHeaderValueFinds';
import { HighValueBadge } from '@/components/HighValueBadge';
import { GameDetailsModal } from '@/components/GameDetailsModal';
import { areCompletionsEnabled } from '@/utils/aiCompletionSettings';
import { GameTailSection } from '@/components/GameTailSection';
import { CardFooter } from '@/components/ui/card';
import { useSportsPageCache } from '@/hooks/useSportsPageCache';

interface CFBPrediction {
  id: string;
  away_team: string;
  home_team: string;
  home_ml: number | null;
  away_ml: number | null;
  home_spread: number | null;
  away_spread: number | null;
  total_line: number | null;
  ml_splits_label: string | null;
  spread_splits_label: string | null;
  total_splits_label: string | null;
  game_date?: string;
  game_time?: string;
  start_time?: string; // Date/time from cfb_live_weekly_inputs
  start_date?: string; // Alternative column name
  game_datetime?: string; // Alternative column name
  datetime?: string; // Alternative column name
  // New columns from cfb_live_weekly_inputs
  away_moneyline?: number | null;
  home_moneyline?: number | null;
  api_spread?: number | null;
  api_over_line?: number | null;
  generated_at?: string;
  training_key?: string; // Add this to map to weather data
  temperature?: number | null;
  precipitation?: number | null;
  wind_speed?: number | null;
  icon_code?: string | null; // New weather icon code
    // Direct weather fields from cfb_live_weekly_inputs
    weather_icon_text?: string | null;
    weather_temp_f?: number | null;
    weather_windspeed_mph?: number | null;
  pred_ml_proba?: number | null; // New probability fields
  pred_spread_proba?: number | null;
  pred_total_proba?: number | null;
  // Add score prediction columns
  pred_away_score?: number | null;
  pred_home_score?: number | null;
  // Alternative naming for simulated points
  pred_away_points?: number | null;
  pred_home_points?: number | null;
  // Prediction data from cfb_api_predictions
  pred_spread?: number | null;
  home_spread_diff?: number | null;
  pred_total?: number | null;
  total_diff?: number | null;
    // Over/Under specific
    pred_over_line?: number | null;
    over_line_diff?: number | null;
  // Opening spread from cfb_live_weekly_inputs (column: spread)
  opening_spread?: number | null;
}

interface TeamMapping {
  api: string;
  logo_light: string;
}

export default function CollegeFootball() {
  const { user } = useAuth();
  const { isFreemiumUser } = useFreemiumAccess();
  const { adminModeEnabled } = useAdminMode();
  
  // Session cache hook
  const { getCachedData, setCachedData, clearCache, restoreScrollPosition } = useSportsPageCache<CFBPrediction>('college-football');
  
  const [predictions, setPredictions] = useState<CFBPrediction[]>([]);
  const [teamMappings, setTeamMappings] = useState<TeamMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(['All Games']);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  
  // AI Completion state
  const [aiCompletions, setAiCompletions] = useState<Record<string, Record<string, string>>>({});
  const [payloadViewerOpen, setPayloadViewerOpen] = useState(false);
  
  // Value Finds state
  const [highValueBadges, setHighValueBadges] = useState<Map<string, any>>(new Map());
  const [pageHeaderData, setPageHeaderData] = useState<{ summary_text: string; compact_picks: any[] } | null>(null);
  const [valueFindId, setValueFindId] = useState<string | null>(null);
  const [valueFindPublished, setValueFindPublished] = useState<boolean>(false);
  const [selectedPayloadGame, setSelectedPayloadGame] = useState<CFBPrediction | null>(null);
  
  // Modal state - tracks which game is selected for modal
  const [selectedGameForModal, setSelectedGameForModal] = useState<CFBPrediction | null>(null);
  
  const toggleGameSelection = (id: string) => {
    setSelectedGameIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const [gameDropdownOpen, setGameDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!gameDropdownOpen) return;
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setGameDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [gameDropdownOpen]);
  type SortMode = 'time' | 'spread' | 'ou';
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [sortAscending, setSortAscending] = useState<boolean>(false);
  // Match simulator UI states per game id
  const [simLoadingById, setSimLoadingById] = useState<Record<string, boolean>>({});
  const [simRevealedById, setSimRevealedById] = useState<Record<string, boolean>>({});

  // Filter options
  const filterOptions = ['All Games', 'Sharp Money', 'Public Bets', 'Consensus Bets'];

  // Toggle filter selection
  const toggleFilter = (filter: string) => {
    if (filter === 'All Games') {
      setActiveFilters(['All Games']);
    } else {
      setActiveFilters(prev => {
        // If the filter is already selected, remove it
        if (prev.includes(filter)) {
          const newFilters = prev.filter(f => f !== filter);
          // If no filters are left, default to All Games
          return newFilters.length === 0 ? ['All Games'] : newFilters;
        } else {
          // If the filter is not selected, add it and remove All Games
          const newFilters = prev.filter(f => f !== 'All Games');
          return [...newFilters, filter];
        }
      });
    }
  };

  // Build context for WagerBot with all current game data (formatted as markdown)
  const buildCFBContext = (preds: CFBPrediction[]): string => {
    try {
      if (!preds || preds.length === 0) return '';
      
      const contextParts = preds.slice(0, 20).map((pred, idx) => { // Limit to 20 games to manage token count
        try {
          const awayTeam = pred.away_team || 'Unknown';
          const homeTeam = pred.home_team || 'Unknown';
          const gameTime = pred.start_time || pred.game_datetime || pred.datetime || 'TBD';
          const gameDate = gameTime !== 'TBD' ? new Date(gameTime).toLocaleDateString() : 'TBD';
          
          return `
### Game ${idx + 1}: ${awayTeam} @ ${homeTeam}

**Date/Time:** ${gameDate}

**Betting Lines:**
- Spread: ${homeTeam} ${pred.home_spread || pred.api_spread || 'N/A'}
- Moneyline: Away ${pred.away_moneyline || pred.away_ml || 'N/A'} / Home ${pred.home_moneyline || pred.home_ml || 'N/A'}
- Over/Under: ${pred.total_line || pred.api_over_line || 'N/A'}

**Model Predictions:**
- ML Probability: ${pred.pred_ml_proba ? (pred.pred_ml_proba * 100).toFixed(1) + '%' : 'N/A'}
- Spread Cover Probability: ${pred.pred_spread_proba ? (pred.pred_spread_proba * 100).toFixed(1) + '%' : 'N/A'}
- Total Probability: ${pred.pred_total_proba ? (pred.pred_total_proba * 100).toFixed(1) + '%' : 'N/A'}
- Predicted Score: ${awayTeam} ${pred.pred_away_score || pred.pred_away_points || 'N/A'} - ${homeTeam} ${pred.pred_home_score || pred.pred_home_points || 'N/A'}

**Weather:** ${pred.weather_temp_f || pred.temperature ? (pred.weather_temp_f || pred.temperature) + '°F' : 'N/A'}, Wind: ${pred.weather_windspeed_mph || pred.wind_speed ? (pred.weather_windspeed_mph || pred.wind_speed) + ' mph' : 'N/A'}

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
      
      return `# 🏈 College Football Games Data

I have access to **${preds.length} total games**. Here's the detailed breakdown:

${contextParts}

*Note: Probabilities are from the predictive model. I can help you analyze these matchups, identify value opportunities, and answer questions about specific games.*`;
    } catch (error) {
      debug.error('Error building CFB context:', error);
      return ''; // Return empty string if there's an error
    }
  };

  // Memoize the context to prevent infinite re-renders
  // Use predictions.length and first game ID as dependency to avoid array reference issues
  const cfbContext = useMemo(() => {
    const context = buildCFBContext(predictions);
    
    // Debug logging for context - Show what we're sending to the AI
    if (context && predictions.length > 0) {
      debug.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #10b981; font-weight: bold');
      debug.log('%c📊 COLLEGE FOOTBALL - DATA SENT TO AI', 'color: #10b981; font-weight: bold; font-size: 14px');
      debug.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #10b981; font-weight: bold');
      debug.log(`\n📈 Total Games: ${predictions.length}\n`);
      
      // Show summary of each game
      predictions.slice(0, 10).forEach((pred, idx) => {
        const gameTime = pred.start_time || pred.game_datetime || pred.datetime || 'TBD';
        debug.log(`%c🏈 Game ${idx + 1}: ${pred.away_team} @ ${pred.home_team}`, 'color: #3b82f6; font-weight: bold');
        debug.log(`   📅 Time: ${gameTime}`);
        debug.log(`   📊 Lines:`);
        debug.log(`      • Spread: ${pred.home_team} ${pred.home_spread || pred.api_spread || 'N/A'}`);
        debug.log(`      • Moneyline: Away ${pred.away_moneyline || pred.away_ml || 'N/A'} / Home ${pred.home_moneyline || pred.home_ml || 'N/A'}`);
        debug.log(`      • Over/Under: ${pred.total_line || pred.api_over_line || 'N/A'}`);
        debug.log(`   🤖 Model Predictions:`);
        debug.log(`      • ML Probability: ${pred.pred_ml_proba ? (pred.pred_ml_proba * 100).toFixed(1) + '%' : 'N/A'}`);
        debug.log(`      • Spread Cover Prob: ${pred.pred_spread_proba ? (pred.pred_spread_proba * 100).toFixed(1) + '%' : 'N/A'}`);
        debug.log(`      • Total Probability: ${pred.pred_total_proba ? (pred.pred_total_proba * 100).toFixed(1) + '%' : 'N/A'}`);
        debug.log(`      • Predicted Scores: Away ${pred.pred_away_score || pred.pred_away_points || 'N/A'} - Home ${pred.pred_home_score || pred.pred_home_points || 'N/A'}`);
        debug.log(`   ⛅ Weather: ${pred.weather_temp_f || pred.temperature || 'N/A'}°F, Wind: ${pred.weather_windspeed_mph || pred.wind_speed || 'N/A'} mph`);
        debug.log(`   📈 Public Splits: Spread: ${pred.spread_splits_label || 'N/A'}, Total: ${pred.total_splits_label || 'N/A'}`);
        debug.log('');
      });
      
      if (predictions.length > 10) {
        debug.log(`   ... and ${predictions.length - 10} more games`);
      }
      
      debug.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #10b981; font-weight: bold');
      debug.log(`%c✅ Full context length: ${context.length} characters`, 'color: #10b981');
      debug.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'color: #10b981; font-weight: bold');
      
      // Also log raw context for copy-paste debugging
      console.groupCollapsed('📋 Raw Context (click to expand)');
      debug.log(context);
      console.groupEnd();
    }
    
    return context;
  }, [predictions.length, predictions[0]?.id]);

  // Check if a game should be displayed based on dropdown selections
  const shouldDisplaySelected = (prediction: CFBPrediction): boolean => {
    // First check search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const awayTeam = prediction.away_team.toLowerCase();
      const homeTeam = prediction.home_team.toLowerCase();
      
      if (!awayTeam.includes(query) && !homeTeam.includes(query)) {
        return false;
      }
    }
    
    // Then check game selection filter
    if (selectedGameIds.length === 0) return true; // no selection means show all
    return selectedGameIds.includes(String(prediction.id));
  };

  // Displayed edge helpers (match UI rounding behavior)
  const getDisplayedSpreadEdge = (p: CFBPrediction): number => {
    const val = p.home_spread_diff;
    if (val === null || val === undefined || isNaN(Number(val))) return -Infinity;
    return Math.round(Math.abs(Number(val)) * 2) / 2; // roundToHalf(abs)
  };

  const getDisplayedOUEdge = (p: CFBPrediction): number => {
    const val = p.over_line_diff as number | null | undefined;
    if (val === null || val === undefined || isNaN(Number(val))) return -Infinity;
    return Math.round(Math.abs(Number(val)) * 2) / 2; // roundToHalf(abs)
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

  // Team initials mapping function
  const getTeamInitials = (teamName: string): string => {
    const acronymMap: { [key: string]: string } = {
      // Major conferences and common teams
      'Alabama': 'ALA',
      'Auburn': 'AUB',
      'Georgia': 'UGA',
      'Florida': 'UF',
      'LSU': 'LSU',
      'Texas A&M': 'TAMU',
      'Ole Miss': 'MISS',
      'Mississippi State': 'MSST',
      'Arkansas': 'ARK',
      'Kentucky': 'UK',
      'Tennessee': 'TENN',
      'South Carolina': 'SC',
      'Missouri': 'MIZ',
      'Vanderbilt': 'VAN',
      
      'Ohio State': 'OSU',
      'Michigan': 'MICH',
      'Penn State': 'PSU',
      'Michigan State': 'MSU',
      'Wisconsin': 'WISC',
      'Iowa': 'IOWA',
      'Minnesota': 'MINN',
      'Nebraska': 'NEB',
      'Illinois': 'ILL',
      'Northwestern': 'NW',
      'Purdue': 'PUR',
      'Indiana': 'IND',
      'Rutgers': 'RUT',
      'Maryland': 'MD',
      
      'Oklahoma': 'OU',
      'Texas': 'TEX',
      'Oklahoma State': 'OKST',
      'Baylor': 'BAY',
      'TCU': 'TCU',
      'Texas Tech': 'TTU',
      'Kansas State': 'KSU',
      'Iowa State': 'ISU',
      'Kansas': 'KU',
      'West Virginia': 'WVU',
      'BYU': 'BYU',
      'Cincinnati': 'CIN',
      'UCF': 'UCF',
      'Houston': 'HOU',
      
      'USC': 'USC',
      'UCLA': 'UCLA',
      'Oregon': 'ORE',
      'Washington': 'UW',
      'Utah': 'UTAH',
      'Arizona State': 'ASU',
      'Arizona': 'ARIZ',
      'Colorado': 'COLO',
      'Stanford': 'STAN',
      'California': 'CAL',
      'Oregon State': 'ORST',
      'Washington State': 'WSU',
      
      'Clemson': 'CLEM',
      'Florida State': 'FSU',
      'Miami': 'MIA',
      'North Carolina': 'UNC',
      'NC State': 'NCST',
      'Virginia Tech': 'VT',
      'Virginia': 'UVA',
      'Duke': 'DUKE',
      'Wake Forest': 'WAKE',
      'Georgia Tech': 'GT',
      'Boston College': 'BC',
      'Pitt': 'PITT',
      'Syracuse': 'SYR',
      'Louisville': 'LOU',
      
      'Notre Dame': 'ND',
      'Army': 'ARMY',
      'Navy': 'NAVY',
      'Air Force': 'AF',
      
      // Additional common teams
      'Boise State': 'BSU',
      'San Diego State': 'SDSU',
      'Fresno State': 'FRES',
      'Utah State': 'USU',
      'Wyoming': 'WYO',
      'Colorado State': 'CSU',
      'Nevada': 'NEV',
      'UNLV': 'UNLV',
      'New Mexico': 'UNM',
      'Hawaii': 'HAW',
      'San Jose State': 'SJSU',
      
      'Memphis': 'MEM',
      'SMU': 'SMU',
      'Tulane': 'TUL',
      'Tulsa': 'TULSA',
      'East Carolina': 'ECU',
      'Temple': 'TEMP',
      'South Florida': 'USF',
      'Charlotte': 'CHAR',
      'Florida Atlantic': 'FAU',
      'Florida International': 'FIU',
      'Marshall': 'MRSH',
      'Old Dominion': 'ODU',
      'Middle Tennessee': 'MTSU',
      'Western Kentucky': 'WKU',
      'North Texas': 'UNT',
      'UTSA': 'UTSA',
      'Rice': 'RICE',
      'Louisiana Tech': 'LAT',
      'Southern Miss': 'USM',
      'UTEP': 'UTEP',
      'New Mexico State': 'NMSU',
      'Liberty': 'LIB',
      'James Madison': 'JMU',
      'Appalachian State': 'APP',
      'Coastal Carolina': 'CCU',
      'Georgia Southern': 'GASO',
      'Georgia State': 'GSU',
      'Troy': 'TROY',
      'South Alabama': 'USA',
      'Louisiana': 'UL',
      'Louisiana Monroe': 'ULM',
      'Arkansas State': 'ARST',
      'Texas State': 'TXST',
      
      'Buffalo': 'BUFF',
      'Akron': 'AKR',
      'Kent State': 'KENT',
      'Ohio': 'OHIO',
      'Miami (OH)': 'MOH',
      'Bowling Green': 'BGSU',
      'Toledo': 'TOL',
      'Central Michigan': 'CMU',
      'Eastern Michigan': 'EMU',
      'Western Michigan': 'WMU',
      'Northern Illinois': 'NIU',
      'Ball State': 'BALL',
      
      // MAC teams already defined above (lines 295-304)
    };
    
    return acronymMap[teamName] || teamName.substring(0, 4).toUpperCase();
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Force new chat session on refresh
      debug.log('🔄 Refresh triggered - clearing chat session to force new context');
      if (user) {
        chatSessionManager.clearPageSession(user.id, 'college-football');
      }
      
      debug.log('Fetching college football data...');
      
      // Fetch team mappings first
      const { data: mappings, error: mappingsError } = await collegeFootballSupabase
        .from('cfb_team_mapping')
        .select('api, logo_light');
      
      if (mappingsError) {
        debug.error('Error fetching team mappings:', mappingsError);
        setError(`Team mappings error: ${mappingsError.message}`);
        return;
      }
      
      debug.log('Team mappings fetched:', mappings?.length || 0);
      setTeamMappings(mappings || []);

        // Fetch predictions - no date filtering needed
        const { data: preds, error: predsError } = await collegeFootballSupabase
          .from('cfb_live_weekly_inputs')
          .select('*');

        if (predsError) {
          debug.error('Error fetching predictions:', predsError);
          setError(`Predictions error: ${predsError.message}`);
          return;
        }

        debug.log('Predictions fetched:', preds?.length || 0);
        debug.log('Sample prediction data:', preds?.[0]); // Log first prediction to see structure

        // Fetch prediction data from cfb_api_predictions
        const { data: apiPreds, error: apiPredsError } = await collegeFootballSupabase
          .from('cfb_api_predictions')
          .select('*');

        if (apiPredsError) {
          debug.error('Error fetching API predictions:', apiPredsError);
          setError(`API predictions error: ${apiPredsError.message}`);
          return;
        }

        debug.log('API predictions fetched:', apiPreds?.length || 0);
        debug.log('Sample API prediction data:', apiPreds?.[0]); // Log first API prediction to see structure

        // Map API prediction data; weather display comes directly from cfb_live_weekly_inputs fields
        const predictionsWithWeather = (preds || []).map(prediction => {
          const apiPred = apiPreds?.find(ap => ap.id === prediction.id);
          
          // Debug logging for first prediction
          if (prediction.id === preds?.[0]?.id) {
            debug.log('Mapping prediction:', prediction.id);
            debug.log('Found API pred:', apiPred);
            debug.log('All API pred columns:', Object.keys(apiPred || {}));
          }
          
          return {
            ...prediction,
            // Map opening spread from raw column name 'spread'
            opening_spread: (prediction as any)?.spread ?? null,
            // Weather fields are sourced directly from cfb_live_weekly_inputs (prediction)
            // Add API prediction data - try different possible column names
            pred_spread: apiPred?.pred_spread || apiPred?.run_line_prediction || apiPred?.spread_prediction || null,
            home_spread_diff: apiPred?.home_spread_diff || apiPred?.spread_diff || apiPred?.edge || null,
            pred_total: apiPred?.pred_total || apiPred?.total_prediction || apiPred?.ou_prediction || null,
            total_diff: apiPred?.total_diff || apiPred?.total_edge || null,
            // Explicit Over/Under values
            pred_over_line: apiPred?.pred_over_line ?? null,
            over_line_diff: apiPred?.over_line_diff ?? null,
            // Score prediction fields (support multiple possible column names)
            pred_away_score: apiPred?.pred_away_score ?? (apiPred as any)?.away_points ?? (prediction as any)?.pred_away_score ?? null,
            pred_home_score: apiPred?.pred_home_score ?? (apiPred as any)?.home_points ?? (prediction as any)?.pred_home_score ?? null,
            pred_away_points: apiPred?.pred_away_points ?? (apiPred as any)?.away_points ?? null,
            pred_home_points: apiPred?.pred_home_points ?? (apiPred as any)?.home_points ?? null
          };
        });

      setPredictions(predictionsWithWeather);
      // Use the generated_at time from the first prediction if available
      if (preds && preds.length > 0 && preds[0].generated_at) {
        setLastUpdated(new Date(preds[0].generated_at));
      } else {
        setLastUpdated(new Date());
      }
      
      // Save to cache (mappings are already set earlier with setTeamMappings)
      setCachedData({
        predictions: predictionsWithWeather,
        teamMappings: mappings || [],
        lastUpdated: Date.now(),
        searchQuery,
        sortKey: sortMode, // CollegeFootball uses sortMode instead of sortKey
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
  const fetchAICompletions = async (games: CFBPrediction[]) => {
    // Check if completions are enabled
    if (!areCompletionsEnabled('cfb')) {
      debug.log('CFB completions are disabled via emergency toggle, skipping fetch');
      setAiCompletions({});
      return;
    }
    
    debug.log('Fetching AI completions for', games.length, 'CFB games');
    const completionsMap: Record<string, Record<string, string>> = {};
    
    for (const game of games) {
      const gameId = game.training_key || game.id || `${game.away_team}_${game.home_team}`;
      try {
        const completions = await getGameCompletions(gameId, 'cfb');
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
      const completions = await getGameCompletions(gameId, 'cfb');
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
      debug.log('[Cache] Restoring from cache');
      // Restore from cache
      setPredictions(cached.predictions);
      if (cached.teamMappings) {
        setTeamMappings(cached.teamMappings);
      }
      setLastUpdated(new Date(cached.lastUpdated));
      setSearchQuery(cached.searchQuery || '');
      // Restore sortMode (CollegeFootball uses sortMode instead of sortKey)
      const validSortMode = cached.sortKey as SortMode;
      if (['time', 'spread', 'total'].includes(validSortMode)) {
        setSortMode(validSortMode);
      } else {
        setSortMode('time');
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
      debug.log('[Cache] No cache available, fetching fresh data');
      fetchData();
    }
    
    // Always fetch value finds
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
  }, [adminModeEnabled]);
  
  // Update cache when UI state changes (search, sort, filters)
  useEffect(() => {
    if (predictions.length > 0) {
      const cached = getCachedData();
      if (cached) {
        setCachedData({
          ...cached,
          searchQuery,
          sortKey: sortMode,
          sortAscending,
          activeFilters,
        });
      }
    }
  }, [searchQuery, sortMode, sortAscending, activeFilters]); // Re-fetch when admin mode changes

  // Fetch Value Finds data
  const fetchValueFinds = async () => {
    try {
      const [badges, headerData] = await Promise.all([
        getHighValueBadges('cfb'),
        getPageHeaderData('cfb', adminModeEnabled), // Pass admin mode to include unpublished data
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
  
  // Fetch AI completions when predictions are loaded
  useEffect(() => {
    if (predictions.length > 0) {
      fetchAICompletions(predictions);
    }
  }, [predictions]);

  // Function to get CFB team colors
  const getCFBTeamColors = (teamName: string): { primary: string; secondary: string } => {
    const colorMap: { [key: string]: { primary: string; secondary: string } } = {
      // SEC
      'Alabama': { primary: '#9E1B32', secondary: '#FFFFFF' },
      'Auburn': { primary: '#0C2340', secondary: '#E87722' },
      'Georgia': { primary: '#BA0C2F', secondary: '#000000' },
      'Florida': { primary: '#0021A5', secondary: '#FA4616' },
      'LSU': { primary: '#461D7C', secondary: '#FDD023' },
      'Texas A&M': { primary: '#500000', secondary: '#FFFFFF' },
      'Ole Miss': { primary: '#CE1126', secondary: '#14213D' },
      'Mississippi State': { primary: '#5D1725', secondary: '#FFFFFF' },
      'Arkansas': { primary: '#9D2235', secondary: '#FFFFFF' },
      'Kentucky': { primary: '#0033A0', secondary: '#FFFFFF' },
      'Tennessee': { primary: '#FF8200', secondary: '#FFFFFF' },
      'South Carolina': { primary: '#73000A', secondary: '#000000' },
      'Missouri': { primary: '#F1B82D', secondary: '#000000' },
      'Vanderbilt': { primary: '#866D4B', secondary: '#000000' },
      
      // Big Ten
      'Ohio State': { primary: '#BB0000', secondary: '#666666' },
      'Michigan': { primary: '#00274C', secondary: '#FFCB05' },
      'Penn State': { primary: '#041E42', secondary: '#FFFFFF' },
      'Michigan State': { primary: '#18453B', secondary: '#FFFFFF' },
      'Wisconsin': { primary: '#C5050C', secondary: '#FFFFFF' },
      'Iowa': { primary: '#FFCD00', secondary: '#000000' },
      'Minnesota': { primary: '#7A0019', secondary: '#FFCC33' },
      'Nebraska': { primary: '#E41C38', secondary: '#FFFFFF' },
      'Illinois': { primary: '#13294B', secondary: '#E84A27' },
      'Northwestern': { primary: '#4E2A84', secondary: '#FFFFFF' },
      'Purdue': { primary: '#000000', secondary: '#CFB991' },
      'Indiana': { primary: '#990000', secondary: '#FFFFFF' },
      'Rutgers': { primary: '#CC0033', secondary: '#FFFFFF' },
      'Maryland': { primary: '#E03A3E', secondary: '#FFD520' },
      
      // Big 12
      'Oklahoma': { primary: '#841617', secondary: '#FDF9D8' },
      'Texas': { primary: '#BF5700', secondary: '#FFFFFF' },
      'Oklahoma State': { primary: '#FF6600', secondary: '#000000' },
      'Baylor': { primary: '#003015', secondary: '#FFB81C' },
      'TCU': { primary: '#4D1979', secondary: '#A3A9AC' },
      'Texas Tech': { primary: '#CC0000', secondary: '#000000' },
      'Kansas State': { primary: '#512888', secondary: '#FFFFFF' },
      'Iowa State': { primary: '#C8102E', secondary: '#F1BE48' },
      'Kansas': { primary: '#0051BA', secondary: '#E8000D' },
      'West Virginia': { primary: '#002855', secondary: '#EAAA00' },
      'BYU': { primary: '#002E5D', secondary: '#FFFFFF' },
      'Cincinnati': { primary: '#E00122', secondary: '#000000' },
      'UCF': { primary: '#BA9B37', secondary: '#000000' },
      'Houston': { primary: '#C8102E', secondary: '#FFFFFF' },
      
      // ACC
      'Clemson': { primary: '#F56600', secondary: '#522D80' },
      'Florida State': { primary: '#782F40', secondary: '#CEB888' },
      'Miami': { primary: '#F47321', secondary: '#005030' },
      'North Carolina': { primary: '#7BAFD4', secondary: '#13294B' },
      'NC State': { primary: '#CC0000', secondary: '#FFFFFF' },
      'Virginia Tech': { primary: '#630031', secondary: '#CF4420' },
      'Virginia': { primary: '#232D4B', secondary: '#E57200' },
      'Duke': { primary: '#003087', secondary: '#FFFFFF' },
      'Wake Forest': { primary: '#9E7E38', secondary: '#000000' },
      'Georgia Tech': { primary: '#B3A369', secondary: '#003057' },
      'Boston College': { primary: '#98002E', secondary: '#FFB81C' },
      'Pitt': { primary: '#003594', secondary: '#FFB81C' },
      'Syracuse': { primary: '#F76900', secondary: '#000E54' },
      'Louisville': { primary: '#AD0000', secondary: '#000000' },
      
      // Pac-12
      'USC': { primary: '#990000', secondary: '#FFCC00' },
      'UCLA': { primary: '#2D68C4', secondary: '#FFD100' },
      'Oregon': { primary: '#007030', secondary: '#FEE123' },
      'Washington': { primary: '#4B2E83', secondary: '#B7A57A' },
      'Utah': { primary: '#CC0000', secondary: '#FFFFFF' },
      'Arizona State': { primary: '#8C1D40', secondary: '#FFC627' },
      'Arizona': { primary: '#003366', secondary: '#CC0033' },
      'Colorado': { primary: '#000000', secondary: '#CFB87C' },
      'Stanford': { primary: '#8C1515', secondary: '#FFFFFF' },
      'California': { primary: '#003262', secondary: '#FDB515' },
      'Oregon State': { primary: '#DC4405', secondary: '#000000' },
      'Washington State': { primary: '#981E32', secondary: '#5E6A71' },
      
      // Independents
      'Notre Dame': { primary: '#0C2340', secondary: '#C99700' },
      'Army': { primary: '#000000', secondary: '#D4AF37' },
      'Navy': { primary: '#000080', secondary: '#C5B783' },
      
      // Other notable programs
      'Boise State': { primary: '#0033A0', secondary: '#D64309' },
      'San Diego State': { primary: '#A6192E', secondary: '#000000' },
      'Fresno State': { primary: '#DB0032', secondary: '#003A70' },
      'Utah State': { primary: '#003057', secondary: '#FFFFFF' },
      'Wyoming': { primary: '#492F24', secondary: '#FFC425' },
      'Colorado State': { primary: '#1E4D2B', secondary: '#C8C372' },
      'Nevada': { primary: '#003366', secondary: '#A2AAAD' },
      'UNLV': { primary: '#CF0A2C', secondary: '#A7A8AA' },
      'New Mexico': { primary: '#BA0C2F', secondary: '#A7A8AA' },
      'Hawaii': { primary: '#024731', secondary: '#FFFFFF' },
      'San Jose State': { primary: '#0055A2', secondary: '#E5A823' },
      
      'Memphis': { primary: '#003087', secondary: '#808285' },
      'SMU': { primary: '#CC0033', secondary: '#0033A0' },
      'Tulane': { primary: '#006747', secondary: '#418FDE' },
      'Tulsa': { primary: '#002D72', secondary: '#C8102E' },
      'East Carolina': { primary: '#592A8A', secondary: '#FFC845' },
      'Temple': { primary: '#9D2235', secondary: '#FFFFFF' },
      'South Florida': { primary: '#006747', secondary: '#CFC493' },
      'Charlotte': { primary: '#046A38', secondary: '#FFFFFF' },
      'Florida Atlantic': { primary: '#003366', secondary: '#CC0000' },
      'Florida International': { primary: '#081E3F', secondary: '#B6862C' },
      'Marshall': { primary: '#00B140', secondary: '#FFFFFF' },
      'Old Dominion': { primary: '#003057', secondary: '#A2AAAD' },
      'Middle Tennessee': { primary: '#0066CC', secondary: '#FFFFFF' },
      'Western Kentucky': { primary: '#C8102E', secondary: '#FFFFFF' },
      'North Texas': { primary: '#00853E', secondary: '#FFFFFF' },
      'UTSA': { primary: '#0C2340', secondary: '#F15A22' },
      'Rice': { primary: '#00205B', secondary: '#8996A0' },
      'Louisiana Tech': { primary: '#00338D', secondary: '#EB1C2D' },
      'Southern Miss': { primary: '#FFAA3C', secondary: '#000000' },
      'UTEP': { primary: '#FF8200', secondary: '#041E42' },
      'New Mexico State': { primary: '#BA0C2F', secondary: '#FFFFFF' },
      'Liberty': { primary: '#002D72', secondary: '#C8102E' },
      'James Madison': { primary: '#450084', secondary: '#FFB612' },
      'Appalachian State': { primary: '#000000', secondary: '#FFCC00' },
      'Coastal Carolina': { primary: '#006F71', secondary: '#A27752' },
      'Georgia Southern': { primary: '#003A70', secondary: '#FFFFFF' },
      'Georgia State': { primary: '#0033A0', secondary: '#C8102E' },
      'Troy': { primary: '#8B0015', secondary: '#A7A8AA' },
      'South Alabama': { primary: '#004B8D', secondary: '#C8102E' },
      'Louisiana': { primary: '#CE181E', secondary: '#FFFFFF' },
      'Louisiana Monroe': { primary: '#8B0015', secondary: '#FFC82E' },
      'Arkansas State': { primary: '#CC092F', secondary: '#000000' },
      'Texas State': { primary: '#501214', secondary: '#B29369' },
      
      'Buffalo': { primary: '#005BBB', secondary: '#FFFFFF' },
      'Akron': { primary: '#041E42', secondary: '#A89968' },
      'Kent State': { primary: '#002664', secondary: '#EEB111' },
      'Ohio': { primary: '#00694E', secondary: '#FFFFFF' },
      'Miami (OH)': { primary: '#C8102E', secondary: '#FFFFFF' },
      'Bowling Green': { primary: '#FE5000', secondary: '#4F2C1D' },
      'Toledo': { primary: '#003E7E', secondary: '#F7B718' },
      'Central Michigan': { primary: '#6A0032', secondary: '#FFC82E' },
      'Eastern Michigan': { primary: '#006633', secondary: '#FFFFFF' },
      'Western Michigan': { primary: '#5B4638', secondary: '#FFCB05' },
      'Northern Illinois': { primary: '#BA0C2F', secondary: '#000000' },
      'Ball State': { primary: '#BA0C2F', secondary: '#FFFFFF' },
    };
    
    return colorMap[teamName] || { primary: '#6B7280', secondary: '#9CA3AF' };
  };

  const getTeamLogo = (teamName: string): string => {
    if (!teamMappings || teamMappings.length === 0) {
      return '';
    }
    
    // Try exact match first
    let mapping = teamMappings.find(m => m.api === teamName);
    
    // Try case-insensitive match
    if (!mapping) {
      const lowerTeamName = teamName.toLowerCase();
      mapping = teamMappings.find(m => m.api && m.api.toLowerCase() === lowerTeamName);
    }
    
    // Try partial match (teamName contains api or api contains teamName)
    if (!mapping) {
      const lowerTeamName = teamName.toLowerCase();
      mapping = teamMappings.find(m => {
        if (!m.api) return false;
        const lowerApi = m.api.toLowerCase();
        return lowerTeamName.includes(lowerApi) || lowerApi.includes(lowerTeamName);
      });
    }
    
    return mapping?.logo_light || '';
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
        {/* Horizontal layout: Weather Icon | Temperature | Wind */}
        <div className="flex items-center justify-center space-x-4 mb-2">
          {/* Weather Icon */}
          <div className="w-16 h-16 flex items-center justify-center">
            <WeatherIconComponent 
              code={iconCode}
              size={64}
              className="stroke-current text-foreground"
            />
          </div>

          {/* Temperature */}
          {temperature !== null && (
            <div className="text-lg font-bold text-gray-700 dark:text-gray-100 min-w-[60px] text-center">
              {Math.round(temperature)}°F
            </div>
          )}

          {/* Wind */}
          {windSpeed !== null && windSpeed > 0 && (
            <div className="flex items-center space-x-2 min-w-[70px]">
              <IconWind size={24} className="stroke-current text-blue-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-200">
                {Math.round(windSpeed)} mph
              </span>
            </div>
          )}
        </div>
        
        {/* Weather description below */}
        <div className="text-xs font-medium text-gray-600 dark:text-gray-300 capitalize">
          {iconCode.replace(/-/g, ' ')}
        </div>
      </div>
    );
  };

  // Map text from cfb_live_weekly_inputs to our icon code set
  const mapIconTextToCode = (text: string | null | undefined): string | null => {
    if (!text) return null;
    const t = text.toLowerCase().trim();

    // Night hints
    const isNight = /(night|pm\s*\(night\)|overnight)/.test(t);

    // Rain spectrum
    if (/(drizzle|light rain|rain showers|shower|sprinkle|rainy|rain)/.test(t)) {
      return isNight ? 'showers-night' : /showers|shower|drizzle/.test(t) ? 'showers-day' : 'rain';
    }

    // Thunderstorms
    if (/(t-?storm|thunder|storm)/.test(t)) {
      return t.includes('rain') ? 'thunder-rain' : 'thunder';
    }

    // Snow variants
    if (/(snow|flurries|blowing snow)/.test(t)) {
      return /showers|flurries/.test(t)
        ? (isNight ? 'snow-showers-night' : 'snow-showers-day')
        : 'snow';
    }

    // Mixed precip
    if (/(wintry mix|rain and snow|rain\s*\/\s*snow|sleet)/.test(t)) return 'rain-snow';
    if (/sleet/.test(t)) return 'sleet';
    if (/hail/.test(t)) return 'hail';

    // Fog/Mist/Haze
    if (/(fog|mist|haze|smoke)/.test(t)) return 'fog';

    // Cloud cover
    if (/(overcast)/.test(t)) return 'cloudy';
    if (/(mostly cloudy|broken clouds|considerable cloud)/.test(t)) return 'cloudy';
    if (/(partly sunny|partly cloudy|intermittent cloud|scattered cloud)/.test(t)) {
      return isNight ? 'partly-cloudy-night' : 'partly-cloudy-day';
    }
    if (/cloud/.test(t)) return 'cloudy';

    // Clear/mostly clear
    if (/(clear|sunny|mostly clear)/.test(t)) return isNight ? 'clear-night' : 'clear-day';

    // Windy
    if (/wind/.test(t)) return 'wind';

    // Fallback
    return isNight ? 'clear-night' : 'clear-day';
  };

  // Small weather pill used above team logos
  const WeatherPill = ({ iconText, tempF, windMph, fallbackIcon }: { iconText: string | null | undefined; tempF: number | null | undefined; windMph: number | null | undefined; fallbackIcon?: string | null; }) => {
    const code = mapIconTextToCode(iconText) || fallbackIcon || null;
    const isIceTheme = typeof tempF === 'number' && tempF < 40;

    return (
      <div className="flex justify-center mt-2">
        <div className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm ${
          isIceTheme 
            ? 'border border-cyan-400/60 dark:border-cyan-300/50 bg-gradient-to-r from-cyan-50/90 to-blue-50/90 dark:from-cyan-950/40 dark:to-blue-950/40 backdrop-blur-sm' 
            : 'border border-border bg-background'
        }`}>
          {isIceTheme && (
            <div className="absolute -top-1 -right-1">
              <Box size={14} className="text-cyan-500 dark:text-cyan-400" strokeWidth={2.5} />
            </div>
          )}
          {code && (
            <WeatherIconComponent 
              code={code}
              size={20}
              className={`stroke-current ${isIceTheme ? 'text-cyan-600 dark:text-cyan-300' : 'text-foreground'}`}
            />
          )}
          <div className={`text-xs font-medium ${isIceTheme ? 'text-cyan-700 dark:text-cyan-200' : 'text-foreground'}`}>
            {typeof tempF === 'number' ? `Temp: ${Math.round(tempF)}°F` : 'Temp: --'}
            <span className={`mx-2 ${isIceTheme ? 'text-cyan-500/70 dark:text-cyan-400/70' : 'text-muted-foreground'}`}>•</span>
            {typeof windMph === 'number' ? `Wind: ${Math.round(windMph)} mph` : 'Wind: --'}
          </div>
        </div>
      </div>
    );
  };

  // Spinning football loader for simulator
  const FootballLoader = () => (
    <svg
      className="h-8 w-8 animate-spin mr-2"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="32" cy="32" rx="28" ry="16" fill="#8B4513" />
      <path d="M10 32c0-8.837 9.85-16 22-16s22 7.163 22 16-9.85 16-22 16-22-7.163-22-16z" stroke="#5A3310" strokeWidth="2" fill="none"/>
      <path d="M20 32h24" stroke="#fff" strokeWidth="2"/>
      <path d="M28 28v8M32 28v8M36 28v8" stroke="#fff" strokeWidth="2"/>
      <path d="M14 24c6 4 30 4 36 0" stroke="#5A3310" strokeWidth="2"/>
      <path d="M14 40c6-4 30-4 36 0" stroke="#5A3310" strokeWidth="2"/>
    </svg>
  );

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
      // Parse the time string (format: "15:30:00")
      const [hours, minutes] = timeString.split(':').map(Number);
      
      // Create a date object for today and set the time in EST
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const day = today.getDate();
      
      // Create date in EST timezone
      const estDate = new Date(year, month, day, hours, minutes, 0);
      
      // Format as 12-hour time in EST
      return estDate.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }) + ' EST';
    } catch (error) {
      debug.error('Error formatting time:', error);
      return timeString; // Fallback to original time if formatting fails
    }
  };

  const convertUTCToEST = (utcTimeString: string): string => {
    try {
      // Parse the UTC time string and convert to EST
      const utcDate = new Date(utcTimeString);
      const estTime = utcDate.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `${estTime} EST`;
    } catch (error) {
      debug.error('Error converting UTC to EST:', error);
      return utcTimeString; // Fallback to original time if conversion fails
    }
  };

  // Helper function to round to nearest 0.5
  const roundToHalf = (value: number): number => {
    return Math.round(value * 2) / 2;
  };

  // Helper to format rounded spread with explicit '+' for positives
  const formatSignedHalf = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
    const rounded = roundToHalf(Number(value));
    if (rounded > 0) return `+${rounded}`;
    return rounded.toString();
  };

  // Helper to format rounded value without forcing '+' for positives (keeps '-' for negatives)
  const formatHalfNoSign = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
    const rounded = roundToHalf(Number(value));
    return rounded.toString();
  };

  // Helper function to format edge display
  const formatEdge = (edge: number): string => {
    const roundedEdge = roundToHalf(Math.abs(edge));
    return roundedEdge.toString();
  };

  // Helper function to get edge team info
  const getEdgeInfo = (homeSpreadDiff: number | null, awayTeam: string, homeTeam: string) => {
    if (homeSpreadDiff === null || isNaN(homeSpreadDiff)) return null;
    
    const isHomeEdge = homeSpreadDiff > 0;
    const teamName = isHomeEdge ? homeTeam : awayTeam;
    const edgeValue = Math.abs(homeSpreadDiff);
    
    return {
      teamName,
      edgeValue: roundToHalf(edgeValue),
      isHomeEdge,
      displayEdge: formatEdge(homeSpreadDiff)
    };
  };

  // Helper function to generate edge explanations
  const getEdgeExplanation = (edge: number, team: string, type: 'spread' | 'ou', direction?: 'over' | 'under'): string => {
    const absEdge = Math.abs(edge);
    
    if (type === 'spread') {
      if (absEdge >= 7) {
        return `Our model spread differs from the Vegas line by ${absEdge.toFixed(1)} points, favoring ${team}. This large discrepancy suggests Vegas may have significantly mispriced this matchup. When our model disagrees with the market by this much, it indicates strong betting value - the actual game outcome is likely to be closer to our projection than what the current spread reflects.`;
      } else if (absEdge >= 3) {
        return `Our model's ${absEdge.toFixed(1)}-point difference from the Vegas spread favors ${team}. This moderate edge shows our analytics see the game differently than the market. The gap between our model and Vegas suggests there's value here - we're projecting ${team} will perform better relative to the spread than the current line indicates.`;
      } else {
        return `Our model differs from Vegas by ${absEdge.toFixed(1)} points on ${team}. This small edge indicates our projection is fairly close to the market's assessment. While the value is limited, our model still sees ${team} as slightly better positioned than the Vegas spread suggests.`;
      }
    } else {
      const dir = direction || 'over';
      if (absEdge >= 7) {
        return `Our model's projected total differs from the Vegas line by ${absEdge.toFixed(1)} points, leaning ${dir}. This significant gap between our analytics and the market total suggests Vegas has mispriced this game's scoring potential. When our model and the betting market disagree this strongly, it typically indicates real betting value on the ${dir}.`;
      } else if (absEdge >= 3) {
        return `Our model projects a total that's ${absEdge.toFixed(1)} points different from Vegas, favoring the ${dir}. This moderate discrepancy shows our scoring projection doesn't align with the market. The edge suggests the actual total is more likely to land on the ${dir} side than what the current Vegas number implies.`;
      } else {
        return `Our model's total is ${absEdge.toFixed(1)} points from the Vegas line, slightly favoring the ${dir}. This minimal difference means our projection closely matches the market's assessment. While the edge is small, our analytics still lean toward the ${dir} when compared to what Vegas expects.`;
      }
    }
  };

  const formatStartTime = useMemo(() => {
    const cache = new Map<string, { date: string; time: string }>();
    return (startTimeString: string | null | undefined): { date: string; time: string } => {
      if (!startTimeString) {
        return { date: 'TBD', time: 'TBD' };
      }
      
      // Return cached result if available
      if (cache.has(startTimeString)) {
        return cache.get(startTimeString)!;
      }

    try {
      // Parse the start_time string (format: "2025-10-03 01:00:00+00")
      const utcDate = new Date(startTimeString);
      
      // Format date in EST as "OCT 2, 2025"
      const estMonth = utcDate.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short'
      }).toUpperCase();
      const estDay = utcDate.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        day: 'numeric'
      });
      const estYear = utcDate.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric'
      });
      const estDate = `${estMonth} ${estDay}, ${estYear}`;
      
      // Format time in EST
      const estTime = utcDate.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }) + ' EST';
      
      const result = { date: estDate, time: estTime };
      cache.set(startTimeString, result);
      return result;
    } catch (error) {
      debug.error('Error formatting start time:', error);
      const fallback = { date: 'TBD', time: 'TBD' };
      cache.set(startTimeString, fallback);
      return fallback;
    }
    };
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">College Football</h1>
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

      {/* Game selection dropdown (multi) - Aligned with sort buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-sm font-medium text-foreground">Select games:</span>
        <div ref={dropdownRef} className="relative">
          <Button
            variant="outline"
            onClick={() => setGameDropdownOpen(o => !o)}
            className="bg-white dark:bg-gray-800 text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto whitespace-nowrap transition-all duration-200 border border-gray-200 dark:border-gray-700"
          >
            {selectedGameIds.length === 0 ? 'All Games' : `${selectedGameIds.length} selected`}
            <span className={`ml-2 text-muted-foreground transition-transform ${gameDropdownOpen ? 'rotate-180' : ''}`}>▾</span>
          </Button>
          {gameDropdownOpen && (
          <div className="absolute z-50 mt-2 w-[320px] max-h-72 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg p-2">
            <div className="flex items-center justify-between mb-2">
              <Button variant="outline" className="text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" onClick={() => setSelectedGameIds(predictions.map(p => String(p.id)))}>Select All</Button>
              <Button variant="outline" className="text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" onClick={() => setSelectedGameIds([])}>Clear</Button>
            </div>
            <ul className="space-y-1">
              {predictions
                .slice()
                .sort((a, b) => String(a.away_team).localeCompare(String(b.away_team)))
                .map(p => {
                const id = String(p.id);
                const checked = selectedGameIds.includes(id);
                return (
                  <li key={id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      id={`game-${id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGameSelection(id)}
                      className="cursor-pointer"
                    />
                    <label htmlFor={`game-${id}`} className="text-sm cursor-pointer select-none text-foreground">
                      {p.away_team} @ {p.home_team}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
          )}
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
            variant={sortMode === 'time' ? 'default' : 'outline'}
            className={`${
              sortMode === 'time' 
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40' 
                : 'bg-white dark:bg-gray-800 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700'
            } text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto whitespace-nowrap transition-all duration-200 border border-gray-200 dark:border-gray-700`}
            onClick={() => {
              if (sortMode === 'time') {
                setSortAscending(!sortAscending);
              } else {
                setSortMode('time');
                setSortAscending(false);
              }
            }}
            title="Sort by game time (click to toggle direction)"
          >
            <span className="hidden sm:inline">Sort: Time</span>
            <span className="sm:hidden">Time</span>
            {sortMode === 'time' && (sortAscending ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
          </Button>
          <Button
            variant={sortMode === 'spread' ? 'default' : 'outline'}
            disabled={isFreemiumUser}
            className={`${
              sortMode === 'spread' 
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md shadow-purple-500/30 hover:shadow-lg hover:shadow-purple-500/40' 
                : 'bg-white dark:bg-gray-800 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 dark:hover:from-gray-700 dark:hover:to-gray-700'
            } text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto whitespace-nowrap transition-all duration-200 border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
            onClick={() => {
              if (sortMode === 'spread') {
                setSortAscending(!sortAscending);
              } else {
                setSortMode('spread');
                setSortAscending(false);
              }
            }}
            title={isFreemiumUser ? "Subscribe to unlock sorting" : "Sort by highest Spread edge (click to toggle direction)"}
          >
            {isFreemiumUser && <Lock className="h-3 w-3 mr-1" />}
            <span className="hidden sm:inline">Sort: Spread</span>
            <span className="sm:hidden">Spread</span>
            {sortMode === 'spread' && (sortAscending ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
          </Button>
          <Button
            variant={sortMode === 'ou' ? 'default' : 'outline'}
            disabled={isFreemiumUser}
            className={`${
              sortMode === 'ou' 
                ? 'bg-gradient-to-r from-green-600 to-emerald-700 text-white shadow-md shadow-green-500/30 hover:shadow-lg hover:shadow-green-500/40' 
                : 'bg-white dark:bg-gray-800 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-gray-700 dark:hover:to-gray-700'
            } text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto whitespace-nowrap transition-all duration-200 border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
            onClick={() => {
              if (sortMode === 'ou') {
                setSortAscending(!sortAscending);
              } else {
                setSortMode('ou');
                setSortAscending(false);
              }
            }}
            title={isFreemiumUser ? "Subscribe to unlock sorting" : "Sort by highest Over/Under edge (click to toggle direction)"}
          >
            {isFreemiumUser && <Lock className="h-3 w-3 mr-1" />}
            <span className="hidden sm:inline">Sort: O/U</span>
            <span className="sm:hidden">O/U</span>
            {sortMode === 'ou' && (sortAscending ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
          </Button>
        </div>
        
        {/* Refresh and Last Updated */}
        <div className="flex flex-wrap items-center gap-2">
          {lastUpdated && (
            <span className="text-xs sm:text-sm text-muted-foreground">
              Last Updated: {convertUTCToEST(lastUpdated.toISOString())}
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
                No college football predictions were found in the database.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Team mappings: {teamMappings.length} | Predictions: {predictions.length}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Value Finds Header */}
      {pageHeaderData && (
        <PageHeaderValueFinds
          sportType="cfb"
          summaryText={pageHeaderData.summary_text}
          compactPicks={pageHeaderData.compact_picks}
          valueFindId={valueFindId || undefined}
          isPublished={valueFindPublished}
          onTogglePublish={fetchValueFinds}
          onDelete={fetchValueFinds}
        />
      )}

      <div className="space-y-6 sm:space-y-8 w-full">
        {/* Display all games in a single grid, ordered by date and time */}
        <div className="-mx-4 md:mx-0">
          <div className="grid gap-2 sm:gap-3 md:gap-4 auto-rows-fr" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))' }}>
            {predictions
              .filter(shouldDisplaySelected)
            .sort((a, b) => {
              let result = 0;
              if (sortMode === 'spread') {
                result = getDisplayedSpreadEdge(b) - getDisplayedSpreadEdge(a);
              } else if (sortMode === 'ou') {
                result = getDisplayedOUEdge(b) - getDisplayedOUEdge(a);
              } else {
                // default: by time
                const timeA = a.start_time || a.start_date || a.game_datetime || a.datetime;
                const timeB = b.start_time || b.start_date || b.game_datetime || b.datetime;
                if (timeA && timeB) {
                  result = new Date(timeA).getTime() - new Date(timeB).getTime();
                } else {
                  const idA = String(a.id || '');
                  const idB = String(b.id || '');
                  result = idA.localeCompare(idB);
                }
              }
              // Apply ascending/descending based on sortAscending flag
              return sortAscending ? -result : result;
            })
            .map((prediction, index) => {
              // Freemium logic: Only show first 2 games, blur the rest
              const isLocked = isFreemiumUser && index >= 2;
              const awayTeamColors = getCFBTeamColors(prediction.away_team);
              const homeTeamColors = getCFBTeamColors(prediction.home_team);
              
              // Get high value badge for this game
              const gameId = prediction.training_key || prediction.id;
              const highValueBadge = highValueBadges.get(gameId);
              
              return (
                <div key={prediction.id} className="relative">
                  <CFBGameCard
                    isHovered={focusedCardId === prediction.id && !isLocked}
                    onMouseEnter={() => !isLocked && setFocusedCardId(prediction.id)}
                    onMouseLeave={() => setFocusedCardId(null)}
                    awayTeamColors={awayTeamColors}
                    homeTeamColors={homeTeamColors}
                    homeSpread={prediction.api_spread}
                    awaySpread={prediction.api_spread ? -prediction.api_spread : null}
                    className={isLocked ? 'blur-sm opacity-50' : ''}
                  >
                  {/* Star Button for Admin Mode */}
                  <StarButton gameId={prediction.id} gameType="cfb" />
                  
                  {/* AI Payload Button for Admin Mode */}
                  {adminModeEnabled && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-12 z-10 bg-purple-500/90 hover:bg-purple-600 text-white border-purple-400"
                      onClick={() => {
                        setSelectedPayloadGame(prediction);
                        setPayloadViewerOpen(true);
                      }}
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      AI Payload
                    </Button>
                  )}
                
                <CardContent className="space-y-3 sm:space-y-4 pt-3 pb-3 sm:pt-4 sm:pb-4 px-3 sm:px-4">
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
                  {(prediction.start_time || prediction.start_date || prediction.game_datetime || prediction.datetime) && (
                    <div className="text-center">
                      <div className="text-sm font-medium text-muted-foreground mb-1">
                        {formatStartTime(prediction.start_time || prediction.start_date || prediction.game_datetime || prediction.datetime).date}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">
                        {formatStartTime(prediction.start_time || prediction.start_date || prediction.game_datetime || prediction.datetime).time}
                      </div>
                      {/* Compact Weather Row */}
                      {(prediction.weather_icon_text || prediction.temperature !== null || prediction.wind_speed !== null || prediction.icon_code) && (
                        <WeatherPill 
                          iconText={(prediction as any).weather_icon_text}
                          tempF={(prediction as any).weather_temp_f ?? prediction.temperature}
                          windMph={(prediction as any).weather_windspeed_mph ?? prediction.wind_speed}
                          fallbackIcon={prediction.icon_code}
                        />
                      )}
                    </div>
                  )}

                  {/* Team Logos and Betting Info - Horizontal Layout */}
                  <div className="space-y-2 sm:space-y-3 pt-1">
                    {/* Team Logos Row */}
                    <div className="flex justify-center items-center space-x-3 sm:space-x-4">
                      {/* Away Team Circle */}
                      <div className="text-center w-[120px] sm:w-[140px]">
                        {(() => {
                          const logoUrl = getTeamLogo(prediction.away_team);
                          const hasLogo = logoUrl && logoUrl.trim() !== '';
                          return (
                            <div 
                              className="h-10 w-10 sm:h-14 sm:w-14 mx-auto mb-1.5 sm:mb-2 rounded-full flex items-center justify-center border-2 transition-transform duration-200 hover:scale-105 shadow-lg overflow-hidden"
                              style={{
                                background: hasLogo ? 'transparent' : `linear-gradient(135deg, ${awayTeamColors.primary}, ${awayTeamColors.secondary})`,
                                borderColor: `${awayTeamColors.primary}`
                              }}
                            >
                              {hasLogo ? (
                                <img 
                                  src={logoUrl} 
                                  alt={prediction.away_team}
                                  className="w-full h-full object-contain p-1"
                                  onError={(e) => {
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
                        <div className="text-xs sm:text-sm font-bold mb-1 min-h-[2.5rem] sm:min-h-[3rem] flex items-start justify-center text-foreground leading-tight text-center break-words px-1 pt-1">
                          {prediction.away_team}
                        </div>
                      </div>

                      {/* @ Symbol */}
                      <div className="text-center">
                        <span className="text-3xl sm:text-4xl font-bold text-gray-300 dark:text-gray-500">@</span>
                      </div>

                      {/* Home Team Circle */}
                      <div className="text-center w-[120px] sm:w-[140px]">
                        {(() => {
                          const logoUrl = getTeamLogo(prediction.home_team);
                          const hasLogo = logoUrl && logoUrl.trim() !== '';
                          return (
                            <div 
                              className="h-10 w-10 sm:h-14 sm:w-14 mx-auto mb-1.5 sm:mb-2 rounded-full flex items-center justify-center border-2 transition-transform duration-200 hover:scale-105 shadow-lg overflow-hidden"
                              style={{
                                background: hasLogo ? 'transparent' : `linear-gradient(135deg, ${homeTeamColors.primary}, ${homeTeamColors.secondary})`,
                                borderColor: `${homeTeamColors.primary}`
                              }}
                            >
                              {hasLogo ? (
                                <img 
                                  src={logoUrl} 
                                  alt={prediction.home_team}
                                  className="w-full h-full object-contain p-1"
                                  onError={(e) => {
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
                        <div className="text-xs sm:text-sm font-bold mb-1 min-h-[2.5rem] sm:min-h-[3rem] flex items-start justify-center text-foreground leading-tight text-center break-words px-1 pt-1">
                          {prediction.home_team}
                        </div>
                      </div>
                    </div>

                    {/* Betting Lines Row */}
                    <div className="flex justify-between items-center">
                      {/* Away Team Betting */}
                      <div className="text-center flex-1">
                        <div className="text-base sm:text-lg font-bold h-6 sm:h-8 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          {formatMoneyline(prediction.away_moneyline)}
                        </div>
                        <div className="text-sm sm:text-base font-bold h-5 sm:h-6 flex items-center justify-center text-foreground">
                          {formatSpread(prediction.api_spread ? -prediction.api_spread : null)}
                        </div>
                        {typeof prediction.opening_spread === 'number' && (
                          <div className="mt-1 flex justify-center">
                            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full border bg-background text-foreground border-border">
                              Open: {formatSpread(prediction.opening_spread ? -prediction.opening_spread : null)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Total */}
                      <div className="text-center px-2 sm:px-4">
                        <div className="text-xs sm:text-sm font-bold text-foreground bg-primary/10 dark:bg-primary/20 px-2 sm:px-3 py-1 rounded-full border border-primary/30">
                          Total: {prediction.api_over_line || '-'}
                        </div>
                      </div>

                      {/* Home Team Betting */}
                      <div className="text-center flex-1">
                        <div className="text-base sm:text-lg font-bold h-6 sm:h-8 flex items-center justify-center text-green-600 dark:text-green-400">
                          {formatMoneyline(prediction.home_moneyline)}
                        </div>
                        <div className="text-sm sm:text-base font-bold h-5 sm:h-6 flex items-center justify-center text-foreground">
                          {formatSpread(prediction.api_spread)}
                        </div>
                        {typeof prediction.opening_spread === 'number' && (
                          <div className="mt-1 flex justify-center">
                            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full border bg-background text-foreground border-border">
                              Open: {formatSpread(prediction.opening_spread)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Betting Split Labels Section */}
                  {(prediction.ml_splits_label || prediction.spread_splits_label || prediction.total_splits_label) && (
                    <div className="space-y-2 pt-3 sm:pt-4 border-t-2 border-border">
                      <div className="text-center">
                        <h4 className="text-xs font-bold text-foreground bg-gradient-to-r from-primary/10 to-primary/10 dark:from-primary/20 dark:to-primary/20 px-2 py-0.5 rounded-full border border-border">Public Betting Facts</h4>
                      </div>
                      <div className="space-y-1 sm:space-y-1.5 bg-gradient-to-br from-primary/10 to-primary/10 dark:from-primary/20 dark:to-primary/20 p-2 sm:p-3 rounded-lg border border-border shadow-sm">
                        {prediction.ml_splits_label && (
                          <Badge 
                            variant="outline" 
                            className={`w-full justify-center text-xs ${
                              shouldHighlightLabel(prediction.ml_splits_label) 
                                ? 'bg-primary/20 border-primary text-primary-foreground dark:bg-primary/30' 
                                : 'bg-background border-border text-foreground'
                            }`}
                          >
                            ML: {prediction.ml_splits_label}
                          </Badge>
                        )}
                        {prediction.spread_splits_label && (
                          <Badge 
                            variant="outline" 
                            className={`w-full justify-center text-xs ${
                              shouldHighlightLabel(prediction.spread_splits_label) 
                                ? 'bg-primary/20 border-primary text-primary-foreground dark:bg-primary/30' 
                                : 'bg-background border-border text-foreground'
                            }`}
                          >
                            Spread: {prediction.spread_splits_label}
                          </Badge>
                        )}
                        {prediction.total_splits_label && (
                          <Badge 
                            variant="outline" 
                            className={`w-full justify-center text-xs ${
                              shouldHighlightLabel(prediction.total_splits_label) 
                                ? 'bg-primary/20 border-primary text-primary-foreground dark:bg-primary/30' 
                                : 'bg-background border-border text-foreground'
                            }`}
                          >
                            Total: {prediction.total_splits_label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

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
                      gameDate={prediction.game_date || prediction.start_date || prediction.start_time}
                      awayTeamColors={awayTeamColors}
                      homeTeamColors={homeTeamColors}
                      league="cfb"
                      compact={true}
                    />
                  </div>

                  {/* Compact Model Predictions - Always shown */}
                  {(
                    <div className="pt-3 sm:pt-4">
                      {/* Header */}
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <Brain className="h-4 w-4 text-purple-400" />
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Model Predictions</h4>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {/* Spread Edge */}
                        {(() => {
                          const edgeInfo = getEdgeInfo(prediction.home_spread_diff, prediction.away_team, prediction.home_team);
                          if (!edgeInfo) return null;
                          
                          const edgeValue = edgeInfo.edgeValue;
                          const confidenceColor = edgeValue >= 7 ? 'bg-green-500' : edgeValue >= 3 ? 'bg-orange-500' : 'bg-gray-500';
                          
                          return (
                            <div className={`${confidenceColor} text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5`}>
                              <Target className="h-3 w-3" />
                              <span>Edge to {getTeamInitials(edgeInfo.teamName)} +{edgeInfo.displayEdge}</span>
                            </div>
                          );
                        })()}
                        
                        {/* Over/Under Edge */}
                        {prediction.over_line_diff !== null && (() => {
                          const isOver = prediction.over_line_diff > 0;
                          const magnitude = Math.abs(prediction.over_line_diff);
                          const displayMagnitude = roundToHalf(magnitude).toString();
                          const confidenceColor = magnitude >= 7 ? (isOver ? 'bg-green-500' : 'bg-red-500') : magnitude >= 3 ? (isOver ? 'bg-orange-500' : 'bg-pink-500') : 'bg-gray-500';
                          
                          return (
                            <div className={`${confidenceColor} text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5`}>
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
                    gameUniqueId={prediction.training_key || prediction.id}
                    sport="cfb"
                    homeTeam={prediction.home_team}
                    awayTeam={prediction.away_team}
                    lines={{
                      home_ml: prediction.home_moneyline,
                      away_ml: prediction.away_moneyline,
                      home_spread: prediction.api_spread,
                      away_spread: prediction.api_spread ? -prediction.api_spread : null,
                      total: prediction.api_over_line,
                    }}
                    compact
                  />
                </CardFooter>
              </CFBGameCard>
              
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
            Showing {predictions.filter(shouldDisplaySelected).length} of {predictions.length} predictions
            {searchQuery && ` (filtered by "${searchQuery}")`}
          </p>
        </div>
      )}

      {/* Game Details Modal */}
      <GameDetailsModal
        isOpen={selectedGameForModal !== null}
        onClose={() => setSelectedGameForModal(null)}
        prediction={selectedGameForModal}
        league="cfb"
        aiCompletions={aiCompletions}
        simLoadingById={simLoadingById}
        simRevealedById={simRevealedById}
        setSimLoadingById={setSimLoadingById}
        setSimRevealedById={setSimRevealedById}
        focusedCardId={focusedCardId}
        getTeamInitials={getTeamInitials}
        getContrastingTextColor={getContrastingTextColor}
        cfbTeamMappings={teamMappings}
      />

      {/* Mini WagerBot Chat */}
      <MiniWagerBotChat pageContext={cfbContext} pageId="college-football" />
      
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
          sportType="cfb"
          onCompletionGenerated={handleCompletionGenerated}
        />
      )}
    </div>
  );
}
