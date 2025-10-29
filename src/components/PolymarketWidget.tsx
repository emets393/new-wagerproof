import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getAllMarketsData } from '@/services/polymarketService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { MarketType } from '@/types/polymarket';

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
  const [selectedMarket, setSelectedMarket] = useState<MarketType>('moneyline');

  const { data: allMarketsData, isLoading, error } = useQuery({
    queryKey: ['polymarket-all', awayTeam, homeTeam],
    queryFn: () => getAllMarketsData(awayTeam, homeTeam),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Get the currently selected market data
  const data = allMarketsData?.[selectedMarket];

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
  if (!allMarketsData || error) {
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

  // Check which markets are available
  const availableMarkets: MarketType[] = [];
  if (allMarketsData.moneyline) availableMarkets.push('moneyline');
  if (allMarketsData.spread) availableMarkets.push('spread');
  if (allMarketsData.total) availableMarkets.push('total');

  // If no markets available
  if (availableMarkets.length === 0) {
    return (
      <Card className="w-full bg-muted/20">
        <CardContent className="p-4">
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              No betting markets available for this game
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If selected market isn't available, switch to first available
  if (!data && availableMarkets.length > 0 && !availableMarkets.includes(selectedMarket)) {
    setSelectedMarket(availableMarkets[0]);
    return null;
  }

  // If no data for selected market
  if (!data || filteredData.length === 0) {
    return (
      <Card className="w-full bg-muted/20">
        <CardContent className="p-4">
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              No data available for selected market
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

  const handleButtonClick = (e: React.MouseEvent, newRange: TimeRange) => {
    e.stopPropagation();
    e.preventDefault();
    e.nativeEvent.stopImmediatePropagation();
    console.log('Button clicked:', newRange); // Debug log
    setTimeRange(newRange);
  };

  return (
    <div 
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="w-full pointer-events-auto relative z-[100]"
      style={{ isolation: 'isolate' }}
    >
      <Card className="w-full bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Public Betting Lines</h3>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {filteredData.length} pts
            </Badge>
          </div>
        </div>

        {/* Market Type Selector */}
        <div className="flex justify-center gap-2">
          <Button
            variant={selectedMarket === 'moneyline' ? 'default' : 'outline'}
            size="sm"
            onClick={(e) => {
              handleButtonClick(e, '1M');
              setSelectedMarket('moneyline');
            }}
            disabled={!allMarketsData.moneyline}
            className="h-8 px-3 text-xs"
          >
            ML
          </Button>
          <Button
            variant={selectedMarket === 'spread' ? 'default' : 'outline'}
            size="sm"
            onClick={(e) => {
              handleButtonClick(e, '1M');
              setSelectedMarket('spread');
            }}
            disabled={!allMarketsData.spread}
            className="h-8 px-3 text-xs"
          >
            Spread
          </Button>
          <Button
            variant={selectedMarket === 'total' ? 'default' : 'outline'}
            size="sm"
            onClick={(e) => {
              handleButtonClick(e, '1M');
              setSelectedMarket('total');
            }}
            disabled={!allMarketsData.total}
            className="h-8 px-3 text-xs"
          >
            O/U
          </Button>
        </div>

        {/* Current Odds */}
        <div className="grid grid-cols-2 gap-2">
          <div
            className="p-2.5 rounded-lg border"
            style={{
              backgroundColor: awayTeamColors?.primary
                ? `${awayTeamColors.primary}15`
                : 'hsl(var(--muted))',
              borderColor: awayTeamColors?.primary || 'hsl(var(--border))',
            }}
          >
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium opacity-90">{awayTeam}</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold">{data.currentAwayOdds}%</span>
                {awayChange !== 0 && (
                  <div className="flex items-center gap-0.5">
                    {awayChange > 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span className={`text-xs font-semibold ${awayChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {awayChange > 0 ? '+' : ''}{awayChange}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div
            className="p-2.5 rounded-lg border"
            style={{
              backgroundColor: homeTeamColors?.primary
                ? `${homeTeamColors.primary}15`
                : 'hsl(var(--muted))',
              borderColor: homeTeamColors?.primary || 'hsl(var(--border))',
            }}
          >
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium opacity-90">{homeTeam}</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold">{data.currentHomeOdds}%</span>
                {homeChange !== 0 && (
                  <div className="flex items-center gap-0.5">
                    {homeChange > 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span className={`text-xs font-semibold ${homeChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {homeChange > 0 ? '+' : ''}{homeChange}%
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
        <div className="flex justify-center gap-1 flex-wrap relative z-[110]">
          {(['1H', '6H', '1D', '1W', '1M', 'ALL'] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'ghost'}
              size="sm"
              onClick={(e) => handleButtonClick(e, range)}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              className="h-7 px-2 text-xs cursor-pointer relative z-[111] pointer-events-auto"
              style={{ pointerEvents: 'auto' }}
              type="button"
            >
              {range}
            </Button>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="pt-2 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground/70 text-center leading-tight">
            Powered by Polymarket. We are not affiliated with or endorsed by Polymarket.
          </p>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}

