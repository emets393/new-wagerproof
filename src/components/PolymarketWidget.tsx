import { useState, useEffect } from 'react';
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
import debug from '@/utils/debug';

interface PolymarketWidgetProps {
  awayTeam: string;
  homeTeam: string;
  gameDate?: string;
  awayTeamColors?: { primary: string; secondary: string };
  homeTeamColors?: { primary: string; secondary: string };
  league?: 'nfl' | 'cfb';
  compact?: boolean;
}

type TimeRange = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL';

// Utility function to calculate luminance of a hex color
const getLuminance = (hex: string): number => {
  // Remove # if present
  const color = hex.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(color.substring(0, 2), 16) / 255;
  const g = parseInt(color.substring(2, 4), 16) / 255;
  const b = parseInt(color.substring(4, 6), 16) / 255;
  
  // Calculate relative luminance
  const [rs, gs, bs] = [r, g, b].map((c) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

// Utility function to lighten a color
const lightenColor = (hex: string, percent: number): string => {
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  
  const newR = Math.min(255, Math.floor(r + (255 - r) * percent));
  const newG = Math.min(255, Math.floor(g + (255 - g) * percent));
  const newB = Math.min(255, Math.floor(b + (255 - b) * percent));
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

// Adjust color for dark mode visibility
const adjustColorForDarkMode = (color: string | undefined, isDark: boolean): string => {
  if (!color) return isDark ? '#ef4444' : '#ef4444'; // Default red
  
  // If not in dark mode, return original color
  if (!isDark) return color;
  
  // Check if color is too dark for dark mode
  const luminance = getLuminance(color);
  
  // If luminance is less than 0.15, lighten the color
  if (luminance < 0.15) {
    return lightenColor(color, 0.5); // Lighten by 50%
  } else if (luminance < 0.25) {
    return lightenColor(color, 0.3); // Lighten by 30%
  }
  
  return color;
};

export default function PolymarketWidget({
  awayTeam,
  homeTeam,
  gameDate,
  awayTeamColors,
  homeTeamColors,
  league = 'nfl',
  compact = false,
}: PolymarketWidgetProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [selectedMarket, setSelectedMarket] = useState<MarketType>('moneyline');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    // Initial check
    checkDarkMode();

    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const { data: allMarketsData, isLoading, error } = useQuery({
    queryKey: ['polymarket-all', league, awayTeam, homeTeam],
    queryFn: () => getAllMarketsData(awayTeam, homeTeam, league),
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
    debug.log('Button clicked:', newRange);
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
            <h3 className={compact ? "text-xs font-semibold" : "text-sm font-semibold"}>Public Betting Lines</h3>
            {!compact && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {filteredData.length} pts
              </Badge>
            )}
          </div>
        </div>

        {/* Market Type Selector - Hidden in compact mode */}
        {!compact && (
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
        )}

        {/* Current Odds */}
        <div className={`grid grid-cols-2 ${compact ? 'gap-1.5' : 'gap-2'}`}>
          <div
            className={compact ? "p-1.5 rounded-md border" : "p-2.5 rounded-lg border"}
            style={{
              backgroundColor: selectedMarket === 'total' 
                ? 'hsl(var(--muted))'
                : awayTeamColors?.primary
                ? `${awayTeamColors.primary}15`
                : 'hsl(var(--muted))',
              borderColor: selectedMarket === 'total'
                ? 'hsl(var(--border))'
                : awayTeamColors?.primary || 'hsl(var(--border))',
            }}
          >
            <div className={`flex ${compact ? 'flex-row items-center justify-between' : 'flex-col gap-1'}`}>
              <span className={compact ? "text-[10px] font-medium opacity-90" : "text-xs font-medium opacity-90"}>
                {selectedMarket === 'total' ? 'Over' : awayTeam}
              </span>
              <div className="flex items-baseline gap-1">
                <span className={compact ? "text-lg font-bold" : "text-2xl font-bold"}>{data.currentAwayOdds}%</span>
                {!compact && awayChange !== 0 && (
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
            className={compact ? "p-1.5 rounded-md border" : "p-2.5 rounded-lg border"}
            style={{
              backgroundColor: selectedMarket === 'total'
                ? 'hsl(var(--muted))'
                : homeTeamColors?.primary
                ? `${homeTeamColors.primary}15`
                : 'hsl(var(--muted))',
              borderColor: selectedMarket === 'total'
                ? 'hsl(var(--border))'
                : homeTeamColors?.primary || 'hsl(var(--border))',
            }}
          >
            <div className={`flex ${compact ? 'flex-row items-center justify-between' : 'flex-col gap-1'}`}>
              <span className={compact ? "text-[10px] font-medium opacity-90" : "text-xs font-medium opacity-90"}>
                {selectedMarket === 'total' ? 'Under' : homeTeam}
              </span>
              <div className="flex items-baseline gap-1">
                <span className={compact ? "text-lg font-bold" : "text-2xl font-bold"}>{data.currentHomeOdds}%</span>
                {!compact && homeChange !== 0 && (
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
                name={selectedMarket === 'total' ? 'Over' : awayTeam}
                stroke={selectedMarket === 'total' 
                  ? '#22c55e' 
                  : adjustColorForDarkMode(awayTeamColors?.primary, isDarkMode) || '#ef4444'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="homeTeamOdds"
                name={selectedMarket === 'total' ? 'Under' : homeTeam}
                stroke={selectedMarket === 'total'
                  ? '#ef4444'
                  : adjustColorForDarkMode(homeTeamColors?.primary, isDarkMode) || '#3b82f6'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Time Range Selector - Hidden in compact mode */}
        {!compact && (
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
        )}

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

