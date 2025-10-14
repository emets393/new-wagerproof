import { useState, useEffect, useRef, useMemo } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertCircle, ArrowUp, ArrowDown } from 'lucide-react';
import CFBGameCard from '@/components/CFBGameCard';
import { Button as MovingBorderButton } from '@/components/ui/moving-border';
import { LiquidButton } from '@/components/animate-ui/components/buttons/liquid';
import { MiniWagerBotChat } from '@/components/MiniWagerBotChat';
import { useAuth } from '@/contexts/AuthContext';
import { chatSessionManager } from '@/utils/chatSession';

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
  const [predictions, setPredictions] = useState<CFBPrediction[]>([]);
  const [teamMappings, setTeamMappings] = useState<TeamMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(['All Games']);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
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

  // Build context for WagerBot with all current game data
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
Game ${idx + 1}: ${awayTeam} @ ${homeTeam}
- Date/Time: ${gameDate}
- Spread: ${homeTeam} ${pred.home_spread || pred.api_spread || 'N/A'}
- Moneyline: Away ${pred.away_moneyline || pred.away_ml || 'N/A'} / Home ${pred.home_moneyline || pred.home_ml || 'N/A'}
- Over/Under: ${pred.total_line || pred.api_over_line || 'N/A'}
- Model Predictions:
  * ML Probability: ${pred.pred_ml_proba ? (pred.pred_ml_proba * 100).toFixed(1) + '%' : 'N/A'}
  * Spread Cover Probability: ${pred.pred_spread_proba ? (pred.pred_spread_proba * 100).toFixed(1) + '%' : 'N/A'}
  * Total Probability: ${pred.pred_total_proba ? (pred.pred_total_proba * 100).toFixed(1) + '%' : 'N/A'}
- Predicted Scores: Away ${pred.pred_away_score || pred.pred_away_points || 'N/A'} - Home ${pred.pred_home_score || pred.pred_home_points || 'N/A'}
- Weather: ${pred.weather_temp_f || pred.temperature ? (pred.weather_temp_f || pred.temperature) + '°F' : 'N/A'}, Wind: ${pred.weather_windspeed_mph || pred.wind_speed ? (pred.weather_windspeed_mph || pred.wind_speed) + ' mph' : 'N/A'}
- Public Betting Splits:
  * Spread: ${pred.spread_splits_label || 'N/A'}
  * Total: ${pred.total_splits_label || 'N/A'}
  * ML: ${pred.ml_splits_label || 'N/A'}`;
        } catch (err) {
          console.error('Error building context for game:', pred, err);
          return '';
        }
      }).filter(Boolean).join('\n');
      
      return `## College Football Games Data (${preds.length} total games)
${contextParts}

