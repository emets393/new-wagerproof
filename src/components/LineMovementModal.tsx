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
  home_team: string;
  away_team: string;
}

interface ChartDataPoint {
  timestamp: string;
  displayTime: string;
  homeSpread: number | null;
  awaySpread: number | null;
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
          .select('as_of_ts, home_spread, away_spread, home_team, away_team')
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
    awaySpread: item.away_spread
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
              {entry.dataKey === 'homeSpread' ? `${homeTeam} Spread: ` : `${awayTeam} Spread: `}
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
          <div className="space-y-6">
            {/* Team Selection Buttons */}
            <div className="flex justify-center space-x-4 mb-6">
              <Button
                variant={selectedTeam === 'away' ? 'default' : 'outline'}
                onClick={() => setSelectedTeam('away')}
                className="flex items-center space-x-2 px-6 py-3"
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
                className="flex items-center space-x-2 px-6 py-3"
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
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  
                  {/* X Axis */}
                  <XAxis 
                    dataKey="displayTime" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  
                  {/* Y Axis */}
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.toFixed(1)}
                    domain={['dataMin - 2', 'dataMax + 2']}
                    ticks={(() => {
                      const min = Math.min(...chartData.map(d => selectedTeam === 'away' ? d.awaySpread : d.homeSpread).filter(v => v !== null)) - 2;
                      const max = Math.max(...chartData.map(d => selectedTeam === 'away' ? d.awaySpread : d.homeSpread).filter(v => v !== null)) + 2;
                      const ticks = [];
                      for (let i = min; i <= max; i += 0.5) {
                        ticks.push(i);
                      }
                      return ticks;
                    })()}
                    label={{ 
                      value: selectedTeam === 'away' ? `${awayTeam} Spread` : `${homeTeam} Spread`, 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { textAnchor: 'middle' }
                    }}
                  />
                  
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Single Line for Selected Team */}
                  <Line
                    type="monotone"
                    dataKey={selectedTeam === 'away' ? 'awaySpread' : 'homeSpread'}
                    stroke={selectedTeam === 'away' ? '#3b82f6' : '#ef4444'}
                    strokeWidth={3}
                    dot={{ 
                      fill: selectedTeam === 'away' ? '#3b82f6' : '#ef4444', 
                      strokeWidth: 2, 
                      r: 4 
                    }}
                    activeDot={{ 
                      r: 6, 
                      stroke: selectedTeam === 'away' ? '#3b82f6' : '#ef4444', 
                      strokeWidth: 2 
                    }}
                    connectNulls={false}
                    name={selectedTeam === 'away' ? `${awayTeam} Spread` : `${homeTeam} Spread`}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Data Summary */}
            <div className="flex justify-center space-x-6">
              {/* Current Spread */}
              <div className={`p-6 rounded-xl text-center border-2 ${selectedTeam === 'away' ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                <div className={`text-sm font-medium mb-2 ${selectedTeam === 'away' ? 'text-blue-700' : 'text-red-700'}`}>
                  Current Spread
                </div>
                <div className={`text-3xl font-bold ${selectedTeam === 'away' ? 'text-blue-800' : 'text-red-800'}`}>
                  {selectedTeam === 'away' 
                    ? (chartData[chartData.length - 1]?.awaySpread?.toFixed(1) || 'N/A')
                    : (chartData[chartData.length - 1]?.homeSpread?.toFixed(1) || 'N/A')
                  }
                </div>
              </div>
              
              {/* Opening Spread */}
              <div className={`p-6 rounded-xl text-center border-2 ${selectedTeam === 'away' ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                <div className={`text-sm font-medium mb-2 ${selectedTeam === 'away' ? 'text-blue-700' : 'text-red-700'}`}>
                  Opening Spread
                </div>
                <div className={`text-3xl font-bold ${selectedTeam === 'away' ? 'text-blue-800' : 'text-red-800'}`}>
                  {selectedTeam === 'away' 
                    ? (chartData[0]?.awaySpread?.toFixed(1) || 'N/A')
                    : (chartData[0]?.homeSpread?.toFixed(1) || 'N/A')
                  }
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
