import debug from '@/utils/debug';
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { AlertCircle, TrendingUp } from 'lucide-react';

interface TeamMapping {
  city_and_name: string;
  team_name: string;
  logo_url: string;
}

interface LineMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  uniqueId: string;
  homeTeam: string;
  awayTeam: string;
  teamMappings: TeamMapping[];
}

interface LineMovementData {
  as_of_ts: string;
  home_spread: number | null;
  away_spread: number | null;
  over_line: number | null;
  home_team: string;
  away_team: string;
}

interface ChartDataPoint {
  timestamp: string;
  displayTime: string;
  homeSpread: number | null;
  awaySpread: number | null;
  overLine: number | null;
}

const LineMovementModal = ({ isOpen, onClose, uniqueId, homeTeam, awayTeam, teamMappings }: LineMovementModalProps) => {
  const [lineData, setLineData] = useState<LineMovementData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('away');

  // Format timestamp to display format (e.g., "9/5 (2:46PM)")
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

  // Fetch line movement data
  useEffect(() => {
    if (!isOpen || !uniqueId) return;

    const fetchLineData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await collegeFootballSupabase
          .from('nfl_betting_lines')
          .select('as_of_ts, home_spread, away_spread, over_line, home_team, away_team')
          .eq('training_key', uniqueId)
          .order('as_of_ts', { ascending: true });

        if (error) {
          debug.error('Error fetching line movement data:', error);
          setError('Failed to fetch line movement data');
          return;
        }

        if (!data || data.length === 0) {
          setError('No line movement data available for this game');
          return;
        }

        setLineData(data);
      } catch (err) {
        debug.error('Error fetching line data:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchLineData();
  }, [isOpen, uniqueId]);

  // Transform data for chart
  const chartData: ChartDataPoint[] = lineData.map(item => ({
    timestamp: item.as_of_ts,
    displayTime: formatTimestamp(item.as_of_ts),
    homeSpread: item.home_spread,
    awaySpread: item.away_spread,
    overLine: item.over_line
  }));

  // Get team logos
  const getTeamLogo = (teamName: string): string | null => {
    const mapping = teamMappings.find(m => m.team_name === teamName);
    return mapping?.logo_url || null;
  };

  // Function to get NFL team colors
  const getNFLTeamColors = (teamName: string): { primary: string; secondary: string } => {
    const colorMap: { [key: string]: { primary: string; secondary: string } } = {
      'Arizona': { primary: '#97233F', secondary: '#000000' },
      'Atlanta': { primary: '#A71930', secondary: '#000000' },
      'Baltimore': { primary: '#241773', secondary: '#000000' },
      'Buffalo': { primary: '#00338D', secondary: '#C60C30' },
      'Carolina': { primary: '#0085CA', secondary: '#101820' },
      'Chicago': { primary: '#0B162A', secondary: '#C83803' },
      'Cincinnati': { primary: '#FB4F14', secondary: '#000000' },
      'Cleveland': { primary: '#311D00', secondary: '#FF3C00' },
      'Dallas': { primary: '#003594', secondary: '#041E42' },
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

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
          <p className="font-semibold text-card-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'homeSpread' ? `${homeTeam} Spread: ` :
               entry.dataKey === 'awaySpread' ? `${awayTeam} Spread: ` :
               entry.dataKey === 'overLine' ? 'Over/Under: ' : ''}
              {entry.value !== null ? entry.value.toFixed(1) : 'N/A'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto font-inter bg-gradient-to-br from-background to-muted/20 border-border/50 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center text-foreground">
            Line Movement: {awayTeam} @ {homeTeam}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : error ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : chartData.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No line movement data available for this game.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Team Selection Buttons */}
            <div className="flex justify-center space-x-2 sm:space-x-4 mb-4 sm:mb-6">
              <Button
                variant={selectedTeam === 'away' ? 'default' : 'outline'}
                onClick={() => setSelectedTeam('away')}
                className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-6 py-2 sm:py-3 transition-all duration-200 text-sm sm:text-base ${
                  selectedTeam === 'away'
                    ? 'text-white shadow-lg border-0 hover:shadow-xl'
                    : 'bg-card hover:bg-muted text-foreground border-border hover:border-opacity-70'
                }`}
                style={selectedTeam === 'away' ? {
                  backgroundColor: getNFLTeamColors(awayTeam).primary,
                  backgroundImage: `linear-gradient(135deg, ${getNFLTeamColors(awayTeam).primary} 0%, ${getNFLTeamColors(awayTeam).secondary} 100%)`
                } : {}}
                onMouseEnter={(e) => {
                  if (selectedTeam === 'away') {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.filter = 'brightness(1.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTeam === 'away') {
                    e.currentTarget.style.transform = 'translateY(0px)';
                    e.currentTarget.style.filter = 'brightness(1)';
                  }
                }}
              >
                {getTeamLogo(awayTeam) && (
                  <img
                    src={getTeamLogo(awayTeam)}
                    alt={`${awayTeam} logo`}
                    className="h-6 w-6"
                  />
                )}
                <span className="font-semibold">{awayTeam} Spread</span>
              </Button>

              <Button
                variant={selectedTeam === 'home' ? 'default' : 'outline'}
                onClick={() => setSelectedTeam('home')}
                className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-6 py-2 sm:py-3 transition-all duration-200 text-sm sm:text-base ${
                  selectedTeam === 'home'
                    ? 'text-white shadow-lg border-0 hover:shadow-xl'
                    : 'bg-card hover:bg-muted text-foreground border-border hover:border-opacity-70'
                }`}
                style={selectedTeam === 'home' ? {
                  backgroundColor: getNFLTeamColors(homeTeam).primary,
                  backgroundImage: `linear-gradient(135deg, ${getNFLTeamColors(homeTeam).primary} 0%, ${getNFLTeamColors(homeTeam).secondary} 100%)`
                } : {}}
                onMouseEnter={(e) => {
                  if (selectedTeam === 'home') {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.filter = 'brightness(1.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTeam === 'home') {
                    e.currentTarget.style.transform = 'translateY(0px)';
                    e.currentTarget.style.filter = 'brightness(1)';
                  }
                }}
              >
                {getTeamLogo(homeTeam) && (
                  <img
                    src={getTeamLogo(homeTeam)}
                    alt={`${homeTeam} logo`}
                    className="h-6 w-6"
                  />
                )}
                <span className="font-semibold">{homeTeam} Spread</span>
              </Button>
            </div>

            {/* Chart */}
            <div className="relative h-64 sm:h-80 w-full bg-gradient-to-br from-muted/20 to-muted/40 rounded-xl p-2 sm:p-4 border border-border shadow-sm">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 40 }}>
                  <CartesianGrid
                    strokeDasharray="2 4"
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    vertical={false}
                    className="text-muted-foreground"
                  />

                  {/* X Axis */}
                  <XAxis
                    dataKey="displayTime"
                    tick={{
                      fontSize: 10,
                      fontWeight: 500,
                      fill: 'currentColor'
                    }}
                    axisLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                    tickLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    className="text-muted-foreground"
                  />

                  {/* Y Axis */}
                  <YAxis
                    tick={{
                      fontSize: 10,
                      fontWeight: 600,
                      fill: 'currentColor'
                    }}
                    axisLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                    tickLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                    tickFormatter={(value) => value.toFixed(1)}
                    domain={['dataMin - 1', 'dataMax + 1']}
                    ticks={(() => {
                      const dataValues = chartData.map(d => selectedTeam === 'away' ? d.awaySpread : d.homeSpread).filter(v => v !== null);
                      if (dataValues.length === 0) return [];

                      const min = Math.min(...dataValues);
                      const max = Math.max(...dataValues);

                      // Extend the range beyond the data to show a fuller scale
                      const rangeMin = Math.floor((min - 1) * 2) / 2; // Round down to nearest 0.5, with 1 point buffer
                      const rangeMax = Math.ceil((max + 1) * 2) / 2;   // Round up to nearest 0.5, with 1 point buffer

                      const ticks = [];
                      for (let i = rangeMin; i <= rangeMax; i += 0.5) {
                        ticks.push(i);
                      }
                      return ticks;
                    })()}
                    label={{
                      value: selectedTeam === 'away' ? `${awayTeam} Spread` : `${homeTeam} Spread`,
                      angle: -90,
                      position: 'insideLeft',
                      style: {
                        textAnchor: 'middle',
                        fontSize: '12px',
                        fontWeight: '600',
                        fill: 'currentColor'
                      }
                    }}
                    className="text-muted-foreground"
                  />
                  
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Single Line for Selected Team */}
                  <Line
                    type="linear"
                    dataKey={selectedTeam === 'away' ? 'awaySpread' : 'homeSpread'}
                    stroke={selectedTeam === 'away' ? getNFLTeamColors(awayTeam).primary : getNFLTeamColors(homeTeam).primary}
                    strokeWidth={4}
                    dot={{ 
                      fill: selectedTeam === 'away' ? getNFLTeamColors(awayTeam).primary : getNFLTeamColors(homeTeam).primary, 
                      strokeWidth: 3, 
                      r: 7,
                      stroke: '#ffffff',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                    }}
                    activeDot={{ 
                      r: 10, 
                      stroke: selectedTeam === 'away' ? getNFLTeamColors(awayTeam).primary : getNFLTeamColors(homeTeam).primary, 
                      strokeWidth: 4,
                      fill: '#ffffff',
                      filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))'
                    }}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    connectNulls={false}
                    name={selectedTeam === 'away' ? `${awayTeam} Spread` : `${homeTeam} Spread`}
                  />
                </LineChart>
              </ResponsiveContainer>
              
              {/* Spread Values Text */}
              <div className="absolute bottom-2 left-0 right-0 text-center">
                <div className="text-sm font-medium text-muted-foreground">
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
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-center text-foreground">Over/Under Line Movement</h3>
              <div className="relative h-80 w-full bg-gradient-to-br from-muted/20 to-muted/40 rounded-xl p-4 border border-border shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 20, right: 40, left: 40, bottom: 20 }}>
                    <CartesianGrid
                      strokeDasharray="2 4"
                      stroke="currentColor"
                      strokeOpacity={0.1}
                      vertical={false}
                      className="text-muted-foreground"
                    />

                    {/* X Axis */}
                    <XAxis
                      dataKey="displayTime"
                      tick={{
                        fontSize: 11,
                        fontWeight: 500,
                        fill: 'currentColor'
                      }}
                      axisLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                      tickLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      className="text-muted-foreground"
                    />

                    {/* Y Axis */}
                    <YAxis
                      tick={{
                        fontSize: 11,
                        fontWeight: 600,
                        fill: 'currentColor'
                      }}
                      axisLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                      tickLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                      tickFormatter={(value) => value.toFixed(1)}
                      domain={['dataMin - 1', 'dataMax + 1']}
                      ticks={(() => {
                        const dataValues = chartData.map(d => d.overLine).filter(v => v !== null);
                        if (dataValues.length === 0) return [];

                        const min = Math.min(...dataValues);
                        const max = Math.max(...dataValues);

                        // Extend the range beyond the data to show a fuller scale
                        const rangeMin = Math.floor((min - 1) * 2) / 2; // Round down to nearest 0.5, with 1 point buffer
                        const rangeMax = Math.ceil((max + 1) * 2) / 2;   // Round up to nearest 0.5, with 1 point buffer

                        const ticks = [];
                        for (let i = rangeMin; i <= rangeMax; i += 0.5) {
                          ticks.push(i);
                        }
                        return ticks;
                      })()}
                      label={{
                        value: 'Over/Under Line',
                        angle: -90,
                        position: 'insideLeft',
                        style: {
                          textAnchor: 'middle',
                          fontSize: '12px',
                          fontWeight: '600',
                          fill: 'currentColor'
                        }
                      }}
                      className="text-muted-foreground"
                    />
                    
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* Over/Under Line */}
                    <Line
                      type="linear"
                      dataKey="overLine"
                      stroke="#10b981"
                      strokeWidth={4}
                      dot={{ 
                        fill: '#10b981', 
                        strokeWidth: 3, 
                        r: 7,
                        stroke: '#ffffff',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                      }}
                      activeDot={{ 
                        r: 10, 
                        stroke: '#10b981', 
                        strokeWidth: 4,
                        fill: '#ffffff',
                        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))'
                      }}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      connectNulls={false}
                      name="Over/Under Line"
                    />
                  </LineChart>
                </ResponsiveContainer>
                
                {/* Over/Under Values Text */}
                <div className="absolute bottom-1 left-0 right-0 text-center">
                  <div className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Opening O/U: {chartData[0]?.overLine?.toFixed(1) || 'N/A'} | Current O/U: {chartData[chartData.length - 1]?.overLine?.toFixed(1) || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end">
              <Button onClick={onClose} variant="outline" className="border-border text-foreground hover:bg-muted">
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LineMovementModal;
