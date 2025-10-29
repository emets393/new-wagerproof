import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useTheme, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CartesianChart, Line } from 'victory-native';
import { useQuery } from '@tanstack/react-query';
import { getAllMarketsData } from '@/services/polymarketService';
import { MarketType, TimeRange } from '@/types/polymarket';

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

  // Calculate percentage changes
  const firstPoint = filteredData[0];
  const lastPoint = filteredData[filteredData.length - 1];
  const awayChange = lastPoint ? lastPoint.awayTeamOdds - firstPoint.awayTeamOdds : 0;
  const homeChange = lastPoint ? lastPoint.homeTeamOdds - firstPoint.homeTeamOdds : 0;

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

  const awayColor = adjustColorForDarkMode(awayTeamColors?.primary, isDark);
  const homeColor = adjustColorForDarkMode(homeTeamColors?.primary, isDark);

  return (
    <View style={[styles.container, { backgroundColor: hexToRgba(theme.colors.surface, 0.5), borderColor: theme.colors.outline }]}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="chart-line-variant" size={20} color="#10b981" />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Public Betting Lines
        </Text>
        <View style={[styles.badge, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[styles.badgeText, { color: theme.colors.onSurfaceVariant }]}>
            {filteredData.length} pts
          </Text>
        </View>
      </View>

      {/* Market Type Selector */}
      <View style={styles.marketSelector}>
        <Chip
          selected={selectedMarket === 'moneyline'}
          onPress={() => setSelectedMarket('moneyline')}
          disabled={!allMarketsData.moneyline}
          style={styles.chip}
          selectedColor={theme.colors.primary}
        >
          ML
        </Chip>
        <Chip
          selected={selectedMarket === 'spread'}
          onPress={() => setSelectedMarket('spread')}
          disabled={!allMarketsData.spread}
          style={styles.chip}
          selectedColor={theme.colors.primary}
        >
          Spread
        </Chip>
        <Chip
          selected={selectedMarket === 'total'}
          onPress={() => setSelectedMarket('total')}
          disabled={!allMarketsData.total}
          style={styles.chip}
          selectedColor={theme.colors.primary}
        >
          O/U
        </Chip>
      </View>

      {/* Current Odds */}
      <View style={styles.oddsRow}>
        <View
          style={[
            styles.oddsCard,
            {
              backgroundColor: selectedMarket === 'total'
                ? hexToRgba(theme.colors.surfaceVariant, 0.3)
                : hexToRgba(awayColor, 0.15),
              borderColor: selectedMarket === 'total'
                ? theme.colors.outline
                : awayColor,
            }
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
        </View>

        <View
          style={[
            styles.oddsCard,
            {
              backgroundColor: selectedMarket === 'total'
                ? hexToRgba(theme.colors.surfaceVariant, 0.3)
                : hexToRgba(homeColor, 0.15),
              borderColor: selectedMarket === 'total'
                ? theme.colors.outline
                : homeColor,
            }
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
        </View>
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
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
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

