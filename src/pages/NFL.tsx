import { useState, useEffect } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertCircle, History, TrendingUp, BarChart, ScatterChart } from 'lucide-react';
import { LiquidButton } from '@/components/animate-ui/components/buttons/liquid';
import { Link } from 'react-router-dom';
import H2HModal from '@/components/H2HModal';
import LineMovementModal from '@/components/LineMovementModal';
import NFLGameCard from '@/components/NFLGameCard';
import HistoricalDataSection from '@/components/HistoricalDataSection';
import { BackgroundGradient } from '@/components/ui/background-gradient';
import ElectricBorder from '@/components/ui/electric-border';
import { MiniWagerBotChat } from '@/components/MiniWagerBotChat';

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

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching NFL data...');
      
      // Get today's date in YYYY-MM-DD format for filtering
      const today = new Date().toISOString().split('T')[0];
      console.log('Filtering games from today onwards:', today);
      
      // Fetch team mappings from database (without logo_url since it doesn't exist)
      const { data: teamMappingsData, error: teamMappingsError } = await collegeFootballSupabase
        .from('nfl_team_mapping')
        .select('city_and_name, team_name');
      
      if (teamMappingsError) {
        console.error('Error fetching team mappings:', teamMappingsError);
      } else {
        console.log('Team mappings fetched:', teamMappingsData);
        console.log('Number of team mappings:', teamMappingsData?.length);
        if (teamMappingsData && teamMappingsData.length > 0) {
          console.log('First few team mappings:', teamMappingsData.slice(0, 3));
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
        console.error('Error fetching betting lines:', bettingError);
        setError(`Betting lines error: ${bettingError.message}`);
        return;
      }

      console.log('Betting lines fetched:', bettingData?.length || 0);

      // Create a map of most recent betting lines by training_key
      const bettingMap = new Map();
      bettingData?.forEach(bet => {
        const key = bet.training_key;
        if (!bettingMap.has(key) || new Date(bet.as_of_ts) > new Date(bettingMap.get(key).as_of_ts)) {
          bettingMap.set(key, bet);
        }
      });

      console.log('Betting map created with', bettingMap.size, 'entries');

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
        console.error('Error fetching latest run_id:', runError);
        setError(`Run ID error: ${runError.message}`);
        return;
      }

      const latestRunId = latestRun?.run_id;
      if (!latestRunId) {
        console.log('No predictions found for today onwards');
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
        console.error('Error fetching predictions:', predsError);
        setError(`Predictions error: ${predsError.message}`);
        return;
      }

      console.log('Predictions fetched:', preds?.length || 0);
      if (preds && preds.length > 0) {
        console.log('Sample prediction data:', preds[0]);
        console.log('Available columns in prediction:', Object.keys(preds[0]));
      }

      // Fetch weather data
      const { data: weatherData, error: weatherError } = await collegeFootballSupabase
        .from('production_weather')
        .select('*');

      if (weatherError) {
        console.error('Error fetching weather data:', weatherError);
        console.warn('Weather data unavailable, continuing without weather info');
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
        
        console.log('=== DEBUGGING DATA MATCHING ===');
        console.log('Prediction training_key:', prediction.training_key);
        console.log('Weather match found:', !!weather);
        console.log('Betting match found:', !!betting);
        console.log('=====================================');
        
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
      console.error('Error fetching data:', err);
      setError(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    console.log(`Looking for logo for team: ${teamName}, found mapping:`, mapping);
    return mapping?.logo_url || '/placeholder.svg';
  };

  // Weather icons (reusing from college football)
  const WeatherIcon = ({ iconCode, temperature, windSpeed }: { 
    iconCode: string | null; 
    temperature: number | null; 
    windSpeed: number | null; 
  }) => {
    if (!iconCode) return null;

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

      if (iconMap[code]) {
        return iconMap[code];
      }

      // Fallback logic
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

      return 'clear-day.svg';
    };

    const iconPath = getWeatherIconPath(iconCode);

    return (
      <div className="text-center">
        <div className="flex items-center justify-center space-x-4 mb-2">
          <div className="w-16 h-16 flex items-center justify-center">
            <img 
              src={`/weather-icons/${iconPath}`}
              alt={iconCode}
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = document.createElement('div');
                fallback.className = 'w-full h-full flex items-center justify-center text-2xl';
                fallback.textContent = iconCode.includes('night') ? '🌙' : '☀️';
                target.parentNode?.appendChild(fallback);
              }}
            />
          </div>

          {temperature !== null && (
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100 min-w-[60px] text-center">
              {Math.round(temperature)}°F
            </div>
          )}

          {windSpeed !== null && windSpeed > 0 && (
            <div className="flex items-center space-x-2 min-w-[70px]">
              <div className="text-2xl text-blue-500">💨</div>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {Math.round(windSpeed)} mph
              </span>
            </div>
          )}
        </div>
        
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize">
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
      console.error('Error formatting time:', error);
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
                <CardContent className="space-y-4 sm:space-y-6 pt-4 pb-4 sm:pt-6 sm:pb-6">
                  {/* Game Date and Time */}
                  <div className="text-center space-y-2">
                    <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
                      {formatCompactDate(prediction.game_date)}
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 sm:px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 inline-block">
                      {convertTimeToEST(prediction.game_time)}
                    </div>
                  </div>

                  {/* Team Logos and Betting Info */}
                  <div className="space-y-3 sm:space-y-4 pt-2">
                    <div className="flex justify-between items-start">
                      {/* Away Team */}
                      <div className="text-center flex-1">
                        {getTeamLogo(prediction.away_team) && (
                          <img 
                            src={getTeamLogo(prediction.away_team)} 
                            alt={`${prediction.away_team} logo`}
                            className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-2 sm:mb-3 drop-shadow-lg filter hover:scale-105 transition-transform duration-200"
                          />
                        )}
                        <div className="hidden sm:flex text-lg sm:text-xl font-bold mb-1 sm:mb-2 h-6 sm:h-8 items-center justify-center text-gray-900 dark:text-gray-100">
                          {prediction.away_team}
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground h-5 sm:h-6 flex items-center justify-center">
                          Spread: {formatSpread(prediction.away_spread)}
                        </div>
                        <div className="text-base sm:text-lg font-bold h-6 sm:h-8 flex items-center justify-center text-blue-600">
                          {formatMoneyline(prediction.away_ml)}
                        </div>
                      </div>

                      {/* @ Symbol and Total */}
                      <div className="text-center px-2 sm:px-4 flex flex-col items-center justify-center">
                        <span className="text-4xl sm:text-5xl font-bold text-gray-400 dark:text-gray-500 mb-2 sm:mb-3">@</span>
                        <div className="text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-100 bg-blue-50 dark:bg-blue-900/30 px-2 sm:px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                          Total: {prediction.over_line || '-'}
                        </div>
                      </div>

                      {/* Home Team */}
                      <div className="text-center flex-1">
                        {getTeamLogo(prediction.home_team) && (
                          <img 
                            src={getTeamLogo(prediction.home_team)} 
                            alt={`${prediction.home_team} logo`}
                            className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-2 sm:mb-3 drop-shadow-lg filter hover:scale-105 transition-transform duration-200"
                          />
                        )}
                        <div className="hidden sm:flex text-lg sm:text-xl font-bold mb-1 sm:mb-2 h-6 sm:h-8 items-center justify-center text-gray-900 dark:text-gray-100">
                          {prediction.home_team}
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground h-5 sm:h-6 flex items-center justify-center">
                          Spread: {formatSpread(prediction.home_spread)}
                        </div>
                        <div className="text-base sm:text-lg font-bold h-6 sm:h-8 flex items-center justify-center text-green-600">
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
                  <div className="text-center pt-4 sm:pt-6 border-t-2 border-gray-200 dark:border-gray-700">
                    <div className="bg-gradient-to-br from-gray-50 to-slate-50/30 dark:from-gray-800/50 dark:to-slate-800/20 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                      {/* Header */}
                      <h4 className="text-lg sm:text-xl font-bold text-gray-400 dark:text-gray-500">Model Predictions</h4>
                      
                      {/* Spread Predictions */}
                      {prediction.home_away_spread_cover_prob !== null && (
                        <div className="space-y-3">
                          <h5 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Spread</h5>
                          {(() => {
                            const isHome = prediction.home_away_spread_cover_prob > 0.5;
                            const predictedTeam = isHome ? prediction.home_team : prediction.away_team;
                            const predictedSpread = isHome ? prediction.home_spread : prediction.away_spread;
                            const confidencePct = Math.round((isHome ? prediction.home_away_spread_cover_prob : 1 - prediction.home_away_spread_cover_prob) * 100);
                            const confidenceColorClass =
                              confidencePct <= 58 ? 'text-rose-600' :
                              confidencePct <= 65 ? 'text-orange-500' :
                              'text-emerald-600';
                            const teamColor = getTeamColorForMode(isHome ? homeTeamColors : awayTeamColors);
                            return (
                              <div className="grid grid-cols-2 items-stretch gap-4 sm:gap-6">
                                {/* Left: Logo + Team (spread) */}
                                <BackgroundGradient 
                                  className="h-28 sm:h-32 md:h-36 rounded-3xl bg-white dark:bg-gray-900 flex flex-col items-center justify-center"
                                  colors={[teamColor, teamColor]}
                                >
                                  <div className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 flex items-center justify-center mb-2">
                                    <img
                                      src={getTeamLogo(predictedTeam)}
                                      alt={`${predictedTeam} logo`}
                                      className="max-h-full max-w-full object-contain drop-shadow"
                                    />
                                  </div>
                                  <span className="text-xs sm:text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100 text-center leading-snug">
                                    {predictedTeam} ({formatSpread(predictedSpread)})
                                  </span>
                                </BackgroundGradient>
                                {/* Right: Confidence % */}
                                {confidencePct > 70 ? (
                                  <ElectricBorder
                                    color="#10b981"
                                    speed={1.0}
                                    chaos={0.3}
                                    thickness={5}
                                    className="h-28 sm:h-32 md:h-36 rounded-3xl bg-white dark:bg-gray-900 flex flex-col items-center justify-center text-center"
                                    style={{ borderRadius: 24 }}
                                  >
                                    <div className={`text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight text-emerald-600`}>
                                      {confidencePct}%
                                    </div>
                                    <div className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 font-medium mt-1">Confidence</div>
                                  </ElectricBorder>
                                ) : (
                                  <BackgroundGradient 
                                    className="h-28 sm:h-32 md:h-36 rounded-3xl bg-white dark:bg-gray-900 flex flex-col items-center justify-center text-center"
                                    colors={
                                      confidencePct <= 58 ? ['#dc2626', '#ef4444'] : // Red for low confidence
                                      confidencePct <= 65 ? ['#ea580c', '#f97316'] : // Orange for medium confidence  
                                      ['#059669', '#10b981'] // Green for high confidence
                                    }
                                  >
                                    <div className={`text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight ${confidenceColorClass}`}>
                                      {confidencePct}%
                                    </div>
                                    <div className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 font-medium mt-1">Confidence</div>
                                  </BackgroundGradient>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Over/Under Analysis */}
                      {prediction.ou_result_prob !== null && (
                        <div className="space-y-3">
                          <h5 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Over / Under</h5>
                          {(() => {
                            const isOver = prediction.ou_result_prob! > 0.5;
                            const confidencePct = Math.round((isOver ? prediction.ou_result_prob! : 1 - prediction.ou_result_prob!) * 100);
                            const confidenceColorClass =
                              confidencePct <= 58 ? 'text-rose-600' :
                              confidencePct <= 65 ? 'text-orange-500' :
                              'text-emerald-600';
                            const arrow = isOver ? '▲' : '▼';
                            const arrowColor = isOver ? 'text-emerald-600' : 'text-rose-600';
                            const label = isOver ? 'Over' : 'Under';
                            return (
                              <div className="grid grid-cols-2 items-stretch gap-4 sm:gap-6">
                                {/* Left: Big arrow + OU line */}
                                <BackgroundGradient 
                                  className="h-28 sm:h-32 md:h-36 rounded-3xl bg-white dark:bg-gray-900 flex flex-col items-center justify-center"
                                  colors={
                                    isOver ? ['#059669', '#10b981'] : // Green for Over
                                    ['#dc2626', '#ef4444'] // Red for Under
                                  }
                                >
                                  <div className={`text-4xl sm:text-5xl md:text-6xl font-black ${arrowColor}`}>{arrow}</div>
                                  <div className="mt-2 text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 text-center">
                                    {label} {prediction.over_line || '-'}
                                  </div>
                                </BackgroundGradient>
                                {/* Right: Confidence % */}
                                {confidencePct > 70 ? (
                                  <ElectricBorder
                                    color="#10b981"
                                    speed={1.2}
                                    chaos={0.3}
                                    thickness={5}
                                    className="h-28 sm:h-32 md:h-36 rounded-3xl bg-white dark:bg-gray-900 flex flex-col items-center justify-center text-center"
                                    style={{ borderRadius: 24 }}
                                  >
                                    <div className={`text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight text-emerald-600`}>
                                      {confidencePct}%
                                    </div>
                                    <div className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 font-medium mt-1">Confidence</div>
                                  </ElectricBorder>
                                ) : (
                                  <BackgroundGradient 
                                    className="h-28 sm:h-32 md:h-36 rounded-3xl bg-white dark:bg-gray-900 flex flex-col items-center justify-center text-center"
                                    colors={
                                      confidencePct <= 58 ? ['#dc2626', '#ef4444'] : // Red for low confidence
                                      confidencePct <= 65 ? ['#ea580c', '#f97316'] : // Orange for medium confidence  
                                      ['#059669', '#10b981'] // Green for high confidence
                                    }
                                  >
                                    <div className={`text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight ${confidenceColorClass}`}>
                                      {confidencePct}%
                                    </div>
                                    <div className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 font-medium mt-1">Confidence</div>
                                  </BackgroundGradient>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Betting Split Labels Section */}
                  {(prediction.ml_splits_label || prediction.spread_splits_label || prediction.total_splits_label) && (
                    <div className="text-center pt-4 sm:pt-6 border-t-2 border-gray-200 dark:border-gray-700">
                      <div className="bg-gradient-to-br from-gray-50 to-slate-50/30 dark:from-gray-800/50 dark:to-slate-800/20 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                        {/* Header */}
                        <h4 className="text-lg sm:text-xl font-bold text-gray-400 dark:text-gray-500">Public Betting Facts</h4>
                        
                        {/* Badges */}
                        <div className="space-y-1.5 sm:space-y-2">
                          {prediction.ml_splits_label && (
                            <Badge 
                              variant="outline" 
                              className={`w-full justify-center text-xs font-medium ${
                                shouldHighlightLabel(prediction.ml_splits_label) 
                                  ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-900 dark:text-blue-200' 
                                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200'
                              }`}
                            >
                              ML: {prediction.ml_splits_label}
                            </Badge>
                          )}
                          {prediction.spread_splits_label && (
                            <Badge 
                              variant="outline" 
                              className={`w-full justify-center text-xs font-medium ${
                                shouldHighlightLabel(prediction.spread_splits_label) 
                                  ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-900 dark:text-blue-200' 
                                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200'
                              }`}
                            >
                              Spread: {prediction.spread_splits_label}
                            </Badge>
                          )}
                          {prediction.total_splits_label && (
                            <Badge 
                              variant="outline" 
                              className={`w-full justify-center text-xs font-medium ${
                                shouldHighlightLabel(prediction.total_splits_label) 
                                  ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-900 dark:text-blue-200' 
                                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200'
                              }`}
                            >
                              Total: {prediction.total_splits_label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Weather Section */}
                  <div className="text-center pt-4 sm:pt-6 border-t-2 border-gray-200 dark:border-gray-700">
                    <div className="bg-gradient-to-br from-gray-50 to-slate-50/30 dark:from-gray-800/50 dark:to-slate-800/20 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                      {/* Header */}
                      <h4 className="text-lg sm:text-xl font-bold text-gray-400 dark:text-gray-500">Weather</h4>
                      
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
                          <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-bold">Indoor Game</span>
                        </div>
                      )}
                    </div>
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
      <MiniWagerBotChat />
    </div>
  );
}
