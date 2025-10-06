import { useState, useEffect } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Trophy, AlertCircle, History, TrendingUp } from 'lucide-react';
import H2HModal from '@/components/H2HModal';
import LineMovementModal from '@/components/LineMovementModal';

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
            <div className="text-lg font-bold text-gray-700 min-w-[60px] text-center">
              {Math.round(temperature)}°F
            </div>
          )}

          {windSpeed !== null && windSpeed > 0 && (
            <div className="flex items-center space-x-2 min-w-[70px]">
              <div className="text-2xl text-blue-500">💨</div>
              <span className="text-sm font-medium text-gray-600">
                {Math.round(windSpeed)} mph
              </span>
            </div>
          )}
        </div>
        
        <div className="text-xs font-medium text-gray-600 capitalize">
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-orange-500" />
            NFL Predictions
          </h1>
          <p className="text-muted-foreground mt-1">
            Live predictions, spreads, and money lines
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchData} disabled={loading} className="text-white">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg border">
        <span className="text-sm font-medium text-gray-700 mr-2">Sort by:</span>
        <Button
          variant={sortKey === 'none' ? 'default' : 'outline'}
          onClick={() => setSortKey('none')}
          className={`${sortKey === 'none' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'} text-xs sm:text-sm px-2.5 py-1`}
        >
          Default (Date/Time)
        </Button>
        <Button
          variant={sortKey === 'ml' ? 'default' : 'outline'}
          onClick={() => setSortKey('ml')}
          className={`${sortKey === 'ml' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'} text-xs sm:text-sm px-2.5 py-1`}
        >
          Moneyline Prob
        </Button>
        <Button
          variant={sortKey === 'spread' ? 'default' : 'outline'}
          onClick={() => setSortKey('spread')}
          className={`${sortKey === 'spread' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'} text-xs sm:text-sm px-2.5 py-1`}
        >
          Spread Prob
        </Button>
        <Button
          variant={sortKey === 'ou' ? 'default' : 'outline'}
          onClick={() => setSortKey('ou')}
          className={`${sortKey === 'ou' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'} text-xs sm:text-sm px-2.5 py-1`}
        >
          O/U Prob
        </Button>
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
            .map((prediction, index) => (
              <Card key={prediction.id} className="relative overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-[1.02] bg-gradient-to-br from-white via-gray-50 to-white border-2 border-gray-200 hover:border-blue-300 shadow-lg">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500"></div>
                <CardContent className="space-y-4 sm:space-y-6 pt-4 pb-4 sm:pt-6 sm:pb-6">
                  {/* Game Date and Action Buttons */}
                  <div className="text-center">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      {formatCompactDate(prediction.game_date)}
                    </div>
                    <div className="flex gap-1.5 sm:gap-2 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openH2HModal(prediction.home_team, prediction.away_team)}
                        className="text-xs bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 border-blue-200 text-blue-700 hover:text-blue-800 transition-all duration-200 px-2 py-1"
                      >
                        <History className="h-3 w-3 mr-1" />
                        H2H
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openLineMovementModal(prediction.training_key, prediction.home_team, prediction.away_team)}
                        className="text-xs bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border-green-200 text-green-700 hover:text-green-800 transition-all duration-200 px-2 py-1"
                      >
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Lines
                      </Button>
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
                        <div className="hidden sm:flex text-lg sm:text-xl font-bold mb-1 sm:mb-2 h-6 sm:h-8 items-center justify-center text-gray-800">
                          {prediction.away_team}
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground h-5 sm:h-6 flex items-center justify-center">
                          Spread: {formatSpread(prediction.away_spread)}
                        </div>
                        <div className="text-base sm:text-lg font-bold h-6 sm:h-8 flex items-center justify-center text-blue-600">
                          {formatMoneyline(prediction.away_ml)}
                        </div>
                      </div>

                      {/* @ Symbol, Game Time, and Total */}
                      <div className="text-center px-2 sm:px-4 flex flex-col items-center justify-center">
                        <span className="text-xl sm:text-2xl font-bold text-gray-400">@</span>
                        <div className="text-xs sm:text-sm font-medium text-gray-600 mt-1 sm:mt-2 mb-2 sm:mb-4 bg-gray-100 px-2 sm:px-3 py-1 rounded-full">
                          {convertTimeToEST(prediction.game_time)}
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-gray-700 bg-blue-50 px-2 sm:px-3 py-1 rounded-full border border-blue-200">
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
                        <div className="hidden sm:flex text-lg sm:text-xl font-bold mb-1 sm:mb-2 h-6 sm:h-8 items-center justify-center text-gray-800">
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

                  {/* Model Predictions Section */}
                  <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 border-t-2 border-gray-200">
                    <div className="text-center">
                      <h4 className="text-xs sm:text-sm font-bold text-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 px-2 sm:px-3 py-1 rounded-full border border-gray-200">Model Predictions</h4>
                    </div>
                    
                    {/* Spread Predictions Card */}
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
                      <div className="text-center mb-3">
                        <h5 className="text-xs sm:text-sm font-semibold text-gray-700">Spread</h5>
                      </div>
                      {/* Spread Prediction */}
                      {prediction.home_away_spread_cover_prob !== null && (
                        (() => {
                          const isHome = prediction.home_away_spread_cover_prob > 0.5;
                          const predictedTeam = isHome ? prediction.home_team : prediction.away_team;
                          const predictedSpread = isHome ? prediction.home_spread : prediction.away_spread;
                          const confidencePct = Math.round((isHome ? prediction.home_away_spread_cover_prob : 1 - prediction.home_away_spread_cover_prob) * 100);
                          const confidenceColorClass =
                            confidencePct <= 58 ? 'text-rose-600' :
                            confidencePct <= 65 ? 'text-orange-500' :
                            'text-emerald-600';
                          return (
                            <div className="grid grid-cols-2 items-stretch gap-4 sm:gap-6">
                              {/* Left: Logo + Team (spread) */}
                              <div className="h-28 sm:h-32 md:h-36 rounded-2xl p-[1px] bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                                <div className="h-full w-full px-3 sm:px-4 pt-3 sm:pt-4 pb-6 sm:pb-7 rounded-xl bg-white flex flex-col items-center justify-center">
                                  <div className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 flex items-center justify-center mb-2">
                                    <img
                                      src={getTeamLogo(predictedTeam)}
                                      alt={`${predictedTeam} logo`}
                                      className="max-h-full max-w-full object-contain drop-shadow"
                                    />
                                  </div>
                                  <span className="text-xs sm:text-sm md:text-base font-semibold text-gray-800 text-center leading-snug">
                                    {predictedTeam} ({formatSpread(predictedSpread)})
                                  </span>
                                </div>
                              </div>
                              {/* Right: Confidence % */}
                              <div className="h-28 sm:h-32 md:h-36 rounded-2xl p-[1px] bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                                <div className="h-full w-full px-3 sm:px-4 pt-3 sm:pt-4 pb-4 sm:pb-5 rounded-xl bg-white flex flex-col items-center justify-center text-center">
                                  <div className={`text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight ${confidenceColorClass}`}>
                                    {confidencePct}%
                                  </div>
                                  <div className="text-[11px] sm:text-xs text-gray-600 font-medium mt-1">Confidence</div>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>

                    {/* Over/Under Analysis Card */}
                    {prediction.ou_result_prob !== null && (
                      <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
                        <div className="text-center mb-3">
                          <h5 className="text-xs sm:text-sm font-semibold text-gray-700">Over / Under</h5>
                        </div>
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
                              <div className="h-28 sm:h-32 md:h-36 rounded-2xl p-[1px] bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                                <div className="h-full w-full p-3 sm:p-4 rounded-xl bg-white flex flex-col items-center justify-center">
                                  <div className={`text-4xl sm:text-5xl md:text-6xl font-black ${arrowColor}`}>{arrow}</div>
                                  <div className="mt-2 text-sm sm:text-base md:text-lg font-semibold text-gray-800 text-center">
                                    {label} {prediction.over_line || '-'}
                                  </div>
                                </div>
                              </div>
                              {/* Right: Confidence % */}
                              <div className="h-28 sm:h-32 md:h-36 rounded-2xl p-[1px] bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                                <div className="h-full w-full p-3 sm:p-4 rounded-xl bg-white flex flex-col items-center justify-center text-center">
                                  <div className={`text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight ${confidenceColorClass}`}>
                                    {confidencePct}%
                                  </div>
                                  <div className="text-[11px] sm:text-xs text-gray-600 font-medium mt-1">Confidence</div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
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

                  {/* Weather Section */}
                  <div className="space-y-2 sm:space-y-3 pt-4 sm:pt-6 border-t-2 border-gray-200">
                    <div className="text-center">
                      <h4 className="text-xs sm:text-sm font-bold text-gray-700 bg-gradient-to-r from-blue-50 to-green-50 px-2 sm:px-3 py-1 rounded-full border border-gray-200">Weather</h4>
                    </div>
                    {prediction.icon ? (
                      <div className="flex justify-center bg-gradient-to-br from-blue-50 to-green-50 p-2 sm:p-3 rounded-lg border border-gray-200">
                        <WeatherIcon 
                          iconCode={prediction.icon}
                          temperature={prediction.temperature}
                          windSpeed={prediction.wind_speed}
                        />
                      </div>
                    ) : (
                      <div className="flex justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-2 sm:p-3 rounded-lg border border-gray-200">
                        <span className="text-xs sm:text-sm text-gray-600 font-bold">Indoor Game</span>
                      </div>
                    )}
                  </div>
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
    </div>
  );
}
