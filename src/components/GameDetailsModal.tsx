import { Dispatch, SetStateAction, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Button as MovingBorderButton } from '@/components/ui/moving-border';
import { Brain, Target, BarChart, Info, Sparkles, ChevronUp, ChevronDown, TrendingUp, Users, CloudRain, History, Trophy, Calendar, ArrowUp, ArrowDown } from 'lucide-react';
import { getCFBTeamColors, getNFLTeamColors, getNCAABTeamColors, getNBATeamColors } from '@/utils/teamColors';
import { WeatherIcon as WeatherIconComponent, IconWind } from '@/utils/weatherIcons';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle } from 'lucide-react';
import debug from '@/utils/debug';
import PolymarketWidget from './PolymarketWidget';
import { renderTextWithLinks } from '@/utils/markdownLinks';

interface GameDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: any;
  league: 'cfb' | 'nfl' | 'ncaab' | 'nba';
  aiCompletions: Record<string, Record<string, string>>;
  simLoadingById: Record<string, boolean>;
  simRevealedById: Record<string, boolean>;
  setSimLoadingById: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSimRevealedById: Dispatch<SetStateAction<Record<string, boolean>>>;
  focusedCardId: string | null;
  getTeamInitials: (teamName: string) => string;
  getContrastingTextColor: (bgColor1: string, bgColor2: string) => string;
  // NFL/NBA-specific props
  getFullTeamName?: (teamCity: string) => { city: string; name: string };
  formatSpread?: (spread: number | null) => string;
  parseBettingSplit?: (label: string | null) => {
    team: string;
    percentage: number;
    isSharp: boolean;
    isPublic: boolean;
    direction?: string;
  } | null;
  expandedBettingFacts?: Record<string, boolean>;
  setExpandedBettingFacts?: Dispatch<SetStateAction<Record<string, boolean>>>;
  // NFL/NBA-specific prop for team mappings (needed for line movement logos)
  teamMappings?: Array<{ city_and_name: string; team_name: string; logo_url: string }>;
}

