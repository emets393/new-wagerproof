import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useTheme, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CartesianChart, Line } from 'victory-native';
import { useQuery } from '@tanstack/react-query';
import { getAllMarketsData } from '@/services/polymarketService';
import { MarketType, TimeRange } from '@/types/polymarket';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withTiming, 
  Easing,
  interpolate,
} from 'react-native-reanimated';

interface PolymarketWidgetProps {
  awayTeam: string;
  homeTeam: string;
  gameDate?: string;
  awayTeamColors?: { primary: string; secondary: string };
  homeTeamColors?: { primary: string; secondary: string };
  league?: 'nfl' | 'cfb';
}

// Utility function to convert hex to rgba
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Adjust color for dark mode visibility
const adjustColorForDarkMode = (color: string | undefined, isDark: boolean): string => {
  if (!color) return isDark ? '#ef4444' : '#ef4444';
  
  if (!isDark) return color;
  
  // Simple luminance check - if too dark, lighten it
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  
  if (luminance < 0.15) {
    // Lighten dark colors
    const newR = Math.min(255, Math.floor(r + (255 - r) * 0.5));
    const newG = Math.min(255, Math.floor(g + (255 - g) * 0.5));
    const newB = Math.min(255, Math.floor(b + (255 - b) * 0.5));
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }
  
  return color;
};

// Honeydew green color for value alerts (matching website)
const HONEYDEW_COLOR = '#73b69e';

// Animated glow component for odds cards
const AnimatedOddsCard = Animated.createAnimatedComponent(View);

