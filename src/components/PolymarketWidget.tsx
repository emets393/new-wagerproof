import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getMarketTimeSeriesData } from '@/services/polymarketService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

interface PolymarketWidgetProps {
  awayTeam: string;
  homeTeam: string;
  gameDate?: string;
  awayTeamColors?: { primary: string; secondary: string };
  homeTeamColors?: { primary: string; secondary: string };
}

type TimeRange = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL';

export default function PolymarketWidget({
  awayTeam,
  homeTeam,
  gameDate,
  awayTeamColors,
  homeTeamColors,
}: PolymarketWidgetProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');

  const { data, isLoading, error } = useQuery({
    queryKey: ['polymarket', awayTeam, homeTeam],
    queryFn: () => getMarketTimeSeriesData(awayTeam, homeTeam),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Filter data based on time range
  const filterDataByTimeRange = () => {
    if (!data?.data || data.data.length === 0) return [];

    const now = Date.now();
    const ranges: Record<TimeRange, number> = {
      '1H': 60 * 60 * 1000,
      '6H': 6 * 60 * 60 * 1000,
      '1D': 24 * 60 * 60 * 1000,
      '1W': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000,
      'ALL': Infinity,
    };

    const cutoff = now - ranges[timeRange];
    return data.data.filter((point) => point.timestamp >= cutoff);
  };

  const filteredData = filterDataByTimeRange();

  // Loading state
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-48 w-full" />
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-8 w-12" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!data || error || filteredData.length === 0) {
    return (
      <Card className="w-full bg-muted/20">
        <CardContent className="p-4">
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              Polymarket betting data unavailable for this game
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate percentage changes
  const firstPoint = filteredData[0];
  const lastPoint = filteredData[filteredData.length - 1];
  const awayChange = lastPoint.awayTeamOdds - firstPoint.awayTeamOdds;
  const homeChange = lastPoint.homeTeamOdds - firstPoint.homeTeamOdds;

  // Format volume
  const formatVolume = (vol?: number) => {
    if (!vol) return 'N/A';
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}k`;
    return `$${vol.toFixed(0)}`;
  };

  return (
    <Card className="w-full bg-card/50 backdrop-blur-sm border-border/50">
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Polymarket Lines</h3>
            {data.volume && (
              <Badge variant="secondary" className="text-xs">
                {formatVolume(data.volume)} Vol.
              </Badge>
            )}
          </div>
          <a
            href={`https://polymarket.com`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            polymarket.com
          </a>
        </div>

        {/* Current Odds */}
        <div className="grid grid-cols-2 gap-2">
          <div
            className="p-2 rounded-lg border"
            style={{
              backgroundColor: awayTeamColors?.primary
                ? `${awayTeamColors.primary}15`
                : 'hsl(var(--muted))',
              borderColor: awayTeamColors?.primary || 'hsl(var(--border))',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{awayTeam}</span>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold">{data.currentAwayOdds}%</span>
                {awayChange !== 0 && (
                  <div className="flex items-center text-xs">
                    {awayChange > 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span className={awayChange > 0 ? 'text-green-500' : 'text-red-500'}>
                      {Math.abs(awayChange)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div
            className="p-2 rounded-lg border"
            style={{
              backgroundColor: homeTeamColors?.primary
                ? `${homeTeamColors.primary}15`
                : 'hsl(var(--muted))',
              borderColor: homeTeamColors?.primary || 'hsl(var(--border))',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{homeTeam}</span>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold">{data.currentHomeOdds}%</span>
                {homeChange !== 0 && (
                  <div className="flex items-center text-xs">
                    {homeChange > 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span className={homeChange > 0 ? 'text-green-500' : 'text-red-500'}>
                      {Math.abs(homeChange)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="w-full h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={filteredData}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(timestamp) => format(new Date(timestamp), 'MMM d')}
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '10px' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '10px' }}
                tickLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelFormatter={(timestamp) => format(new Date(timestamp), 'MMM d, h:mm a')}
                formatter={(value: number) => [`${value}%`, '']}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px' }}
                iconType="line"
              />
              <Line
                type="monotone"
                dataKey="awayTeamOdds"
                name={awayTeam}
                stroke={awayTeamColors?.primary || '#ef4444'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="homeTeamOdds"
                name={homeTeam}
                stroke={homeTeamColors?.primary || '#3b82f6'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Time Range Selector */}
        <div className="flex justify-center gap-1 flex-wrap">
          {(['1H', '6H', '1D', '1W', '1M', 'ALL'] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTimeRange(range)}
              className="h-7 px-2 text-xs"
            >
              {range}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