export function GameDetailsModal({
  isOpen,
  onClose,
  prediction,
  league,
  aiCompletions,
  simLoadingById,
  simRevealedById,
  setSimLoadingById,
  setSimRevealedById,
  focusedCardId,
  getTeamInitials,
  getContrastingTextColor,
  getFullTeamName,
  formatSpread,
  parseBettingSplit,
  expandedBettingFacts,
  setExpandedBettingFacts,
  teamMappings,
}: GameDetailsModalProps) {
  if (!prediction) return null;

  // NFL H2H and Line Movement state
  const [h2hGames, setH2hGames] = useState<any[]>([]);
  const [h2hLoading, setH2hLoading] = useState(false);
  const [h2hError, setH2hError] = useState<string | null>(null);
  const [lineData, setLineData] = useState<any[]>([]);
  const [lineLoading, setLineLoading] = useState(false);
  const [lineError, setLineError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('away');

  // Helper functions for CFB
  const roundToHalf = (value: number): number => {
    return Math.round(value * 2) / 2;
  };

  const formatSignedHalf = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
    const rounded = roundToHalf(Number(value));
    if (rounded > 0) return `+${rounded}`;
    return rounded.toString();
  };

  const formatHalfNoSign = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
    const rounded = roundToHalf(Number(value));
    return rounded.toString();
  };

  const formatEdge = (edge: number): string => {
    const roundedEdge = roundToHalf(Math.abs(edge));
    return roundedEdge.toString();
  };

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

  const getEdgeExplanation = (edge: number, team: string, type: 'spread' | 'ou', direction?: 'over' | 'under'): string => {
    const absEdge = Math.abs(edge);
    
    if (type === 'spread') {
      if (absEdge >= 7) {
        return `Our model spread differs from the Vegas line by ${absEdge.toFixed(1)} points, favoring ${team}. This large discrepancy suggests Vegas may have significantly mispriced this matchup.`;
      } else if (absEdge >= 3) {
        return `Our model's ${absEdge.toFixed(1)}-point difference from the Vegas spread favors ${team}. This moderate edge shows our analytics see the game differently than the market.`;
      } else {
        return `Our model differs from Vegas by ${absEdge.toFixed(1)} points on ${team}. This small edge indicates our projection is fairly close to the market's assessment.`;
      }
    } else {
      const dir = direction || 'over';
      if (absEdge >= 7) {
        return `Our model's projected total differs from the Vegas line by ${absEdge.toFixed(1)} points, leaning ${dir}. This significant gap suggests Vegas has mispriced this game's scoring potential.`;
      } else if (absEdge >= 3) {
        return `Our model projects a total that's ${absEdge.toFixed(1)} points different from Vegas, favoring the ${dir}. This moderate discrepancy shows our scoring projection doesn't align with the market.`;
      } else {
        return `Our model's total is ${absEdge.toFixed(1)} points from the Vegas line, slightly favoring the ${dir}. This minimal difference means our projection closely matches the market's assessment.`;
      }
    }
  };

  // Map CFB weather icon text to icon code
  const mapCFBWeatherIconToCode = (iconText: string | null | undefined, fallbackIcon: string | null | undefined): string | null => {
    // If we have a direct icon_code, use it
    if (fallbackIcon) return fallbackIcon;
    
    // If we have weather_icon_text, map it
    if (!iconText) return null;
    
    const t = iconText.toLowerCase().trim();
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

  // Spinning football loader for simulator
  const FootballLoader = () => (
    <svg
      className="h-8 w-8 animate-spin mr-2"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="32" cy="32" rx="28" ry="18" fill="currentColor" className="text-orange-600" />
      <path d="M32 14 L32 50 M16 32 L48 32 M20 20 L44 44 M20 44 L44 20" stroke="white" strokeWidth="2" />
    </svg>
  );

  const getTeamColors = 
    league === 'cfb' ? getCFBTeamColors :
    league === 'ncaab' ? getNCAABTeamColors :
    league === 'nba' ? getNBATeamColors :
    getNFLTeamColors;
  const awayTeamColors = getTeamColors(prediction.away_team);
  const homeTeamColors = getTeamColors(prediction.home_team);
  const gameId = prediction.training_key || prediction.unique_id || prediction.id || `${prediction.away_team}_${prediction.home_team}`;

  // Fetch H2H data for NFL
  useEffect(() => {
    if (!isOpen || league !== 'nfl' || !prediction?.home_team || !prediction?.away_team) return;
    
    const fetchH2HData = async () => {
      setH2hLoading(true);
      setH2hError(null);
      
      try {
        debug.log('Fetching H2H data for:', prediction.home_team, 'vs', prediction.away_team);
        
        const { data, error } = await collegeFootballSupabase
          .from('nfl_training_data')
          .select('*')
          .or(`and(home_team.eq."${prediction.home_team}",away_team.eq."${prediction.away_team}"),and(home_team.eq."${prediction.away_team}",away_team.eq."${prediction.home_team}")`)
          .order('game_date', { ascending: false })
          .limit(5);

        if (error) {
          debug.error('Supabase error:', error);
          throw error;
        }
        
        setH2hGames(data || []);
      } catch (err) {
        debug.error('Error fetching H2H data:', err);
        setH2hError('Failed to load historical data');
      } finally {
        setH2hLoading(false);
      }
    };

    fetchH2HData();
  }, [isOpen, league, prediction?.home_team, prediction?.away_team]);

  // Fetch Line Movement data for NFL
  useEffect(() => {
    if (!isOpen || league !== 'nfl' || !prediction?.training_key) return;
    
    const fetchLineData = async () => {
      setLineLoading(true);
      setLineError(null);

      try {
        const { data, error } = await collegeFootballSupabase
          .from('nfl_betting_lines')
          .select('as_of_ts, home_spread, away_spread, over_line, home_team, away_team')
          .eq('training_key', prediction.training_key)
          .order('as_of_ts', { ascending: true });

        if (error) {
          debug.error('Error fetching line movement data:', error);
          setLineError('Failed to fetch line movement data');
          return;
        }

        if (!data || data.length === 0) {
          setLineError('No line movement data available');
          return;
        }

        setLineData(data);
      } catch (err) {
        debug.error('Error fetching line data:', err);
        setLineError('An unexpected error occurred');
      } finally {
        setLineLoading(false);
      }
    };

    fetchLineData();
  }, [isOpen, league, prediction?.training_key]);

  // Helper functions for NFL H2H and Line Movement
  const getTeamLogo = (teamName: string): string => {
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
    
    if (logoMap[teamName]) return logoMap[teamName];
    
    const lowerTeamName = teamName.toLowerCase();
    for (const [key, value] of Object.entries(logoMap)) {
      if (key.toLowerCase() === lowerTeamName) {
        return value;
      }
    }
    
    return 'https://a.espncdn.com/i/teamlogos/nfl/500/default.png';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, '0');
      
      return `${month}/${day} (${displayHours}:${displayMinutes}${ampm})`;
    } catch (error) {
      debug.error('Error formatting timestamp:', error);
      return timestamp;
    }
  };

  // Calculate H2H summary statistics
  const calculateH2HSummary = () => {
    if (!h2hGames || h2hGames.length === 0) {
      return {
        homeTeamWins: 0,
        awayTeamWins: 0,
        homeTeamCovers: 0,
        awayTeamCovers: 0,
        overs: 0,
        unders: 0
      };
    }

    let homeTeamWins = 0;
    let awayTeamWins = 0;
    let homeTeamCovers = 0;
    let awayTeamCovers = 0;
    let overs = 0;
    let unders = 0;

    h2hGames.forEach(game => {
      // Count wins
      if (game.home_score > game.away_score) {
        if (game.home_team === prediction.home_team) {
          homeTeamWins++;
        } else {
          awayTeamWins++;
        }
      } else if (game.away_score > game.home_score) {
        if (game.away_team === prediction.home_team) {
          homeTeamWins++;
        } else {
          awayTeamWins++;
        }
      }

      // Count covers
      if (game.home_away_spread_cover === 1) {
        if (game.home_team === prediction.home_team) {
          homeTeamCovers++;
        } else {
          awayTeamCovers++;
        }
      } else if (game.home_away_spread_cover === 0) {
        if (game.away_team === prediction.home_team) {
          homeTeamCovers++;
        } else {
          awayTeamCovers++;
        }
      }

      // Count over/under
      if (game.ou_result === 1) {
        overs++;
      } else if (game.ou_result === 0) {
        unders++;
      }
    });

    return {
      homeTeamWins,
      awayTeamWins,
      homeTeamCovers,
      awayTeamCovers,
      overs,
      unders
    };
  };

  // Transform line data for charts
  const chartData = lineData.map(item => ({
    timestamp: item.as_of_ts,
    displayTime: formatTimestamp(item.as_of_ts),
    homeSpread: item.home_spread,
    awaySpread: item.away_spread,
    overLine: item.over_line
  }));

  // Custom tooltip for line charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
          <p className="font-semibold text-card-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'homeSpread' ? `${prediction.home_team} Spread: ` :
               entry.dataKey === 'awaySpread' ? `${prediction.away_team} Spread: ` :
               entry.dataKey === 'overLine' ? 'Over/Under: ' : ''}
              {entry.value !== null ? entry.value.toFixed(1) : 'N/A'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const h2hStats = calculateH2HSummary();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-opacity-50 hover:[&::-webkit-scrollbar-thumb]:bg-opacity-80">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {prediction.away_team} @ {prediction.home_team}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* CFB/NCAAB Content */}
          {(league === 'cfb' || league === 'ncaab') && (
            <>
              {/* Model Predictions Section */}
              {(prediction.pred_spread !== null || prediction.home_spread_diff !== null || prediction.pred_over_line !== null || prediction.over_line_diff !== null) && (
                <div className="text-center">
                  <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/20 space-y-4">
                    <div className="flex items-center justify-center gap-2">
                      <Brain className="h-5 w-5 text-purple-400" />
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white">Model Predictions</h4>
                    </div>

                    <div className="space-y-3">
                      {/* Spread Edge Display */}
                      {(() => {
                        const edgeInfo = getEdgeInfo(prediction.home_spread_diff, prediction.away_team, prediction.home_team);

                        if (!edgeInfo) {
                          return (
                            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/20 p-3 sm:p-4">
                              <div className="text-center">
                                <div className="flex items-center justify-center gap-2 mb-2 pb-1.5 border-b border-white/10">
                                  <Target className="h-4 w-4 text-green-400" />
                                  <h5 className="text-sm font-semibold text-white/90">Spread</h5>
                                </div>
                                <div className="text-xs text-white/60">Edge calculation unavailable</div>
                                <div className="mt-2">
                                  <div className="text-xs font-semibold text-white/80 mb-1">Model Spread</div>
                                  <div className="text-xl sm:text-2xl font-bold text-white">
                                    {formatSignedHalf(prediction.pred_spread)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="bg-green-500/10 backdrop-blur-sm rounded-xl border border-green-500/20 shadow-sm p-3 sm:p-4">
                            <div className="flex items-center justify-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-white/10">
                              <Target className="h-4 w-4 text-green-400" />
                              <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Spread</h5>
                            </div>
                            
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-shrink-0">
                                {(() => {
                                  const teamColors = getTeamColors(edgeInfo.teamName);
                                  return (
                                    <div 
                                      className="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center border-2 transition-transform duration-200 hover:scale-105 shadow-lg"
                                      style={{
                                        background: `linear-gradient(135deg, ${teamColors.primary}, ${teamColors.secondary})`,
                                        borderColor: `${teamColors.primary}`
                                      }}
                                    >
                                      <span 
                                        className="text-xs sm:text-sm font-bold drop-shadow-md"
                                        style={{ color: getContrastingTextColor(teamColors.primary, teamColors.secondary) }}
                                      >
                                        {getTeamInitials(edgeInfo.teamName)}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>

                              <div className="text-center flex-1">
                                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">Edge to {getTeamInitials(edgeInfo.teamName)}</div>
                                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                                  {edgeInfo.displayEdge}
                                </div>
                              </div>

                              <div className="text-center flex-1">
                                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">Model Spread</div>
                                {(() => {
                                  let modelSpreadDisplay = prediction.pred_spread;
                                  if (!edgeInfo.isHomeEdge) {
                                    if (modelSpreadDisplay !== null) modelSpreadDisplay = -modelSpreadDisplay;
                                  }
                                  return (
                                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                                      {formatSignedHalf(modelSpreadDisplay)}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Spread Explanation */}
                      {(() => {
                        const edgeInfo = getEdgeInfo(prediction.home_spread_diff, prediction.away_team, prediction.home_team);
                        if (!edgeInfo) return null;
                        
                        const aiExplanation = aiCompletions[gameId]?.['spread_prediction'];
                        const staticExplanation = getEdgeExplanation(edgeInfo.edgeValue, edgeInfo.teamName, 'spread');
                        
                        return (
                          <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Info className="h-3 w-3 text-blue-400 flex-shrink-0" />
                              <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                              {aiExplanation && (
                                <Sparkles className="h-3 w-3 text-purple-400 ml-auto" title="AI-powered analysis" />
                              )}
                            </div>
                            <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                              {renderTextWithLinks(aiExplanation || staticExplanation)}
                            </p>
                          </div>
                        );
                      })()}

                      {/* Over/Under Edge Display */}
                      {(() => {
                        const ouDiff = prediction.over_line_diff;
                        const hasOuData = ouDiff !== null || prediction.pred_over_line !== null || prediction.api_over_line !== null;

                        if (!hasOuData) {
                          return (
                            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/20 p-3 sm:p-4">
                              <div className="text-center">
                                <div className="flex items-center justify-center gap-2 mb-2 pb-1.5 border-b border-white/10">
                                  <BarChart className="h-4 w-4 text-orange-400" />
                                  <h5 className="text-sm font-semibold text-white/90">Over/Under</h5>
                                </div>
                                <div className="text-xs text-white/60">No O/U data available</div>
                              </div>
                            </div>
                          );
                        }

                        const isOver = (ouDiff ?? 0) > 0;
                        const magnitude = Math.abs(ouDiff ?? 0);
                        const displayMagnitude = roundToHalf(magnitude).toString();
                        const modelValue = prediction.pred_over_line;

                        return (
                          <div className={`rounded-xl border p-3 sm:p-4 backdrop-blur-sm shadow-sm ${
                            isOver 
                              ? 'bg-green-500/10 border-green-500/20' 
                              : 'bg-red-500/10 border-red-500/20'
                          }`}>
                            <div className="flex items-center justify-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-white/10">
                              <BarChart className={`h-4 w-4 ${isOver ? 'text-green-400' : 'text-red-400'}`} />
                              <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Over/Under</h5>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-shrink-0">
                                {isOver ? (
                                  <div className="flex flex-col items-center">
                                    <ChevronUp className="h-12 w-12 sm:h-16 sm:w-16 text-green-400" />
                                    <div className="text-xs font-bold text-green-400 -mt-1">Over</div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center">
                                    <ChevronDown className="h-12 w-12 sm:h-16 sm:w-16 text-red-400" />
                                    <div className="text-xs font-bold text-red-400 -mt-1">Under</div>
                                  </div>
                                )}
                              </div>

                              <div className="text-center flex-1">
                                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">Edge to {isOver ? 'Over' : 'Under'}</div>
                                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{displayMagnitude}</div>
                              </div>

                              <div className="text-center flex-1">
                                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">Model O/U</div>
                                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{formatHalfNoSign(modelValue)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* O/U Explanation */}
                      {(() => {
                        const ouDiff = prediction.over_line_diff;
                        const hasOuData = ouDiff !== null || prediction.pred_over_line !== null || prediction.api_over_line !== null;
                        if (!hasOuData) return null;
                        
                        const isOver = (ouDiff ?? 0) > 0;
                        const magnitude = Math.abs(ouDiff ?? 0);
                        const aiExplanation = aiCompletions[gameId]?.['ou_prediction'];
                        const staticExplanation = getEdgeExplanation(magnitude, '', 'ou', isOver ? 'over' : 'under');
                        
                        return (
                          <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Info className="h-3 w-3 text-blue-400 flex-shrink-0" />
                              <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                              {aiExplanation && (
                                <Sparkles className="h-3 w-3 text-purple-400 ml-auto" title="AI-powered analysis" />
                              )}
                            </div>
                            <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                              {renderTextWithLinks(aiExplanation || staticExplanation)}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* NFL/NBA Content */}
          {(league === 'nfl' || league === 'nba') && getFullTeamName && formatSpread && parseBettingSplit && (
            <>
              {/* NFL Model Predictions */}
              <div className="text-center">
                <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-gray-200 dark:border-white/20 space-y-4">
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
                        
                        const aiExplanation = aiCompletions[gameId]?.['spread_prediction'];
                        const staticExplanation =
                          confidencePct <= 58 
                            ? `For this bet to win, ${getFullTeamName(predictedTeam).city} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. With ${confidencePct}% confidence, this is a toss-up.`
                            : confidencePct <= 65
                            ? `For this bet to win, ${getFullTeamName(predictedTeam).city} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. The model gives this a ${confidencePct}% chance.`
                            : `For this bet to win, ${getFullTeamName(predictedTeam).city} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. With ${confidencePct}% confidence, the model sees a strong likelihood.`;
                        
                        const explanation = aiExplanation || staticExplanation;
                        
                        return (
                          <>
                            <div className="grid grid-cols-2 items-stretch gap-3">
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
                              <div className={`${confidenceBgClass} backdrop-blur-sm rounded-lg border p-3 flex flex-col items-center justify-center`}>
                                <div className={`text-2xl sm:text-3xl font-extrabold leading-tight ${confidenceColorClass}`}>
                                  {confidencePct}%
                                </div>
                                <div className="text-xs text-gray-600 dark:text-white/60 font-medium mt-1">{confidenceLabel}</div>
                              </div>
                            </div>
                            <div className="bg-gray-100 dark:bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                              </div>
                              <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                                {renderTextWithLinks(explanation)}
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
                        
                        const aiExplanation = aiCompletions[gameId]?.['ou_prediction'];
                        const staticExplanation =
                          confidencePct <= 58 
                            ? `For this bet to win, the combined score needs to be ${isOver ? 'MORE' : 'LESS'} than ${totalPoints} points. With ${confidencePct}% confidence, this is a coin flip.`
                            : confidencePct <= 65
                            ? `For this bet to win, the combined score needs to be ${isOver ? 'MORE' : 'LESS'} than ${totalPoints} points. The model gives this a ${confidencePct}% chance.`
                            : `For this bet to win, the combined score needs to be ${isOver ? 'MORE' : 'LESS'} than ${totalPoints} points. With ${confidencePct}% confidence, the model expects a ${isOver ? 'high-scoring' : 'low-scoring'} game.`;
                        
                        const explanation = aiExplanation || staticExplanation;
                        
                        return (
                          <>
                            <div className="grid grid-cols-2 items-stretch gap-3">
                              <div className={`${arrowBg} backdrop-blur-sm rounded-lg border p-3 flex flex-col items-center justify-center`}>
                                <div className={`text-4xl sm:text-5xl font-black ${arrowColor}`}>{arrow}</div>
                                <div className="mt-2 text-sm sm:text-base font-semibold text-gray-900 dark:text-white text-center">
                                  {label} {prediction.over_line || '-'}
                                </div>
                              </div>
                              <div className={`${confidenceBgClass} backdrop-blur-sm rounded-lg border p-3 flex flex-col items-center justify-center`}>
                                <div className={`text-2xl sm:text-3xl font-extrabold leading-tight ${confidenceColorClass}`}>
                                  {confidencePct}%
                                </div>
                                <div className="text-xs text-gray-600 dark:text-white/60 font-medium mt-1">{confidenceLabel}</div>
                              </div>
                            </div>
                            <div className="bg-gray-100 dark:bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                              </div>
                              <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                                {renderTextWithLinks(explanation)}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Polymarket Widget for NFL - Full Public Betting Lines */}
              <div className="text-center">
                <PolymarketWidget
                  awayTeam={prediction.away_team}
                  homeTeam={prediction.home_team}
                  gameDate={prediction.game_date}
                  awayTeamColors={awayTeamColors}
                  homeTeamColors={homeTeamColors}
                  league={league}
                  compact={false}
                />
              </div>

              {/* Betting Split Labels Section for NFL */}
              {(prediction.ml_splits_label || prediction.spread_splits_label || prediction.total_splits_label) && (
                <div className="text-center">
                  <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-gray-200 dark:border-white/20 space-y-4">
                    <div className="flex items-center justify-center gap-2">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white">Public Betting Facts</h4>
                    </div>

                    {/* Description explaining the data source */}
                    <p className="text-xs text-gray-600 dark:text-white/70 text-center px-2">
                      While <span className="font-semibold">Public Betting Lines</span> shows live prediction market contracts being bought, 
                      <span className="font-semibold"> Public Betting Facts</span> is a separate data source tracking the lean of actual 
                      sportsbook money flow and bets placed.
                    </p>

                    {/* Betting splits badges - always visible */}
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
                          <div key="ml" className={`${bgClass} backdrop-blur-sm rounded-lg border px-3 py-2 flex items-center gap-2`}>
                            <TrendingUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">ML: {mlData.team}</span>
                          </div>
                        );
                      })()}
                      
                      {prediction.spread_splits_label && (() => {
                        const spreadData = parseBettingSplit(prediction.spread_splits_label);
                        if (!spreadData || !spreadData.team) return null;
                        const colorTheme = spreadData.isSharp ? 'green' :
                                          spreadData.percentage >= 70 ? 'purple' :
                                          spreadData.percentage >= 60 ? 'blue' : 'neutral';
                        const bgClass = colorTheme === 'green' ? 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20' :
                                       colorTheme === 'purple' ? 'bg-purple-100 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/20' :
                                       colorTheme === 'blue' ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/20' :
                                       'bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/20';
                        return (
                          <div key="spread" className={`${bgClass} backdrop-blur-sm rounded-lg border px-3 py-2 flex items-center gap-2`}>
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
                          <div key="total" className={`${bgClass} backdrop-blur-sm rounded-lg border px-3 py-2 flex items-center gap-2`}>
                            <BarChart className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                            <span className={`text-sm font-bold ${arrowColor}`}>{arrow}</span>
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">{totalData.team}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* H2H Historical Data Section for NFL */}
              <div className="text-center">
                <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-gray-200 dark:border-white/20 space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <History className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">Head to Head</h4>
                  </div>

                  {h2hLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  ) : h2hError ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{h2hError}</AlertDescription>
                    </Alert>
                  ) : h2hGames.length === 0 ? (
                    <div className="text-sm text-gray-600 dark:text-white/70">
                      No historical matchups found between these teams
                    </div>
                  ) : (
                    <>
                      {/* Summary Statistics */}
                      <div className="grid grid-cols-3 gap-4">
                        {/* Wins */}
                        <div className="text-center">
                          <h5 className="text-xs font-semibold text-gray-600 dark:text-white/70 uppercase tracking-wide mb-2">Wins</h5>
                          <div className="flex items-center justify-center space-x-2">
                            <div className={`flex flex-col items-center p-2 rounded-lg transition-all duration-200 ${
                              h2hStats.awayTeamWins > h2hStats.homeTeamWins 
                                ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                                : 'bg-transparent'
                            }`}>
                              <img 
                                src={getTeamLogo(prediction.away_team)} 
                                alt={`${prediction.away_team} logo`}
                                className="object-contain w-8 h-8"
                              />
                              <div className="font-bold text-gray-900 dark:text-white text-lg">{h2hStats.awayTeamWins}</div>
                            </div>
                            <div className={`flex flex-col items-center p-2 rounded-lg transition-all duration-200 ${
                              h2hStats.homeTeamWins > h2hStats.awayTeamWins 
                                ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                                : 'bg-transparent'
                            }`}>
                              <img 
                                src={getTeamLogo(prediction.home_team)} 
                                alt={`${prediction.home_team} logo`}
                                className="object-contain w-8 h-8"
                              />
                              <div className="font-bold text-gray-900 dark:text-white text-lg">{h2hStats.homeTeamWins}</div>
                            </div>
                          </div>
                        </div>

                        {/* Covers */}
                        <div className="text-center">
                          <h5 className="text-xs font-semibold text-gray-600 dark:text-white/70 uppercase tracking-wide mb-2">Covers</h5>
                          <div className="flex items-center justify-center space-x-2">
                            <div className={`flex flex-col items-center p-2 rounded-lg transition-all duration-200 ${
                              h2hStats.awayTeamCovers > h2hStats.homeTeamCovers 
                                ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                                : 'bg-transparent'
                            }`}>
                              <img 
                                src={getTeamLogo(prediction.away_team)} 
                                alt={`${prediction.away_team} logo`}
                                className="object-contain w-8 h-8"
                              />
                              <div className="font-bold text-gray-900 dark:text-white text-lg">{h2hStats.awayTeamCovers}</div>
                            </div>
                            <div className={`flex flex-col items-center p-2 rounded-lg transition-all duration-200 ${
                              h2hStats.homeTeamCovers > h2hStats.awayTeamCovers 
                                ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                                : 'bg-transparent'
                            }`}>
                              <img 
                                src={getTeamLogo(prediction.home_team)} 
                                alt={`${prediction.home_team} logo`}
                                className="object-contain w-8 h-8"
                              />
                              <div className="font-bold text-gray-900 dark:text-white text-lg">{h2hStats.homeTeamCovers}</div>
                            </div>
                          </div>
                        </div>

                        {/* O/U */}
                        <div className="text-center">
                          <h5 className="text-xs font-semibold text-gray-600 dark:text-white/70 uppercase tracking-wide mb-2">O/U</h5>
                          <div className="flex items-center justify-center space-x-2">
                            <div className={`flex flex-col items-center p-2 rounded-lg transition-all duration-200 ${
                              h2hStats.overs > h2hStats.unders 
                                ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                                : 'bg-transparent'
                            }`}>
                              <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center w-8 h-8">
                                <ArrowUp className="text-emerald-600 dark:text-emerald-400 h-4 w-4" />
                              </div>
                              <div className="font-bold text-gray-900 dark:text-white text-lg">{h2hStats.overs}</div>
                            </div>
                            <div className={`flex flex-col items-center p-2 rounded-lg transition-all duration-200 ${
                              h2hStats.unders > h2hStats.overs 
                                ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                                : 'bg-transparent'
                            }`}>
                              <div className="rounded-full bg-red-50 dark:bg-red-950/50 flex items-center justify-center w-8 h-8">
                                <ArrowDown className="text-red-600 dark:text-red-400 h-4 w-4" />
                              </div>
                              <div className="font-bold text-gray-900 dark:text-white text-lg">{h2hStats.unders}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Recent Matchups */}
                      <div className="space-y-2 mt-4">
                        <div className="text-xs text-gray-600 dark:text-white/70 mb-2">
                          Last {h2hGames.length} matchup{h2hGames.length !== 1 ? 's' : ''}:
                        </div>
                        {h2hGames.slice(0, 3).map((game: any) => (
                          <div key={game.id} className="border border-gray-200 dark:border-white/20 rounded-lg bg-gray-100 dark:bg-white/5 p-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <div className="flex items-center space-x-1">
                                <Calendar className="text-gray-500 dark:text-white/60 h-3 w-3" />
                                <span className="font-medium text-gray-600 dark:text-white/70">
                                  {formatDate(game.game_date)}
                                </span>
                              </div>
                              <span className="text-gray-500 dark:text-white/60">Week {game.week}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <img 
                                  src={getTeamLogo(game.away_team)} 
                                  alt={game.away_team}
                                  className="object-contain h-6 w-6"
                                />
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">{game.away_score}</span>
                              </div>
                              <span className="text-xs text-gray-500 dark:text-white/60">@</span>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">{game.home_score}</span>
                                <img 
                                  src={getTeamLogo(game.home_team)} 
                                  alt={game.home_team}
                                  className="object-contain h-6 w-6"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Line Movement Section for NFL */}
              <div className="text-center">
                <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-gray-200 dark:border-white/20 space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">Line Movement</h4>
                  </div>

                  {lineLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-64 w-full" />
                    </div>
                  ) : lineError ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{lineError}</AlertDescription>
                    </Alert>
                  ) : chartData.length === 0 ? (
                    <div className="text-sm text-gray-600 dark:text-white/70">
                      No line movement data available for this game
                    </div>
                  ) : (
                    <>
                      {/* Team Selection Buttons */}
                      <div className="flex justify-center space-x-2 mb-4">
                        <Button
                          variant={selectedTeam === 'away' ? 'default' : 'outline'}
                          onClick={() => setSelectedTeam('away')}
                          className={`flex items-center space-x-2 px-4 py-2 transition-all duration-200 text-sm ${
                            selectedTeam === 'away'
                              ? 'text-white shadow-lg border-0'
                              : 'bg-card hover:bg-muted text-foreground border-border'
                          }`}
                          style={selectedTeam === 'away' ? {
                            backgroundColor: awayTeamColors.primary,
                            backgroundImage: `linear-gradient(135deg, ${awayTeamColors.primary} 0%, ${awayTeamColors.secondary} 100%)`
                          } : {}}
                        >
                          <img
                            src={getTeamLogo(prediction.away_team)}
                            alt={`${prediction.away_team} logo`}
                            className="h-5 w-5"
                          />
                          <span className="font-semibold">{prediction.away_team}</span>
                        </Button>

                        <Button
                          variant={selectedTeam === 'home' ? 'default' : 'outline'}
                          onClick={() => setSelectedTeam('home')}
                          className={`flex items-center space-x-2 px-4 py-2 transition-all duration-200 text-sm ${
                            selectedTeam === 'home'
                              ? 'text-white shadow-lg border-0'
                              : 'bg-card hover:bg-muted text-foreground border-border'
                          }`}
                          style={selectedTeam === 'home' ? {
                            backgroundColor: homeTeamColors.primary,
                            backgroundImage: `linear-gradient(135deg, ${homeTeamColors.primary} 0%, ${homeTeamColors.secondary} 100%)`
                          } : {}}
                        >
                          <img
                            src={getTeamLogo(prediction.home_team)}
                            alt={`${prediction.home_team} logo`}
                            className="h-5 w-5"
                          />
                          <span className="font-semibold">{prediction.home_team}</span>
                        </Button>
                      </div>

                      {/* Spread Chart */}
                      <div className="relative h-64 w-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10 rounded-xl p-4 border border-gray-200 dark:border-white/20">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 40 }}>
                            <CartesianGrid
                              strokeDasharray="2 4"
                              stroke="currentColor"
                              strokeOpacity={0.1}
                              vertical={false}
                              className="text-gray-400 dark:text-white/30"
                            />
                            <XAxis
                              dataKey="displayTime"
                              tick={{ fontSize: 10, fontWeight: 500, fill: 'currentColor' }}
                              axisLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                              tickLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                              className="text-gray-600 dark:text-white/70"
                            />
                            <YAxis
                              tick={{ fontSize: 10, fontWeight: 600, fill: 'currentColor' }}
                              axisLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                              tickLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                              tickFormatter={(value) => value.toFixed(1)}
                              className="text-gray-600 dark:text-white/70"
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Line
                              type="linear"
                              dataKey={selectedTeam === 'away' ? 'awaySpread' : 'homeSpread'}
                              stroke={selectedTeam === 'away' ? awayTeamColors.primary : homeTeamColors.primary}
                              strokeWidth={3}
                              dot={{ 
                                fill: selectedTeam === 'away' ? awayTeamColors.primary : homeTeamColors.primary, 
                                strokeWidth: 2, 
                                r: 5,
                                stroke: '#ffffff'
                              }}
                              activeDot={{ 
                                r: 8, 
                                stroke: selectedTeam === 'away' ? awayTeamColors.primary : homeTeamColors.primary, 
                                strokeWidth: 3,
                                fill: '#ffffff'
                              }}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              connectNulls={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="absolute bottom-1 left-0 right-0 text-center">
                          <div className="text-xs font-medium text-gray-600 dark:text-white/70">
                            Opening: {selectedTeam === 'away'
                              ? (chartData[0]?.awaySpread?.toFixed(1) || 'N/A')
                              : (chartData[0]?.homeSpread?.toFixed(1) || 'N/A')
                            } | Current: {selectedTeam === 'away'
                              ? (chartData[chartData.length - 1]?.awaySpread?.toFixed(1) || 'N/A')
                              : (chartData[chartData.length - 1]?.homeSpread?.toFixed(1) || 'N/A')
                            }
                          </div>
                        </div>
                      </div>

                      {/* Over/Under Chart */}
                      <div className="mt-4">
                        <h5 className="text-sm font-semibold text-center text-gray-800 dark:text-white mb-3">Over/Under Line Movement</h5>
                        <div className="relative h-64 w-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10 rounded-xl p-4 border border-gray-200 dark:border-white/20">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 40 }}>
                              <CartesianGrid
                                strokeDasharray="2 4"
                                stroke="currentColor"
                                strokeOpacity={0.1}
                                vertical={false}
                                className="text-gray-400 dark:text-white/30"
                              />
                              <XAxis
                                dataKey="displayTime"
                                tick={{ fontSize: 10, fontWeight: 500, fill: 'currentColor' }}
                                axisLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                                tickLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                                angle={-45}
                                textAnchor="end"
                                height={60}
                                className="text-gray-600 dark:text-white/70"
                              />
                              <YAxis
                                tick={{ fontSize: 10, fontWeight: 600, fill: 'currentColor' }}
                                axisLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                                tickLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                                tickFormatter={(value) => value.toFixed(1)}
                                className="text-gray-600 dark:text-white/70"
                              />
                              <Tooltip content={<CustomTooltip />} />
                              <Line
                                type="linear"
                                dataKey="overLine"
                                stroke="#10b981"
                                strokeWidth={3}
                                dot={{ 
                                  fill: '#10b981', 
                                  strokeWidth: 2, 
                                  r: 5,
                                  stroke: '#ffffff'
                                }}
                                activeDot={{ 
                                  r: 8, 
                                  stroke: '#10b981', 
                                  strokeWidth: 3,
                                  fill: '#ffffff'
                                }}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                connectNulls={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                          <div className="absolute bottom-1 left-0 right-0 text-center">
                            <div className="text-xs font-medium text-gray-600 dark:text-white/70">
                              Opening O/U: {chartData[0]?.overLine?.toFixed(1) || 'N/A'} | Current O/U: {chartData[chartData.length - 1]?.overLine?.toFixed(1) || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Weather Section for NFL - Full Weather Details */}
              <div className="text-center">
                <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-gray-200 dark:border-white/20 space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <CloudRain className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">Full Weather Details</h4>
                  </div>
                  
                  {(prediction.icon || prediction.temperature !== null || prediction.wind_speed !== null) ? (
                    <div className="flex justify-center">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-4 mb-2">
                          {prediction.icon && (
                            <div className="w-16 h-16 flex items-center justify-center">
                              <WeatherIconComponent 
                                code={prediction.icon}
                                size={64}
                                className="stroke-current text-gray-800 dark:text-white"
                              />
                            </div>
                          )}

                          {prediction.temperature !== null && (
                            <div className="text-lg font-bold text-gray-900 dark:text-white min-w-[60px] text-center">
                              {Math.round(prediction.temperature)}°F
                            </div>
                          )}

                          {prediction.wind_speed !== null && prediction.wind_speed > 0 && (
                            <div className="flex items-center space-x-2 min-w-[70px]">
                              <IconWind size={24} className="stroke-current text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-medium text-gray-700 dark:text-white/80">
                                {Math.round(prediction.wind_speed)} mph
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {prediction.icon && (
                          <div className="text-xs font-medium text-gray-600 dark:text-white/70 capitalize">
                            {prediction.icon.replace(/-/g, ' ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <CloudRain className="h-12 w-12 mx-auto mb-2 text-gray-400 dark:text-gray-600" />
                      <p className="text-sm text-gray-600 dark:text-white/70">
                        Weather data not yet available
                      </p>
                      <p className="text-xs text-gray-500 dark:text-white/50 mt-1">
                        Check back closer to game time
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Weather Section for CFB/NCAAB - Full Weather Details */}
          {(league === 'cfb' || league === 'ncaab') && (
            <div className="text-center">
              <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-gray-200 dark:border-white/20 space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <CloudRain className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">Full Weather Details</h4>
                </div>
                
                {(() => {
                  const iconCode = mapCFBWeatherIconToCode(
                    (prediction as any).weather_icon_text,
                    prediction.icon_code
                  );
                  const temperature = (prediction as any).weather_temp_f ?? prediction.temperature;
                  const windSpeed = (prediction as any).weather_windspeed_mph ?? prediction.wind_speed;
                  const precipitation = prediction.precipitation;
                  
                  return (iconCode || temperature !== null || windSpeed !== null) ? (
                    <div className="flex justify-center">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-4 mb-2">
                          {iconCode && (
                            <div className="w-16 h-16 flex items-center justify-center">
                              <WeatherIconComponent 
                                code={iconCode}
                                size={64}
                                className="stroke-current text-gray-800 dark:text-white"
                              />
                            </div>
                          )}

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
                        
                        {iconCode && (
                          <div className="text-xs font-medium text-gray-600 dark:text-white/70 capitalize">
                            {iconCode.replace(/-/g, ' ')}
                          </div>
                        )}
                        
                        {precipitation !== null && precipitation > 0 && (
                          <div className="text-xs font-medium text-gray-600 dark:text-white/70 mt-1">
                            Precipitation: {precipitation > 1 ? Math.round(precipitation) : Math.round(precipitation * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <CloudRain className="h-12 w-12 mx-auto mb-2 text-gray-400 dark:text-gray-600" />
                      <p className="text-sm text-gray-600 dark:text-white/70">
                        Weather data not yet available
                      </p>
                      <p className="text-xs text-gray-500 dark:text-white/50 mt-1">
                        Check back closer to game time
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* CFB/NCAAB Content - Polymarket Widget */}
          {(league === 'cfb' || league === 'ncaab') && (
            <div className="text-center">
              <PolymarketWidget
                awayTeam={prediction.away_team}
                homeTeam={prediction.home_team}
                gameDate={prediction.game_date}
                awayTeamColors={awayTeamColors}
                homeTeamColors={homeTeamColors}
                league={league}
                compact={false}
              />
            </div>
          )}

          {/* Match Simulator Section - CFB/NCAAB */}
          {(league === 'cfb' || league === 'ncaab') && (
          <div className="text-center">
            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/20 space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Match Simulator</h4>
              </div>

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

              {simRevealedById[prediction.id] && (
                <div className="flex justify-between items-center bg-gradient-to-br from-orange-50 to-orange-50 dark:from-orange-950/30 dark:to-orange-950/30 p-3 sm:p-4 rounded-lg border border-border">
                  <div className="text-center flex-1">
                    <div 
                      className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-1 sm:mb-2 rounded-full flex items-center justify-center border-2 transition-transform duration-200 shadow-lg"
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
                    <div className="text-xl sm:text-2xl font-bold text-foreground">
                      {(() => {
                        const val = prediction.pred_away_points ?? prediction.pred_away_score;
                        return val !== null && val !== undefined ? Math.round(Number(val)).toString() : '-';
                      })()}
                    </div>
                  </div>

                  <div className="text-center px-3 sm:px-4">
                    <div className="text-base sm:text-lg font-bold text-muted-foreground">VS</div>
                  </div>

                  <div className="text-center flex-1">
                    <div 
                      className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-2 rounded-full flex items-center justify-center border-2 transition-transform duration-200 shadow-lg"
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
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