export function PolymarketWidget({
  awayTeam,
  homeTeam,
  gameDate,
  awayTeamColors,
  homeTeamColors,
  league = 'nfl',
}: PolymarketWidgetProps) {
  const theme = useTheme();
  const isDark = theme.dark;
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [selectedMarket, setSelectedMarket] = useState<MarketType>('moneyline');

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

  // Check if game has started (disable alerts if game date/time has passed)
  const isGameStarted = useMemo(() => {
    if (!gameDate || typeof gameDate !== 'string') return false;
    
    try {
      let gameStartTime: Date;
      const now = new Date();
      
      // Handle both date-only format (YYYY-MM-DD) and datetime format (with time)
      const isDateTimeString = gameDate.includes('T') || 
                               gameDate.includes(' ') || 
                               gameDate.includes('+') ||
                               gameDate.length > 10;
      
      if (isDateTimeString) {
        gameStartTime = new Date(gameDate);
      } else {
        // Date-only format - treat as end of day
        gameStartTime = new Date(gameDate + 'T23:59:59Z');
      }
      
      if (isNaN(gameStartTime.getTime())) {
        return false;
      }
      
      return now > gameStartTime;
    } catch (error) {
      console.error('Error parsing game date:', error);
      return false;
    }
  }, [gameDate]);

  // Check for value alerts - memoized
  const valueAlerts = useMemo(() => {
    if (!allMarketsData) return [];
    
    try {
      const alerts: { market: MarketType; side: 'away' | 'home'; percentage: number; team: string }[] = [];
      const spread = allMarketsData.spread;
      const total = allMarketsData.total;
      const moneyline = allMarketsData.moneyline;
      
      // Check Spread (>57% on either side indicates Vegas line mismatch)
      if (spread && typeof spread.currentAwayOdds === 'number' && typeof spread.currentHomeOdds === 'number') {
        if (spread.currentAwayOdds > 57) {
          alerts.push({ 
            market: 'spread', 
            side: 'away', 
            percentage: spread.currentAwayOdds,
            team: awayTeam
          });
        }
        if (spread.currentHomeOdds > 57) {
          alerts.push({ 
            market: 'spread', 
            side: 'home', 
            percentage: spread.currentHomeOdds,
            team: homeTeam
          });
        }
      }
      
      // Check Total (>57% on either side indicates Vegas line mismatch)
      if (total && typeof total.currentAwayOdds === 'number' && typeof total.currentHomeOdds === 'number') {
        if (total.currentAwayOdds > 57) { // Over
          alerts.push({ 
            market: 'total', 
            side: 'away', 
            percentage: total.currentAwayOdds,
            team: 'Over'
          });
        }
        if (total.currentHomeOdds > 57) { // Under
          alerts.push({ 
            market: 'total', 
            side: 'home', 
            percentage: total.currentHomeOdds,
            team: 'Under'
          });
        }
      }
      
      // Check Moneyline (only highlight specific team if 85%+)
      if (moneyline && typeof moneyline.currentAwayOdds === 'number' && typeof moneyline.currentHomeOdds === 'number') {
        if (moneyline.currentAwayOdds >= 85) {
          alerts.push({ 
            market: 'moneyline', 
            side: 'away', 
            percentage: moneyline.currentAwayOdds,
            team: awayTeam
          });
        }
        if (moneyline.currentHomeOdds >= 85) {
          alerts.push({ 
            market: 'moneyline', 
            side: 'home', 
            percentage: moneyline.currentHomeOdds,
            team: homeTeam
          });
        }
      }
      
      return alerts;
    } catch (error) {
      console.error('Error calculating value alerts:', error);
      return [];
    }
  }, [allMarketsData, awayTeam, homeTeam]);

  const hasValueAlert = valueAlerts.length > 0 && !isGameStarted;
  
  // Check which markets have value (only if game hasn't started)
  const hasSpreadValue = useMemo(() => !isGameStarted && valueAlerts.some(alert => alert.market === 'spread'), [isGameStarted, valueAlerts]);
  const hasTotalValue = useMemo(() => !isGameStarted && valueAlerts.some(alert => alert.market === 'total'), [isGameStarted, valueAlerts]);
  const hasMoneylineValue = useMemo(() => !isGameStarted && valueAlerts.some(alert => alert.market === 'moneyline'), [isGameStarted, valueAlerts]);
  
  // For Spread/O/U: Don't highlight specific teams (line mismatch affects both sides)
  // For ML: Only highlight if current market is ML and team is 85%+
  const hasAwayValue = useMemo(() => 
    !isGameStarted && selectedMarket === 'moneyline' && valueAlerts.some(alert => 
      alert.market === 'moneyline' && alert.side === 'away'
    ), 
    [isGameStarted, selectedMarket, valueAlerts]
  );
  const hasHomeValue = useMemo(() => 
    !isGameStarted && selectedMarket === 'moneyline' && valueAlerts.some(alert => 
      alert.market === 'moneyline' && alert.side === 'home'
    ), 
    [isGameStarted, selectedMarket, valueAlerts]
  );

  // Check which markets are available
  const availableMarkets: MarketType[] = [];
  if (allMarketsData?.moneyline) availableMarkets.push('moneyline');
  if (allMarketsData?.spread) availableMarkets.push('spread');
  if (allMarketsData?.total) availableMarkets.push('total');

  // Auto-select first available market if current selection isn't available
  useEffect(() => {
    if (availableMarkets.length > 0 && !availableMarkets.includes(selectedMarket)) {
      setSelectedMarket(availableMarkets[0]);
    }
  }, [availableMarkets]);

  // Transform data for chart - combined data with both y values
  const chartData = filteredData.map((point, index) => ({
    x: index,
    y: point.awayTeamOdds,
    y2: point.homeTeamOdds,
  }));

  // Animation values for glow effects on odds cards - MUST be before any early returns
  const awayGlowAnimation = useSharedValue(0);
  const homeGlowAnimation = useSharedValue(0);
  const badgeAnimation = useSharedValue(0);

  // Start animations when value is detected
  useEffect(() => {
    if (hasAwayValue) {
      awayGlowAnimation.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      awayGlowAnimation.value = withTiming(0, { duration: 200 });
    }
  }, [hasAwayValue]);

  useEffect(() => {
    if (hasHomeValue) {
      homeGlowAnimation.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      homeGlowAnimation.value = withTiming(0, { duration: 200 });
    }
  }, [hasHomeValue]);

  useEffect(() => {
    if (hasValueAlert) {
      badgeAnimation.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      badgeAnimation.value = withTiming(0, { duration: 200 });
    }
  }, [hasValueAlert]);

  // Animated styles for glow effects on odds cards
  const awayGlowStyle = useAnimatedStyle(() => {
    if (!hasAwayValue) return {};
    
    const opacity = interpolate(awayGlowAnimation.value, [0, 1], [0.4, 0.8]);
    const shadowRadius = interpolate(awayGlowAnimation.value, [0, 1], [10, 20]);
    
    return {
      shadowColor: HONEYDEW_COLOR,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: opacity,
      shadowRadius: shadowRadius,
      elevation: shadowRadius, // Android shadow
    };
  });

  const homeGlowStyle = useAnimatedStyle(() => {
    if (!hasHomeValue) return {};
    
    const opacity = interpolate(homeGlowAnimation.value, [0, 1], [0.4, 0.8]);
    const shadowRadius = interpolate(homeGlowAnimation.value, [0, 1], [10, 20]);
    
    return {
      shadowColor: HONEYDEW_COLOR,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: opacity,
      shadowRadius: shadowRadius,
      elevation: shadowRadius, // Android shadow
    };
  });

  const badgePulseStyle = useAnimatedStyle(() => {
    if (!hasValueAlert) return {};
    
    const opacity = interpolate(badgeAnimation.value, [0, 1], [0.7, 1]);
    
    return {
      opacity,
    };
  });

  // Calculate percentage changes
  const firstPoint = filteredData[0];
  const lastPoint = filteredData[filteredData.length - 1];
  const awayChange = lastPoint ? lastPoint.awayTeamOdds - firstPoint.awayTeamOdds : 0;
  const homeChange = lastPoint ? lastPoint.homeTeamOdds - firstPoint.homeTeamOdds : 0;

  const awayColor = adjustColorForDarkMode(awayTeamColors?.primary, isDark);
  const homeColor = adjustColorForDarkMode(homeTeamColors?.primary, isDark);

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: hexToRgba(theme.colors.surface, 0.5), borderColor: theme.colors.outline }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            Loading betting data...
          </Text>
        </View>
      </View>
    );
  }

  // Error or no data state
  if (!allMarketsData || error || availableMarkets.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: hexToRgba(theme.colors.surface, 0.5), borderColor: theme.colors.outline }]}>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="chart-line-variant" size={32} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            Polymarket betting data unavailable for this game
          </Text>
        </View>
      </View>
    );
  }

  // No data for selected market
  if (!data || filteredData.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: hexToRgba(theme.colors.surface, 0.5), borderColor: theme.colors.outline }]}>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No data available for selected market
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: hexToRgba(theme.colors.surface, 0.5), borderColor: theme.colors.outline }]}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="chart-line-variant" size={20} color="#10b981" />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Public Betting Lines
        </Text>
        <View style={styles.headerBadges}>
          <View style={[styles.badge, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.badgeText, { color: theme.colors.onSurfaceVariant }]}>
              {filteredData.length} pts
            </Text>
          </View>
          {hasValueAlert && (
            <Animated.View style={badgePulseStyle}>
              <View style={[styles.valueAlertBadge, { backgroundColor: HONEYDEW_COLOR }]}>
                <Text style={styles.valueAlertText}>Value Alert!</Text>
              </View>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Market Type Selector */}
      <View style={styles.marketSelector}>
        <Pressable
          onPress={() => !allMarketsData.moneyline || setSelectedMarket('moneyline')}
          disabled={!allMarketsData.moneyline}
        >
          <View
            style={[
              styles.customChip,
              {
                backgroundColor: selectedMarket === 'moneyline'
                  ? theme.colors.primary
                  : 'transparent',
                borderColor: selectedMarket === 'moneyline'
                  ? theme.colors.primary
                  : theme.colors.outline,
              },
            ]}
          >
            {hasMoneylineValue && (
              <MaterialCommunityIcons name="alert-circle" size={14} color="#f97316" />
            )}
            <Text
              style={[
                styles.chipText,
                {
                  color: selectedMarket === 'moneyline'
                    ? '#fff'
                    : theme.colors.onSurfaceVariant,
                },
              ]}
            >
              ML
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => !allMarketsData.spread || setSelectedMarket('spread')}
          disabled={!allMarketsData.spread}
        >
          <View
            style={[
              styles.customChip,
              {
                backgroundColor: selectedMarket === 'spread'
                  ? theme.colors.primary
                  : 'transparent',
                borderColor: selectedMarket === 'spread'
                  ? theme.colors.primary
                  : theme.colors.outline,
              },
            ]}
          >
            {hasSpreadValue && (
              <MaterialCommunityIcons name="alert-circle" size={14} color="#f97316" />
            )}
            <Text
              style={[
                styles.chipText,
                {
                  color: selectedMarket === 'spread'
                    ? '#fff'
                    : theme.colors.onSurfaceVariant,
                },
              ]}
            >
              Spread
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => !allMarketsData.total || setSelectedMarket('total')}
          disabled={!allMarketsData.total}
        >
          <View
            style={[
              styles.customChip,
              {
                backgroundColor: selectedMarket === 'total'
                  ? theme.colors.primary
                  : 'transparent',
                borderColor: selectedMarket === 'total'
                  ? theme.colors.primary
                  : theme.colors.outline,
              },
            ]}
          >
            {hasTotalValue && (
              <MaterialCommunityIcons name="alert-circle" size={14} color="#f97316" />
            )}
            <Text
              style={[
                styles.chipText,
                {
                  color: selectedMarket === 'total'
                    ? '#fff'
                    : theme.colors.onSurfaceVariant,
                },
              ]}
            >
              O/U
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Current Odds */}
      <View style={styles.oddsRow}>
        <AnimatedOddsCard
          style={[
            styles.oddsCard,
            {
              backgroundColor: selectedMarket === 'total'
                ? hexToRgba(theme.colors.surfaceVariant, 0.3)
                : hexToRgba(awayColor, 0.15),
              borderColor: hasAwayValue
                ? HONEYDEW_COLOR
                : selectedMarket === 'total'
                ? theme.colors.outline
                : awayColor,
              borderWidth: hasAwayValue ? 2 : 1,
            },
            awayGlowStyle,
          ]}
        >
          <Text style={[styles.oddsLabel, { color: theme.colors.onSurfaceVariant }]}>
            {selectedMarket === 'total' ? 'Over' : awayTeam}
          </Text>
          <View style={styles.oddsValueRow}>
            <Text style={[styles.oddsValue, { color: theme.colors.onSurface }]}>
              {data.currentAwayOdds}%
            </Text>
            {awayChange !== 0 && (
              <View style={styles.changeContainer}>
                {awayChange > 0 ? (
                  <MaterialCommunityIcons name="trending-up" size={12} color="#22c55e" />
                ) : (
                  <MaterialCommunityIcons name="trending-down" size={12} color="#ef4444" />
                )}
                <Text style={[styles.changeText, { color: awayChange > 0 ? '#22c55e' : '#ef4444' }]}>
                  {awayChange > 0 ? '+' : ''}{awayChange}%
                </Text>
              </View>
            )}
          </View>
        </AnimatedOddsCard>

        <AnimatedOddsCard
          style={[
            styles.oddsCard,
            {
              backgroundColor: selectedMarket === 'total'
                ? hexToRgba(theme.colors.surfaceVariant, 0.3)
                : hexToRgba(homeColor, 0.15),
              borderColor: hasHomeValue
                ? HONEYDEW_COLOR
                : selectedMarket === 'total'
                ? theme.colors.outline
                : homeColor,
              borderWidth: hasHomeValue ? 2 : 1,
            },
            homeGlowStyle,
          ]}
        >
          <Text style={[styles.oddsLabel, { color: theme.colors.onSurfaceVariant }]}>
            {selectedMarket === 'total' ? 'Under' : homeTeam}
          </Text>
          <View style={styles.oddsValueRow}>
            <Text style={[styles.oddsValue, { color: theme.colors.onSurface }]}>
              {data.currentHomeOdds}%
            </Text>
            {homeChange !== 0 && (
              <View style={styles.changeContainer}>
                {homeChange > 0 ? (
                  <MaterialCommunityIcons name="trending-up" size={12} color="#22c55e" />
                ) : (
                  <MaterialCommunityIcons name="trending-down" size={12} color="#ef4444" />
                )}
                <Text style={[styles.changeText, { color: homeChange > 0 ? '#22c55e' : '#ef4444' }]}>
                  {homeChange > 0 ? '+' : ''}{homeChange}%
                </Text>
              </View>
            )}
          </View>
        </AnimatedOddsCard>
      </View>

      {/* Chart */}
      {chartData.length > 0 && (
        <View style={styles.chartContainer}>
          <View style={{ height: 180 }}>
            <CartesianChart
              data={chartData}
              xKey="x"
              yKeys={["y", "y2"]}
              axisOptions={{
                font: undefined,
                lineColor: theme.colors.outline,
                labelColor: theme.colors.onSurfaceVariant,
                formatXLabel: (value) => {
                  const index = Math.round(value);
                  if (index === 0) return 'Start';
                  if (index === chartData.length - 1) return 'Now';
                  return '';
                },
                formatYLabel: (value) => `${Math.round(value)}%`,
              }}
            >
              {({ points }) => (
                <>
                  <Line
                    points={points.y}
                    color={selectedMarket === 'total' ? '#22c55e' : awayColor}
                    strokeWidth={2}
                    animate={{ type: "timing", duration: 300 }}
                  />
                  <Line
                    points={points.y2}
                    color={selectedMarket === 'total' ? '#ef4444' : homeColor}
                    strokeWidth={2}
                    animate={{ type: "timing", duration: 300 }}
                  />
                </>
              )}
            </CartesianChart>
          </View>
        </View>
      )}

      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        {(['1H', '6H', '1D', '1W', '1M', 'ALL'] as TimeRange[]).map((range) => (
          <Pressable
            key={range}
            onPress={() => setTimeRange(range)}
            style={[
              styles.timeRangeButton,
              {
                backgroundColor: timeRange === range
                  ? theme.colors.primary
                  : hexToRgba(theme.colors.surfaceVariant, 0.3),
                borderColor: timeRange === range
                  ? theme.colors.primary
                  : theme.colors.outline,
              }
            ]}
          >
            <Text
              style={[
                styles.timeRangeText,
                {
                  color: timeRange === range
                    ? '#fff'
                    : theme.colors.onSurfaceVariant,
                }
              ]}
            >
              {range}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={[styles.disclaimerText, { color: theme.colors.onSurfaceVariant }]}>
          Powered by Polymarket. We are not affiliated with or endorsed by Polymarket.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  valueAlertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  valueAlertText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  marketSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    justifyContent: 'center',
  },
  chip: {
    marginHorizontal: 0,
  },
  customChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 32,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  oddsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  oddsCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  oddsLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  oddsValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  oddsValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chartContainer: {
    marginVertical: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  timeRangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 45,
    alignItems: 'center',
  },
  timeRangeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  disclaimer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  disclaimerText: {
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 12,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
});