Note: Probabilities are from the predictive model. Use this data to provide specific insights about matchups, value opportunities, and betting recommendations.`;
    } catch (error) {
      console.error('Error building CFB context:', error);
      return ''; // Return empty string if there's an error
    }
  };

  // Memoize the context to prevent infinite re-renders
  // Use predictions.length and first game ID as dependency to avoid array reference issues
  const cfbContext = useMemo(() => {
    const context = buildCFBContext(predictions);
    
    // Debug logging for context
    if (context) {
      console.log('📊 CFB Context Generated:', {
        length: context.length,
        gameCount: predictions.length,
        preview: context.substring(0, 300) + '...',
        fullContext: context // Full context for debugging
      });
    }
    
    return context;
  }, [predictions.length, predictions[0]?.id]);

  // Check if a game should be displayed based on dropdown selections
  const shouldDisplaySelected = (prediction: CFBPrediction): boolean => {
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

  // Team acronym mapping function
  const getTeamAcronym = (teamName: string): string => {
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
      console.log('🔄 Refresh triggered - clearing chat session to force new context');
      if (user) {
        chatSessionManager.clearPageSession(user.id, 'college-football');
      }
      
      console.log('Fetching college football data...');
      
      // Fetch team mappings first
      const { data: mappings, error: mappingsError } = await collegeFootballSupabase
        .from('cfb_team_mapping')
        .select('api, logo_light');
      
      if (mappingsError) {
        console.error('Error fetching team mappings:', mappingsError);
        setError(`Team mappings error: ${mappingsError.message}`);
        return;
      }
      
      console.log('Team mappings fetched:', mappings?.length || 0);
      setTeamMappings(mappings || []);

        // Fetch predictions - no date filtering needed
        const { data: preds, error: predsError } = await collegeFootballSupabase
          .from('cfb_live_weekly_inputs')
          .select('*');

        if (predsError) {
          console.error('Error fetching predictions:', predsError);
          setError(`Predictions error: ${predsError.message}`);
          return;
        }

        console.log('Predictions fetched:', preds?.length || 0);
        console.log('Sample prediction data:', preds?.[0]); // Log first prediction to see structure

        // Fetch prediction data from cfb_api_predictions
        const { data: apiPreds, error: apiPredsError } = await collegeFootballSupabase
          .from('cfb_api_predictions')
          .select('*');

        if (apiPredsError) {
          console.error('Error fetching API predictions:', apiPredsError);
          setError(`API predictions error: ${apiPredsError.message}`);
          return;
        }

        console.log('API predictions fetched:', apiPreds?.length || 0);
        console.log('Sample API prediction data:', apiPreds?.[0]); // Log first API prediction to see structure

        // Map API prediction data; weather display comes directly from cfb_live_weekly_inputs fields
        const predictionsWithWeather = (preds || []).map(prediction => {
          const apiPred = apiPreds?.find(ap => ap.id === prediction.id);
          
          // Debug logging for first prediction
          if (prediction.id === preds?.[0]?.id) {
            console.log('Mapping prediction:', prediction.id);
            console.log('Found API pred:', apiPred);
            console.log('All API pred columns:', Object.keys(apiPred || {}));
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
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    const mapping = teamMappings.find(m => m.api === teamName);
    return mapping?.logo_light || '';
  };

  // Professional weather icons from Visual Crossing with horizontal layout
  const WeatherIcon = ({ iconCode, temperature, windSpeed }: { 
    iconCode: string | null; 
    temperature: number | null; 
    windSpeed: number | null; 
  }) => {
    if (!iconCode) return null;

    // Map icon codes to SVG filenames
    const getWeatherIconPath = (code: string): string => {
      const iconMap: { [key: string]: string } = {
        'clear-day': 'clear-day.svg',
        'clear-night': 'clear-night.svg',
        'partly-cloudy-day': 'partly-cloudy-day.svg',
        'partly-cloudy-night': 'partly-cloudy-night.svg',
        'cloudy': 'cloudy.svg',
        'rain': 'rain.svg',
        'showers-day': 'showers-day.svg',
        'showers-night': 'showers-night.svg',
        'snow': 'snow.svg',
        'snow-showers-day': 'snow-showers-day.svg',
        'snow-showers-night': 'snow-showers-night.svg',
        'sleet': 'sleet.svg',
        'fog': 'fog.svg',
        'thunder': 'thunder.svg',
        'thunder-showers-day': 'thunder-showers-day.svg',
        'thunder-showers-night': 'thunder-showers-night.svg',
        'thunder-rain': 'thunder-rain.svg',
        'rain-snow': 'rain-snow.svg',
        'rain-snow-showers-day': 'rain-snow-showers-day.svg',
        'rain-snow-showers-night': 'rain-snow-showers-night.svg',
        'hail': 'hail.svg'
      };

      // Try exact match first, then partial matches
      if (iconMap[code]) {
        return iconMap[code];
      }

      // Fallback to partial matches
      if (code.includes('clear')) {
        return code.includes('night') ? 'clear-night.svg' : 'clear-day.svg';
      }
      if (code.includes('partly')) {
        return code.includes('night') ? 'partly-cloudy-night.svg' : 'partly-cloudy-day.svg';
      }
      if (code.includes('rain') && code.includes('snow')) {
        return code.includes('night') ? 'rain-snow-showers-night.svg' : 'rain-snow-showers-day.svg';
      }
      if (code.includes('rain')) {
        return code.includes('night') ? 'showers-night.svg' : 'showers-day.svg';
      }
      if (code.includes('snow')) {
        return code.includes('night') ? 'snow-showers-night.svg' : 'snow-showers-day.svg';
      }
      if (code.includes('thunder')) {
        if (code.includes('rain')) return 'thunder-rain.svg';
        return code.includes('night') ? 'thunder-showers-night.svg' : 'thunder-showers-day.svg';
      }
      if (code.includes('cloudy') || code.includes('cloud')) {
        return 'cloudy.svg';
      }
      if (code.includes('fog') || code.includes('mist') || code.includes('haze')) {
        return 'fog.svg';
      }

      // Default fallback
      return 'clear-day.svg';
    };

    const iconPath = getWeatherIconPath(iconCode);

    return (
      <div className="text-center">
        {/* Horizontal layout: Weather Icon | Temperature | Wind */}
        <div className="flex items-center justify-center space-x-4 mb-2">
          {/* Weather Icon */}
          <div className="w-16 h-16 flex items-center justify-center">
            <img 
              src={`/weather-icons/${iconPath}`}
              alt={iconCode}
              className="w-full h-full object-contain"
              onError={(e) => {
                // Fallback to emoji if SVG fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = document.createElement('div');
                fallback.className = 'w-full h-full flex items-center justify-center text-2xl';
                fallback.textContent = iconCode.includes('night') ? '🌙' : '☀️';
                target.parentNode?.appendChild(fallback);
              }}
            />
          </div>

          {/* Temperature */}
          {temperature !== null && (
            <div className="text-lg font-bold text-gray-700 min-w-[60px] text-center">
              {Math.round(temperature)}°F
            </div>
          )}

          {/* Wind */}
          {windSpeed !== null && windSpeed > 0 && (
            <div className="flex items-center space-x-2 min-w-[70px]">
              <div className="text-2xl text-blue-500">
                💨
              </div>
              <span className="text-sm font-medium text-gray-600">
                {Math.round(windSpeed)} mph
              </span>
            </div>
          )}
        </div>
        
        {/* Weather description below */}
        <div className="text-xs font-medium text-gray-600 capitalize">
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
    const iconPath = code
      ? (() => {
          const iconMap: { [key: string]: string } = {
            'clear-day': 'clear-day.svg',
            'clear-night': 'clear-night.svg',
            'partly-cloudy-day': 'partly-cloudy-day.svg',
            'partly-cloudy-night': 'partly-cloudy-night.svg',
            'cloudy': 'cloudy.svg',
            'rain': 'rain.svg',
            'showers-day': 'showers-day.svg',
            'showers-night': 'showers-night.svg',
            'snow': 'snow.svg',
            'snow-showers-day': 'snow-showers-day.svg',
            'snow-showers-night': 'snow-showers-night.svg',
            'sleet': 'sleet.svg',
            'fog': 'fog.svg',
            'thunder': 'thunder.svg',
            'thunder-showers-day': 'thunder-showers-day.svg',
            'thunder-showers-night': 'thunder-showers-night.svg',
            'thunder-rain': 'thunder-rain.svg',
            'rain-snow': 'rain-snow.svg',
            'hail': 'hail.svg',
            'wind': 'wind.svg'
          };
          return iconMap[code] || 'clear-day.svg';
        })()
      : null;

    return (
      <div className="flex justify-center mt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background shadow-sm">
          {iconPath && (
            <img src={`/weather-icons/${iconPath}`} alt={code || 'weather'} className="h-5 w-5 object-contain" />
          )}
          <div className="text-xs font-medium text-foreground">
            {typeof tempF === 'number' ? `Temp: ${Math.round(tempF)}°F` : 'Temp: --'}
            <span className="mx-2 text-muted-foreground">•</span>
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
      console.error('Error formatting time:', error);
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
      console.error('Error converting UTC to EST:', error);
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
      console.error('Error formatting start time:', error);
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
    <div className="container mx-auto px-4 py-6">

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
            onClick={() => setSortMode('time')}
            title="Sort by game time"
          >
            <span className="hidden sm:inline">Sort: Time</span>
            <span className="sm:hidden">Time</span>
          </Button>
          <Button
            variant={sortMode === 'spread' ? 'default' : 'outline'}
            className={`${
              sortMode === 'spread' 
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md shadow-purple-500/30 hover:shadow-lg hover:shadow-purple-500/40' 
                : 'bg-white dark:bg-gray-800 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 dark:hover:from-gray-700 dark:hover:to-gray-700'
            } text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto whitespace-nowrap transition-all duration-200 border border-gray-200 dark:border-gray-700`}
            onClick={() => setSortMode('spread')}
            title="Sort by highest Spread edge"
          >
            <span className="hidden sm:inline">Sort: Spread</span>
            <span className="sm:hidden">Spread</span>
          </Button>
          <Button
            variant={sortMode === 'ou' ? 'default' : 'outline'}
            className={`${
              sortMode === 'ou' 
                ? 'bg-gradient-to-r from-green-600 to-emerald-700 text-white shadow-md shadow-green-500/30 hover:shadow-lg hover:shadow-green-500/40' 
                : 'bg-white dark:bg-gray-800 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-gray-700 dark:hover:to-gray-700'
            } text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto whitespace-nowrap transition-all duration-200 border border-gray-200 dark:border-gray-700`}
            onClick={() => setSortMode('ou')}
            title="Sort by highest Over/Under edge"
          >
            <span className="hidden sm:inline">Sort: O/U</span>
            <span className="sm:hidden">O/U</span>
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
                No college football predictions were found in the database.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Team mappings: {teamMappings.length} | Predictions: {predictions.length}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6 sm:space-y-8">
        {/* Display all games in a single grid, ordered by date and time */}
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {predictions
            .filter(shouldDisplaySelected)
            .sort((a, b) => {
              if (sortMode === 'spread') {
                return getDisplayedSpreadEdge(b) - getDisplayedSpreadEdge(a);
              }
              if (sortMode === 'ou') {
                return getDisplayedOUEdge(b) - getDisplayedOUEdge(a);
              }
              // default: by time
              const timeA = a.start_time || a.start_date || a.game_datetime || a.datetime;
              const timeB = b.start_time || b.start_date || b.game_datetime || b.datetime;
              if (timeA && timeB) {
                return new Date(timeA).getTime() - new Date(timeB).getTime();
              }
              const idA = String(a.id || '');
              const idB = String(b.id || '');
              return idA.localeCompare(idB);
            })
            .map((prediction) => {
              const awayTeamColors = getCFBTeamColors(prediction.away_team);
              const homeTeamColors = getCFBTeamColors(prediction.home_team);
              
              return (
                <CFBGameCard
                  key={prediction.id}
                  isHovered={focusedCardId === prediction.id}
                  onMouseEnter={() => setFocusedCardId(prediction.id)}
                  onMouseLeave={() => setFocusedCardId(null)}
                  awayTeamColors={awayTeamColors}
                  homeTeamColors={homeTeamColors}
                  homeSpread={prediction.api_spread}
                  awaySpread={prediction.api_spread ? -prediction.api_spread : null}
                >
                <CardContent className="space-y-3 sm:space-y-5 pt-3 pb-3 sm:pt-5 sm:pb-5">
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
                  <div className="space-y-2 sm:space-y-4 pt-1.5">
                    {/* Team Logos Row */}
                    <div className="flex justify-center items-center space-x-4 sm:space-x-6">
                      {/* Away Team Logo */}
                      <div className="text-center w-[140px] sm:w-[160px]">
                        {getTeamLogo(prediction.away_team) && (
                          <img 
                            src={getTeamLogo(prediction.away_team)} 
                            alt={`${prediction.away_team} logo`}
                            className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-2 sm:mb-3 drop-shadow-lg filter hover:scale-105 transition-transform duration-200"
                          />
                        )}
                        <div className="text-sm sm:text-base font-bold mb-1 sm:mb-2 min-h-[3rem] sm:min-h-[3.5rem] flex items-start justify-center text-foreground leading-tight text-center break-words px-1 pt-2">
                          {prediction.away_team}
                        </div>
                      </div>

                      {/* @ Symbol */}
                      <div className="text-center">
                        <span className="text-xl sm:text-2xl font-bold text-muted-foreground">@</span>
                      </div>

                      {/* Home Team Logo */}
                      <div className="text-center w-[140px] sm:w-[160px]">
                        {getTeamLogo(prediction.home_team) && (
                          <img 
                            src={getTeamLogo(prediction.home_team)} 
                            alt={`${prediction.home_team} logo`}
                            className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-2 sm:mb-3 drop-shadow-lg filter hover:scale-105 transition-transform duration-200"
                          />
                        )}
                        <div className="text-sm sm:text-base font-bold mb-1 sm:mb-2 min-h-[3rem] sm:min-h-[3.5rem] flex items-start justify-center text-foreground leading-tight text-center break-words px-1 pt-2">
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
                    <div className="space-y-2 sm:space-y-3 pt-4 sm:pt-6 border-t-2 border-border">
                      <div className="text-center">
                        <h4 className="text-xs sm:text-sm font-bold text-foreground bg-gradient-to-r from-primary/10 to-primary/10 dark:from-primary/20 dark:to-primary/20 px-2 sm:px-3 py-1 rounded-full border border-border">Public Betting Facts</h4>
                      </div>
                      <div className="space-y-1.5 sm:space-y-2 bg-gradient-to-br from-primary/10 to-primary/10 dark:from-primary/20 dark:to-primary/20 p-3 sm:p-4 rounded-lg border border-border shadow-sm">
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

                  {/* Model Predictions Section */}
                  {(prediction.pred_spread !== null || prediction.home_spread_diff !== null || prediction.pred_over_line !== null || prediction.over_line_diff !== null) && (
                    <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 border-t-2 border-border">
                      <div className="text-center">
                        <h4 className="text-sm sm:text-base font-bold text-foreground bg-gradient-to-r from-primary/10 to-primary/10 dark:from-primary/20 dark:to-primary/20 px-3 sm:px-4 py-2 rounded-full border border-primary/30">Model Predictions</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {/* Spread Edge Display (left) */}
                        {(() => {
                          const edgeInfo = getEdgeInfo(prediction.home_spread_diff, prediction.away_team, prediction.home_team);

                          if (!edgeInfo) {
                            return (
                              <div className="bg-gradient-to-r from-muted/20 to-muted/20 rounded-xl border border-border p-4 sm:p-6">
                                <div className="text-center">
                                  <h5 className="text-sm sm:text-base font-bold text-foreground mb-3 pb-2 border-b border-border">Spread</h5>
                                  <div className="text-sm text-muted-foreground">Edge calculation unavailable</div>
                                  <div className="mt-3">
                                    <div className="text-xs sm:text-sm font-semibold text-muted-foreground mb-1">Model Spread</div>
                                    <div className="text-2xl sm:text-3xl font-bold text-foreground">
                                      {formatSignedHalf(prediction.pred_spread)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="bg-slate-50 dark:bg-muted/20 rounded-xl border border-border shadow-sm p-4 sm:p-6 h-full flex flex-col">
                              <div className="text-center">
                                <h5 className="text-base sm:text-lg font-bold text-foreground mb-3 pb-2 border-b border-border">Spread</h5>

                                <div className="flex-1 flex items-center justify-center space-x-5 min-h-[120px]">
                                  {/* Team Logo */}
                                  <div className="flex-shrink-0">
                                    {getTeamLogo(edgeInfo.teamName) && (
                                      <img
                                        src={getTeamLogo(edgeInfo.teamName)}
                                        alt={`${edgeInfo.teamName} logo`}
                                        className="h-14 w-14 sm:h-20 sm:w-20 drop-shadow-lg filter hover:scale-105 transition-transform duration-200"
                                      />
                                    )}
                                  </div>

                                  {/* Edge Value */}
                                  <div className="text-center">
                                    <div className="text-3xl sm:text-4xl font-bold text-foreground mb-1">
                                      {edgeInfo.displayEdge}
                                    </div>
                                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Edge to {getTeamAcronym(edgeInfo.teamName)}</div>
                                  </div>
                                </div>

                                {/* Model Spread Only */}
                                <div className="mt-4">
                                  <div className="text-sm sm:text-base font-semibold text-muted-foreground mb-1">Model Spread</div>
                                  {(() => {
                                    let modelSpreadDisplay = prediction.pred_spread;
                                    if (!edgeInfo.isHomeEdge) {
                                      if (modelSpreadDisplay !== null) modelSpreadDisplay = -modelSpreadDisplay;
                                    }
                                    return (
                                      <div className="text-3xl sm:text-4xl font-bold text-foreground">
                                        {formatSignedHalf(modelSpreadDisplay)}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Over/Under Edge Display (right) */}
                        {(() => {
                          const ouDiff = prediction.over_line_diff;
                          const hasOuData = ouDiff !== null || prediction.pred_over_line !== null || prediction.api_over_line !== null;

                          if (!hasOuData) {
                            return (
                              <div className="bg-gradient-to-r from-muted/20 to-muted/20 rounded-xl border border-border p-4 sm:p-6">
                                <div className="text-center">
                                  <div className="text-xs sm:text-sm font-semibold text-muted-foreground mb-3">Over/Under Edge</div>
                                  <div className="text-sm text-muted-foreground">No O/U data available</div>
                                </div>
                              </div>
                            );
                          }

                          const isOver = (ouDiff ?? 0) > 0;
                          const magnitude = Math.abs(ouDiff ?? 0);
                          const displayMagnitude = roundToHalf(magnitude).toString();
                          const modelValue = prediction.pred_over_line;

                          return (
                            <div className={`rounded-xl border p-4 sm:p-6 h-full flex flex-col bg-slate-50 dark:bg-muted/20 border-border shadow-sm`}>
                              <div className="text-center">
                                <h5 className={`text-base sm:text-lg font-bold mb-3 pb-2 border-b ${isOver ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'} border-border`}>Over/Under</h5>

                                <div className="flex-1 flex items-center justify-center space-x-5 min-h-[120px]">
                                  {/* Arrow Indicator */}
                                  <div className="flex-shrink-0">
                                    {isOver ? (
                                      <div className="flex flex-col items-center">
                                        <ArrowUp className="h-14 w-14 sm:h-20 sm:w-20 text-emerald-600" />
                                        <div className="text-xs font-bold text-emerald-700 -mt-2">Over</div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center">
                                        <ArrowDown className="h-14 w-14 sm:h-20 sm:w-20 text-rose-600" />
                                        <div className="text-xs font-bold text-rose-700 -mt-2">Under</div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Edge Value */}
                                  <div className="text-center">
                                    <div className={`text-3xl sm:text-4xl font-bold mb-1 ${isOver ? 'text-emerald-600' : 'text-rose-600'}`}>{displayMagnitude}</div>
                                    <div className={`text-xs sm:text-sm font-medium ${isOver ? 'text-emerald-700' : 'text-rose-700'}`}>Edge to {isOver ? 'Over' : 'Under'}</div>
                                  </div>
                                </div>

                                {/* Model O/U Only */}
                                <div className="mt-4">
                                  <div className={`text-sm sm:text-base font-semibold mb-1 ${isOver ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>Model O/U</div>
                                  <div className={`text-3xl sm:text-4xl font-bold ${isOver ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{formatHalfNoSign(modelValue)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Match Simulator Section */}
                  <div className="space-y-2 sm:space-y-3 pt-4 sm:pt-6 border-t-2 border-border">
                    <div className="text-center">
                      <h4 className="text-xs sm:text-sm font-bold text-foreground bg-gradient-to-r from-orange-50 to-orange-50 dark:from-orange-950/30 dark:to-orange-950/30 px-2 sm:px-3 py-1 rounded-full border border-border">Match Simulator</h4>
                    </div>

                    {/* Simulate Button or Loading */}
                    {!simRevealedById[prediction.id] && (
                      <div className="flex justify-center">
                        {focusedCardId === prediction.id ? (
                          <MovingBorderButton
                            borderRadius="0.5rem"
                            containerClassName="h-auto w-auto"
                            borderClassName="bg-[radial-gradient(hsl(var(--primary))_40%,transparent_60%)]"
                            duration={3000}
                            className="bg-card dark:bg-card text-foreground dark:text-foreground border-border px-6 py-6 text-lg font-bold h-full w-full"
                            disabled={!!simLoadingById[prediction.id]}
                            onClick={() => {
                              setSimLoadingById(prev => ({ ...prev, [prediction.id]: true }));
                              setTimeout(() => {
                                setSimLoadingById(prev => ({ ...prev, [prediction.id]: false }));
                                setSimRevealedById(prev => ({ ...prev, [prediction.id]: true }));
                              }, 2500);
                            }}
                          >
                            {simLoadingById[prediction.id] ? (
                              <span className="flex items-center">
                                <FootballLoader /> Simulating…
                              </span>
                            ) : (
                              'Simulate Match'
                            )}
                          </MovingBorderButton>
                        ) : (
                          <Button
                            disabled={!!simLoadingById[prediction.id]}
                            onClick={() => {
                              setSimLoadingById(prev => ({ ...prev, [prediction.id]: true }));
                              setTimeout(() => {
                                setSimLoadingById(prev => ({ ...prev, [prediction.id]: false }));
                                setSimRevealedById(prev => ({ ...prev, [prediction.id]: true }));
                              }, 2500);
                            }}
                            className="px-6 py-6 text-lg font-bold bg-card dark:bg-card text-foreground dark:text-foreground border-2 border-border shadow-md hover:bg-muted/50"
                          >
                            {simLoadingById[prediction.id] ? (
                              <span className="flex items-center">
                                <FootballLoader /> Simulating…
                              </span>
                            ) : (
                              'Simulate Match'
                            )}
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Revealed Score Layout */}
                    {simRevealedById[prediction.id] && (
                      <div className="flex justify-between items-center bg-gradient-to-br from-orange-50 to-orange-50 dark:from-orange-950/30 dark:to-orange-950/30 p-3 sm:p-4 rounded-lg border border-border">
                        {/* Away Team Score */}
                        <div className="text-center flex-1">
                          {getTeamLogo(prediction.away_team) && (
                            <img 
                              src={getTeamLogo(prediction.away_team)} 
                              alt={`${prediction.away_team} logo`}
                              className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-1 sm:mb-2 drop-shadow-md"
                            />
                          )}
                          <div className="text-xl sm:text-2xl font-bold text-foreground">
                            {(() => {
                              const val = prediction.pred_away_points ?? prediction.pred_away_score;
                              return val !== null && val !== undefined ? Math.round(Number(val)).toString() : '-';
                            })()}
                          </div>
                        </div>

                        {/* VS Separator */}
                        <div className="text-center px-3 sm:px-4">
                          <div className="text-base sm:text-lg font-bold text-muted-foreground">VS</div>
                        </div>

                        {/* Home Team Score */}
                        <div className="text-center flex-1">
                          {getTeamLogo(prediction.home_team) && (
                            <img 
                              src={getTeamLogo(prediction.home_team)} 
                              alt={`${prediction.home_team} logo`}
                              className="h-12 w-12 mx-auto mb-2 drop-shadow-md"
                            />
                          )}
                          <div className="text-xl sm:text-2xl font-bold text-foreground">
                            {(() => {
                              const val = prediction.pred_home_points ?? prediction.pred_home_score;
                              return val !== null && val !== undefined ? Math.round(Number(val)).toString() : '-';
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Weather section removed; using compact WeatherPill above */}
                </CardContent>
              </CFBGameCard>
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

      {/* Mini WagerBot Chat */}
      <MiniWagerBotChat pageContext={cfbContext} pageId="college-football" />
    </div>
  );
} 