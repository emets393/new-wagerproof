import { useState, useEffect, useRef } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Trophy, AlertCircle, ArrowUp, ArrowDown } from 'lucide-react';

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
  const [predictions, setPredictions] = useState<CFBPrediction[]>([]);
  const [teamMappings, setTeamMappings] = useState<TeamMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(['All Games']);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
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

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm">
          {iconPath && (
            <img src={`/weather-icons/${iconPath}`} alt={code || 'weather'} className="h-5 w-5 object-contain" />
          )}
          <div className="text-xs font-medium text-gray-700">
            {typeof tempF === 'number' ? `Temp: ${Math.round(tempF)}°F` : 'Temp: --'}
            <span className="mx-2 text-gray-300">•</span>
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

  const formatStartTime = (startTimeString: string | null | undefined): { date: string; time: string } => {
    console.log('formatStartTime called with:', startTimeString); // Debug logging
    if (!startTimeString) {
      return { date: 'TBD', time: 'TBD' };
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
      
      return { date: estDate, time: estTime };
    } catch (error) {
      console.error('Error formatting start time:', error);
      return { date: 'TBD', time: 'TBD' };
    }
  };

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-7 w-7 sm:h-8 sm:w-8 text-orange-500" />
            College Football Predictions
          </h1>
          <p className="text-muted-foreground mt-1">
            Live predictions, spreads, and money lines
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Betting Lines Current as of: {convertUTCToEST(lastUpdated.toISOString())}
            </span>
          )}
          <Button onClick={fetchData} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-700 shadow-md">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Game selection dropdown (multi) */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-gray-50 rounded-lg border relative">
        <span className="text-sm font-medium text-gray-700">Select games:</span>
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setGameDropdownOpen(o => !o)}
            className="inline-flex items-center gap-2 cursor-pointer select-none px-3 py-2 bg-white border rounded-md shadow-sm text-sm"
          >
            {selectedGameIds.length === 0 ? 'All Games' : `${selectedGameIds.length} selected`}
            <span className={`text-gray-400 transition-transform ${gameDropdownOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {gameDropdownOpen && (
          <div className="absolute z-10 mt-2 w-[320px] max-h-72 overflow-auto bg-white border rounded-md shadow-lg p-2">
            <div className="flex items-center justify-between mb-2">
              <Button variant="outline" className="text-xs" onClick={() => setSelectedGameIds(predictions.map(p => String(p.id)))}>Select All</Button>
              <Button variant="outline" className="text-xs" onClick={() => setSelectedGameIds([])}>Clear</Button>
            </div>
            <ul className="space-y-1">
              {predictions
                .slice()
                .sort((a, b) => String(a.away_team).localeCompare(String(b.away_team)))
                .map(p => {
                const id = String(p.id);
                const checked = selectedGameIds.includes(id);
                return (
                  <li key={id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50">
                    <input
                      id={`game-${id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGameSelection(id)}
                    />
                    <label htmlFor={`game-${id}`} className="text-sm cursor-pointer select-none">
                      {p.away_team} @ {p.home_team}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
          )}
        </div>

        {/* Sorting controls - wrap on mobile, align right on desktop */}
        <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Button
            variant={sortMode === 'spread' ? 'default' : 'outline'}
            className={`${sortMode === 'spread' ? 'bg-blue-600 text-white' : ''} text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto whitespace-nowrap`}
            onClick={() => setSortMode('spread')}
            title="Sort by highest Spread edge"
          >
            <span className="hidden sm:inline">Sort: Spread Edge</span>
            <span className="sm:hidden">Spread</span>
          </Button>
          <Button
            variant={sortMode === 'ou' ? 'default' : 'outline'}
            className={`${sortMode === 'ou' ? 'bg-blue-600 text-white' : ''} text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto whitespace-nowrap`}
            onClick={() => setSortMode('ou')}
            title="Sort by highest Over/Under edge"
          >
            <span className="hidden sm:inline">Sort: O/U Edge</span>
            <span className="sm:hidden">O/U</span>
          </Button>
          <Button
            variant={sortMode === 'time' ? 'default' : 'outline'}
            className={`${sortMode === 'time' ? 'bg-blue-600 text-white' : ''} text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto whitespace-nowrap`}
            onClick={() => setSortMode('time')}
            title="Sort by game time"
          >
            <span className="hidden sm:inline">Sort: Time</span>
            <span className="sm:hidden">Time</span>
          </Button>
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
            .map((prediction) => (
              <Card key={prediction.id} className="relative overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-[1.02] bg-gradient-to-br from-white via-gray-50 to-white border-2 border-gray-200 hover:border-blue-300 shadow-lg">
                {/* Gradient accent line at top */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500"></div>
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
                        <div className="text-sm sm:text-base font-bold mb-1 sm:mb-2 min-h-[3rem] sm:min-h-[3.5rem] flex items-start justify-center text-gray-800 leading-tight text-center break-words px-1 pt-2">
                          {prediction.away_team}
                        </div>
                      </div>

                      {/* @ Symbol */}
                      <div className="text-center">
                        <span className="text-xl sm:text-2xl font-bold text-gray-400">@</span>
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
                        <div className="text-sm sm:text-base font-bold mb-1 sm:mb-2 min-h-[3rem] sm:min-h-[3.5rem] flex items-start justify-center text-gray-800 leading-tight text-center break-words px-1 pt-2">
                          {prediction.home_team}
                        </div>
                      </div>
                    </div>

                    {/* Betting Lines Row */}
                    <div className="flex justify-between items-center">
                      {/* Away Team Betting */}
                      <div className="text-center flex-1">
                        <div className="text-base sm:text-lg font-bold h-6 sm:h-8 flex items-center justify-center text-blue-600">
                          {formatMoneyline(prediction.away_moneyline)}
                        </div>
                        <div className="text-sm sm:text-base font-bold h-5 sm:h-6 flex items-center justify-center text-gray-800">
                          {formatSpread(prediction.api_spread ? -prediction.api_spread : null)}
                        </div>
                        {typeof prediction.opening_spread === 'number' && (
                          <div className="mt-1 flex justify-center">
                            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full border bg-white text-gray-700 border-gray-200">
                              Open: {formatSpread(prediction.opening_spread ? -prediction.opening_spread : null)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Total */}
                      <div className="text-center px-2 sm:px-4">
                        <div className="text-xs sm:text-sm font-bold text-gray-700 bg-blue-50 px-2 sm:px-3 py-1 rounded-full border border-blue-200">
                          Total: {prediction.api_over_line || '-'}
                        </div>
                      </div>

                      {/* Home Team Betting */}
                      <div className="text-center flex-1">
                        <div className="text-base sm:text-lg font-bold h-6 sm:h-8 flex items-center justify-center text-green-600">
                          {formatMoneyline(prediction.home_moneyline)}
                        </div>
                        <div className="text-sm sm:text-base font-bold h-5 sm:h-6 flex items-center justify-center text-gray-800">
                          {formatSpread(prediction.api_spread)}
                        </div>
                        {typeof prediction.opening_spread === 'number' && (
                          <div className="mt-1 flex justify-center">
                            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full border bg-white text-gray-700 border-gray-200">
                              Open: {formatSpread(prediction.opening_spread)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Betting Split Labels Section */}
                  {(prediction.ml_splits_label || prediction.spread_splits_label || prediction.total_splits_label) && (
                    <div className="space-y-2 sm:space-y-3 pt-4 sm:pt-6 border-t-2 border-gray-200">
                      <div className="text-center">
                        <h4 className="text-xs sm:text-sm font-bold text-gray-700 bg-gradient-to-r from-indigo-50 to-blue-50 px-2 sm:px-3 py-1 rounded-full border border-gray-200">Public Betting Facts</h4>
                      </div>
                      <div className="space-y-1.5 sm:space-y-2 bg-gradient-to-br from-indigo-50 to-blue-50 p-3 sm:p-4 rounded-lg border border-gray-200 shadow-sm">
                        {prediction.ml_splits_label && (
                          <Badge 
                            variant="outline" 
                            className={`w-full justify-center text-xs ${
                              shouldHighlightLabel(prediction.ml_splits_label) 
                                ? 'bg-blue-100 border-blue-300 text-blue-800' 
                                : 'bg-white border-gray-300 text-gray-700'
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
                                ? 'bg-blue-100 border-blue-300 text-blue-800' 
                                : 'bg-white border-gray-300 text-gray-700'
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
                                ? 'bg-blue-100 border-blue-300 text-blue-800' 
                                : 'bg-white border-gray-300 text-gray-700'
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
                    <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 border-t-2 border-gray-200">
                      <div className="text-center">
                        <h4 className="text-sm sm:text-base font-bold text-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 sm:px-4 py-2 rounded-full border border-blue-200">Model Predictions</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {/* Spread Edge Display (left) */}
                        {(() => {
                          const edgeInfo = getEdgeInfo(prediction.home_spread_diff, prediction.away_team, prediction.home_team);

                          if (!edgeInfo) {
                            return (
                              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-4 sm:p-6">
                                <div className="text-center">
                                  <h5 className="text-sm sm:text-base font-bold text-gray-800 mb-3 pb-2 border-b border-gray-200">Spread</h5>
                                  <div className="text-sm text-gray-500">Edge calculation unavailable</div>
                                  <div className="mt-3">
                                    <div className="text-xs sm:text-sm font-semibold text-gray-600 mb-1">Model Spread</div>
                                    <div className="text-2xl sm:text-3xl font-bold text-gray-700">
                                      {formatSignedHalf(prediction.pred_spread)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 h-full flex flex-col">
                              <div className="text-center">
                                <h5 className="text-base sm:text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">Spread</h5>

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
                                    <div className="text-3xl sm:text-4xl font-bold text-gray-800 mb-1">
                                      {edgeInfo.displayEdge}
                                    </div>
                                    <div className="text-sm sm:text-base font-medium text-gray-600">Edge</div>
                                  </div>
                                </div>

                                {/* Model Spread Only */}
                                <div className="mt-4">
                                  <div className="text-sm sm:text-base font-semibold text-gray-700 mb-1">Model Spread</div>
                                  {(() => {
                                    let modelSpreadDisplay = prediction.pred_spread;
                                    if (!edgeInfo.isHomeEdge) {
                                      if (modelSpreadDisplay !== null) modelSpreadDisplay = -modelSpreadDisplay;
                                    }
                                    return (
                                      <div className="text-3xl sm:text-4xl font-bold text-gray-800">
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
                              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-4 sm:p-6">
                                <div className="text-center">
                                  <div className="text-xs sm:text-sm font-semibold text-gray-600 mb-3">Over/Under Edge</div>
                                  <div className="text-sm text-gray-500">No O/U data available</div>
                                </div>
                              </div>
                            );
                          }

                          const isOver = (ouDiff ?? 0) > 0;
                          const magnitude = Math.abs(ouDiff ?? 0);
                          const displayMagnitude = roundToHalf(magnitude).toString();
                          const modelValue = prediction.pred_over_line;

                          return (
                            <div className={`rounded-xl border p-4 sm:p-6 h-full flex flex-col bg-white border-gray-200`}>
                              <div className="text-center">
                                <h5 className={`text-base sm:text-lg font-bold mb-3 pb-2 border-b ${isOver ? 'text-emerald-800' : 'text-rose-800'} border-gray-200`}>Over/Under</h5>

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
                                    <div className={`text-sm sm:text-base font-medium ${isOver ? 'text-emerald-700' : 'text-rose-700'}`}>Edge</div>
                                  </div>
                                </div>

                                {/* Model O/U Only */}
                                <div className="mt-4">
                                  <div className={`text-sm sm:text-base font-semibold mb-1 ${isOver ? 'text-emerald-700' : 'text-rose-700'}`}>Model O/U</div>
                                  <div className={`text-3xl sm:text-4xl font-bold ${isOver ? 'text-emerald-700' : 'text-rose-700'}`}>{formatHalfNoSign(modelValue)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Match Simulator Section */}
                  <div className="space-y-2 sm:space-y-3 pt-4 sm:pt-6 border-t-2 border-gray-200">
                    <div className="text-center">
                      <h4 className="text-xs sm:text-sm font-bold text-gray-700 bg-gradient-to-r from-orange-50 to-red-50 px-2 sm:px-3 py-1 rounded-full border border-gray-200">Match Simulator</h4>
                    </div>

                    {/* Simulate Button or Loading */}
                    {!simRevealedById[prediction.id] && (
                      <div className="flex justify-center">
                        <Button
                          disabled={!!simLoadingById[prediction.id]}
                          onClick={() => {
                            setSimLoadingById(prev => ({ ...prev, [prediction.id]: true }));
                            setTimeout(() => {
                              setSimLoadingById(prev => ({ ...prev, [prediction.id]: false }));
                              setSimRevealedById(prev => ({ ...prev, [prediction.id]: true }));
                            }, 2500);
                          }}
                          className="px-6 py-6 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-700 shadow-md"
                        >
                          {simLoadingById[prediction.id] ? (
                            <span className="flex items-center">
                              <FootballLoader /> Simulating…
                            </span>
                          ) : (
                            'Simulate Match'
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Revealed Score Layout */}
                    {simRevealedById[prediction.id] && (
                      <div className="flex justify-between items-center bg-gradient-to-br from-orange-50 to-red-50 p-3 sm:p-4 rounded-lg border border-gray-200">
                        {/* Away Team Score */}
                        <div className="text-center flex-1">
                          {getTeamLogo(prediction.away_team) && (
                            <img 
                              src={getTeamLogo(prediction.away_team)} 
                              alt={`${prediction.away_team} logo`}
                              className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-1 sm:mb-2 drop-shadow-md"
                            />
                          )}
                          <div className="text-xl sm:text-2xl font-bold text-gray-800">
                            {(() => {
                              const val = prediction.pred_away_points ?? prediction.pred_away_score;
                              return val !== null && val !== undefined ? Math.round(Number(val)).toString() : '-';
                            })()}
                          </div>
                        </div>

                        {/* VS Separator */}
                        <div className="text-center px-3 sm:px-4">
                          <div className="text-base sm:text-lg font-bold text-gray-500">VS</div>
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
                          <div className="text-xl sm:text-2xl font-bold text-gray-800">
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
              </Card>
            ))}
        </div>
      </div>

      {predictions.length > 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Showing {predictions.length} predictions
          </p>
        </div>
      )}
    </div>
  );
} 