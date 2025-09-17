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
      console.error('Error formatting timestamp:', error);
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
          console.error('Error fetching line movement data:', error);
          setError('Failed to fetch line movement data');
          return;
        }

        if (!data || data.length === 0) {
          setError('No line movement data available for this game');
          return;
        }

        setLineData(data);
      } catch (err) {
        console.error('Error fetching line data:', err);
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

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800">{label}</p>
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
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
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
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg' 
                    : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                }`}
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
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg' 
                    : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                }`}
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
            <div className="relative h-64 sm:h-80 w-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-2 sm:p-4 border border-slate-200 shadow-sm">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 40 }}>
                  <CartesianGrid 
                    strokeDasharray="2 4" 
                    stroke="#cbd5e1" 
                    strokeOpacity={0.6}
                    vertical={false}
                  />
                  
                  {/* X Axis */}
                  <XAxis 
                    dataKey="displayTime" 
                    tick={{ 
                      fontSize: 10, 
                      fontWeight: 500,
                      fill: '#475569'
                    }}
                    axisLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                    tickLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  
                  {/* Y Axis */}
                  <YAxis 
                    tick={{ 
                      fontSize: 10, 
                      fontWeight: 600,
                      fill: '#334155'
                    }}
                    axisLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                    tickLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
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
                        fill: '#475569'
                      }
                    }}
                  />
                  
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Single Line for Selected Team */}
                  <Line
                    type="linear"
                    dataKey={selectedTeam === 'away' ? 'awaySpread' : 'homeSpread'}
                    stroke={selectedTeam === 'away' ? '#2563eb' : '#dc2626'}
                    strokeWidth={4}
                    dot={{ 
                      fill: selectedTeam === 'away' ? '#2563eb' : '#dc2626', 
                      strokeWidth: 3, 
                      r: 7,
                      stroke: '#ffffff',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                    }}
                    activeDot={{ 
                      r: 10, 
                      stroke: selectedTeam === 'away' ? '#2563eb' : '#dc2626', 
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
                <div className="text-sm font-medium text-gray-700">
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
              <h3 className="text-lg font-semibold text-center text-gray-800">Over/Under Line Movement</h3>
              <div className="relative h-80 w-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 20, right: 40, left: 40, bottom: 20 }}>
                    <CartesianGrid 
                      strokeDasharray="2 4" 
                      stroke="#cbd5e1" 
                      strokeOpacity={0.6}
                      vertical={false}
                    />
                    
                    {/* X Axis */}
                    <XAxis 
                      dataKey="displayTime" 
                      tick={{ 
                        fontSize: 11, 
                        fontWeight: 500,
                        fill: '#475569'
                      }}
                      axisLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                      tickLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    
                    {/* Y Axis */}
                    <YAxis 
                      tick={{ 
                        fontSize: 11, 
                        fontWeight: 600,
                        fill: '#334155'
                      }}
                      axisLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                      tickLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
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
                          fill: '#475569'
                        }
                      }}
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
                  <div className="text-xs sm:text-sm font-medium text-gray-700">
                    Opening O/U: {chartData[0]?.overLine?.toFixed(1) || 'N/A'} | Current O/U: {chartData[chartData.length - 1]?.overLine?.toFixed(1) || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end">
              <Button onClick={onClose} variant="outline">
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
