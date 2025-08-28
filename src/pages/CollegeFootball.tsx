import { useState, useEffect } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Trophy, AlertCircle } from 'lucide-react';

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
  game_date: string;
  game_time: string;
  generated_at: string;
  training_key: string; // Add this to map to weather data
  temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  icon_code: string | null; // New weather icon code
  pred_ml_proba: number | null; // New probability fields
  pred_spread_proba: number | null;
  pred_total_proba: number | null;
  // Add score prediction columns
  pred_away_score: number | null;
  pred_home_score: number | null;
}

interface TeamMapping {
  vsin: string;
  logo_light: string;
}

export default function CollegeFootball() {
  const [predictions, setPredictions] = useState<CFBPrediction[]>([]);
  const [teamMappings, setTeamMappings] = useState<TeamMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(['All Games']);

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

  // Check if a game should be displayed based on active filters
  const shouldDisplayGame = (prediction: CFBPrediction): boolean => {
    if (activeFilters.includes('All Games')) return true;
    
    const allLabels = [
      prediction.ml_splits_label,
      prediction.spread_splits_label,
      prediction.total_splits_label
    ].filter(Boolean);
    
    return activeFilters.some(filter => {
      if (filter === 'All Games') return true;
      
      // Create flexible matching patterns for each filter type
      const patterns = {
        'Sharp Money': ['sharp'],
        'Public Bets': ['public'],
        'Consensus Bets': ['consensus']
      };
      
      const patternsToMatch = patterns[filter as keyof typeof patterns] || [];
      
      return allLabels.some(label => 
        patternsToMatch.some(pattern => 
          label?.toLowerCase().includes(pattern)
        )
      );
    });
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
        .select('vsin, logo_light');
      
      if (mappingsError) {
        console.error('Error fetching team mappings:', mappingsError);
        setError(`Team mappings error: ${mappingsError.message}`);
        return;
      }
      
      console.log('Team mappings fetched:', mappings?.length || 0);
      setTeamMappings(mappings || []);

      // Fetch predictions
      const { data: preds, error: predsError } = await collegeFootballSupabase
        .from('cfb_predictions')
        .select('*')
        .order('game_date', { ascending: true })
        .order('game_time', { ascending: true });

      if (predsError) {
        console.error('Error fetching predictions:', predsError);
        setError(`Predictions error: ${predsError.message}`);
        return;
      }

      console.log('Predictions fetched:', preds?.length || 0);

      // Fetch weather data from the view
      const { data: weatherData, error: weatherError } = await collegeFootballSupabase
        .from('v_cfb_input_values_v2')
        .select('unique_id, temperature, precipitation, wind_speed, icon_code');

      if (weatherError) {
        console.error('Error fetching weather data:', weatherError);
        // Don't fail completely, just log the error
        console.warn('Weather data unavailable, continuing without weather info');
      }

      // Map weather data to predictions using training_key
      const predictionsWithWeather = (preds || []).map(prediction => {
        const weather = weatherData?.find(w => w.unique_id === prediction.training_key);
        return {
          ...prediction,
          temperature: weather?.temperature || null,
          precipitation: weather?.precipitation || null,
          wind_speed: weather?.wind_speed || null,
          icon_code: weather?.icon_code || null
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
    const mapping = teamMappings.find(m => m.vsin === teamName);
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
      
      // Format as 12-hour time since database is already in EST
      const time = new Date();
      time.setHours(hours, minutes, 0, 0);
      
      return time.toLocaleTimeString('en-US', {
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

  const formatDate = (dateString: string): string => {
    try {
      // Parse the date string explicitly to avoid timezone issues
      const [year, month, day] = dateString.split('-').map(Number);
      // Month is 0-indexed in JavaScript Date constructor
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
      // Parse the date string explicitly to avoid timezone issues
      const [year, month, day] = dateString.split('-').map(Number);
      // Month is 0-indexed in JavaScript Date constructor
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

  const groupGamesByDate = (games: CFBPrediction[]): Record<string, CFBPrediction[]> => {
    const grouped: Record<string, CFBPrediction[]> = {};
    
    games.forEach(game => {
      const date = game.game_date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(game);
    });
    
    // Sort games within each date by time
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        const timeA = a.game_time;
        const timeB = b.game_time;
        return timeA.localeCompare(timeB);
      });
    });
    
    return grouped;
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-orange-500" />
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
          <Button onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-gray-50 rounded-lg border">
        <span className="text-sm font-medium text-gray-700 mr-2">Filter by:</span>
        {filterOptions.map(filter => (
          <Button
            key={filter}
            variant={activeFilters.includes(filter) ? 'default' : 'outline'}
            onClick={() => toggleFilter(filter)}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-all duration-200 ${
              activeFilters.includes(filter)
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg transform hover:scale-105'
                : 'bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300 hover:border-gray-400 shadow-md hover:shadow-lg'
            }`}
          >
            {filter}
            {activeFilters.includes(filter) && (
              <span className="text-xs font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">✓</span>
            )}
          </Button>
        ))}
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

      <div className="space-y-8">
        {/* Display all games in a single grid, ordered by date and time */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {predictions
            .filter(shouldDisplayGame)
            .sort((a, b) => {
              // Sort by date first, then by time
              const dateComparison = a.game_date.localeCompare(b.game_date);
              if (dateComparison !== 0) return dateComparison;
              return a.game_time.localeCompare(b.game_time);
            })
            .map((prediction) => (
              <Card key={prediction.id} className="relative overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-[1.02] bg-gradient-to-br from-white via-gray-50 to-white border-2 border-gray-200 hover:border-blue-300 shadow-lg">
                {/* Gradient accent line at top */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500"></div>
                <CardContent className="space-y-6 pt-6 pb-6">
                  {/* Game Date - Small font above the @ symbol */}
                  <div className="text-center">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      {formatCompactDate(prediction.game_date)}
                    </div>
                  </div>

                  {/* Team Logos and Betting Info - Horizontal Layout */}
                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-start">
                      {/* Away Team */}
                      <div className="text-center flex-1">
                        {getTeamLogo(prediction.away_team) && (
                          <img 
                            src={getTeamLogo(prediction.away_team)} 
                            alt={`${prediction.away_team} logo`}
                            className="h-16 w-16 mx-auto mb-3 drop-shadow-lg filter hover:scale-105 transition-transform duration-200"
                          />
                        )}
                        <div className="text-xl font-bold mb-2 h-8 flex items-center justify-center text-gray-800">
                          {prediction.away_team}
                        </div>
                        <div className="text-lg font-bold h-8 flex items-center justify-center text-blue-600">
                          {formatMoneyline(prediction.away_ml)}
                        </div>
                        <div className="text-sm text-muted-foreground h-6 flex items-center justify-center">
                          Spread: {formatSpread(prediction.away_spread)}
                        </div>
                      </div>

                      {/* @ Symbol, Game Time, and Total */}
                      <div className="text-center px-4 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-gray-400">@</span>
                        <div className="text-sm font-medium text-gray-600 mt-2 mb-4 bg-gray-100 px-3 py-1 rounded-full">
                          {convertTimeToEST(prediction.game_time)}
                        </div>
                        <div className="text-sm font-bold text-gray-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                          Total: {prediction.total_line || '-'}
                        </div>
                      </div>

                      {/* Home Team */}
                      <div className="text-center flex-1">
                        {getTeamLogo(prediction.home_team) && (
                          <img 
                            src={getTeamLogo(prediction.home_team)} 
                            alt={`${prediction.home_team} logo`}
                            className="h-16 w-16 mx-auto mb-3 drop-shadow-lg filter hover:scale-105 transition-transform duration-200"
                          />
                        )}
                        <div className="text-xl font-bold mb-2 h-8 flex items-center justify-center text-gray-800">
                          {prediction.home_team}
                        </div>
                        <div className="text-lg font-bold h-8 flex items-center justify-center text-green-600">
                          {formatMoneyline(prediction.home_ml)}
                        </div>
                        <div className="text-sm text-muted-foreground h-6 flex items-center justify-center">
                          Spread: {formatSpread(prediction.home_spread)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Betting Split Labels Section */}
                  {(prediction.ml_splits_label || prediction.spread_splits_label || prediction.total_splits_label) && (
                    <div className="space-y-3 pt-6 border-t-2 border-gray-200">
                      <div className="text-center">
                        <h4 className="text-sm font-bold text-gray-700 bg-gradient-to-r from-indigo-50 to-blue-50 px-3 py-1 rounded-full border border-gray-200">Public Betting Facts</h4>
                      </div>
                      <div className="space-y-2 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                        {prediction.ml_splits_label && (
                          <Badge 
                            variant="outline" 
                            className={`w-full justify-center ${
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
                            className={`w-full justify-center ${
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
                            className={`w-full justify-center ${
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

                  {/* Predictions Section */}
                  {(prediction.pred_ml_proba !== null || prediction.pred_spread_proba !== null || prediction.pred_total_proba !== null) && (
                    <div className="space-y-3 pt-6 border-t-2 border-gray-200">
                      <div className="text-center">
                        <h4 className="text-sm font-bold text-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 px-3 py-1 rounded-full border border-gray-200">Model Predictions</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        {/* Moneyline Prediction */}
                        {prediction.pred_ml_proba !== null && (
                          <div className="text-center">
                            <div className="text-xs font-medium text-gray-600 mb-1">Moneyline</div>
                            <div className="text-lg font-bold text-blue-600">
                              {Math.round((prediction.pred_ml_proba > 0.5 ? prediction.pred_ml_proba : 1 - prediction.pred_ml_proba) * 100)}%
                            </div>
                            <div className="flex items-center justify-center space-x-2 mb-1">
                              {getTeamLogo(prediction.pred_ml_proba > 0.5 ? prediction.home_team : prediction.away_team) && (
                                <img 
                                  src={getTeamLogo(prediction.pred_ml_proba > 0.5 ? prediction.home_team : prediction.away_team)} 
                                  alt="Team logo"
                                  className="h-6 w-6"
                                />
                              )}
                              <div className="text-xs text-gray-500">
                                {prediction.pred_ml_proba > 0.5 ? prediction.home_team : prediction.away_team}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">Probability to Win</div>
                          </div>
                        )}

                        {/* Spread Prediction */}
                        {prediction.pred_spread_proba !== null && (
                          <div className="text-center">
                            <div className="text-xs font-medium text-gray-600 mb-1">Spread</div>
                            <div className="text-lg font-bold text-green-600">
                              {Math.round((prediction.pred_spread_proba > 0.5 ? prediction.pred_spread_proba : 1 - prediction.pred_spread_proba) * 100)}%
                            </div>
                            <div className="flex items-center justify-center space-x-2 mb-1">
                              {getTeamLogo(prediction.pred_spread_proba > 0.5 ? prediction.home_team : prediction.away_team) && (
                                <img 
                                  src={getTeamLogo(prediction.pred_spread_proba > 0.5 ? prediction.home_team : prediction.away_team)} 
                                  alt="Team logo"
                                  className="h-6 w-6"
                                />
                              )}
                              <div className="text-xs text-gray-500">
                                {prediction.pred_spread_proba > 0.5 ? prediction.home_team : prediction.away_team}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">Probability to Cover</div>
                          </div>
                        )}

                        {/* Over/Under Prediction */}
                        {prediction.pred_total_proba !== null && (
                          <div className="text-center">
                            <div className="text-xs font-medium text-gray-600 mb-1">Over/Under</div>
                            <div className="text-lg font-bold text-purple-600">
                              {Math.round((prediction.pred_total_proba > 0.5 ? prediction.pred_total_proba : 1 - prediction.pred_total_proba) * 100)}%
                            </div>
                            <div className="text-xs text-gray-500">
                              Probability to Go {prediction.pred_total_proba > 0.5 ? 'Over' : 'Under'}
                            </div>
                            <div className="text-xs text-gray-500">
                              Total: {prediction.total_line || '-'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Score Prediction Section */}
                  {(prediction.pred_away_score !== null || prediction.pred_home_score !== null) && (
                    <div className="space-y-3 pt-6 border-t-2 border-gray-200">
                      <div className="text-center">
                        <h4 className="text-sm font-bold text-gray-700 bg-gradient-to-r from-orange-50 to-red-50 px-3 py-1 rounded-full border border-gray-200">Score Prediction</h4>
                      </div>
                      <div className="flex justify-between items-center bg-gradient-to-br from-orange-50 to-red-50 p-4 rounded-lg border border-gray-200">
                        {/* Away Team Score */}
                        <div className="text-center flex-1">
                          {getTeamLogo(prediction.away_team) && (
                            <img 
                              src={getTeamLogo(prediction.away_team)} 
                              alt={`${prediction.away_team} logo`}
                              className="h-12 w-12 mx-auto mb-2 drop-shadow-md"
                            />
                          )}
                          <div className="text-2xl font-bold text-gray-800">
                            {prediction.pred_away_score !== null ? prediction.pred_away_score.toFixed(1) : '-'}
                          </div>
                        </div>

                        {/* VS Separator */}
                        <div className="text-center px-4">
                          <div className="text-lg font-bold text-gray-500">VS</div>
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
                          <div className="text-2xl font-bold text-gray-800">
                            {prediction.pred_home_score !== null ? prediction.pred_home_score.toFixed(1) : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Weather Section */}
                  {prediction.icon_code && (
                    <div className="space-y-3 pt-6 border-t-2 border-gray-200">
                      <div className="text-center">
                        <h4 className="text-sm font-bold text-gray-700 bg-gradient-to-r from-blue-50 to-green-50 px-3 py-1 rounded-full border border-gray-200">Weather</h4>
                      </div>
                      <div className="flex justify-center bg-gradient-to-br from-blue-50 to-green-50 p-3 rounded-lg border border-gray-200">
                        <WeatherIcon 
                          iconCode={prediction.icon_code}
                          temperature={prediction.temperature}
                          windSpeed={prediction.wind_speed}
                        />
                      </div>
                    </div>
                  )}
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