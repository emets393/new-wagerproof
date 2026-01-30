import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { NBAGameTrends } from '@/types/nba';
import { getNBATeamColors, getNBATeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { useThemeContext } from '@/contexts/ThemeContext';

interface RecentTrendsWidgetProps {
  awayTeam: string;
  homeTeam: string;
  trends: NBAGameTrends | null;
  isLoading: boolean;
}

interface TrendMetric {
  name: string;
  awayValue: number | null;
  homeValue: number;
  format: (val: number | null) => string;
  /** If true, lower is better (e.g., defensive rating) */
  lowerIsBetter?: boolean;
  /** If true, don't apply color coding */
  noColor?: boolean;
}

/**
 * Get color for trend values based on comparison
 */
function getTrendColor(
  awayValue: number | null,
  homeValue: number | null,
  isAway: boolean,
  lowerIsBetter: boolean = false,
  noColor: boolean = false
): string {
  if (noColor || awayValue === null || homeValue === null) {
    return 'inherit';
  }

  const myValue = isAway ? awayValue : homeValue;
  const otherValue = isAway ? homeValue : awayValue;

  if (lowerIsBetter) {
    // Lower is better (e.g., defensive rating)
    if (myValue < otherValue) return '#22c55e'; // green
    if (myValue > otherValue) return '#ef4444'; // red
  } else {
    // Higher is better (default)
    if (myValue > otherValue) return '#22c55e'; // green
    if (myValue < otherValue) return '#ef4444'; // red
  }

  return 'inherit';
}

/**
 * Format a decimal value with specified precision
 */
function formatDecimal(val: number | null, decimals: number = 2): string {
  if (val === null || val === undefined) return '-';
  return val.toFixed(decimals);
}

/**
 * Format a percentage value (0-1 range to percentage)
 */
function formatPercent(val: number | null): string {
  if (val === null || val === undefined) return '-';
  return `${(val * 100).toFixed(1)}%`;
}

/**
 * Format an integer value
 */
function formatInt(val: number | null): string {
  if (val === null || val === undefined) return '-';
  return Math.round(val).toString();
}

export function RecentTrendsWidget({
  awayTeam,
  homeTeam,
  trends,
  isLoading,
}: RecentTrendsWidgetProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const [expanded, setExpanded] = useState(false);

  const awayColors = getNBATeamColors(awayTeam);
  const homeColors = getNBATeamColors(homeTeam);

  const handleToggleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(!expanded);
  };

  // Define the 10 metrics to display
  const metrics: TrendMetric[] = trends ? [
    {
      name: 'Overall Rating',
      awayValue: trends.away_ovr_rtg,
      homeValue: trends.home_ovr_rtg ?? 0,
      format: (val) => formatDecimal(val),
    },
    {
      name: 'Consistency Rating',
      awayValue: trends.away_consistency,
      homeValue: trends.home_consistency ?? 0,
      format: (val) => formatDecimal(val),
    },
    {
      name: 'Win Streak',
      awayValue: trends.away_win_streak,
      homeValue: trends.home_win_streak ?? 0,
      format: (val) => formatInt(val),
    },
    {
      name: 'ATS %',
      awayValue: trends.away_ats_pct,
      homeValue: trends.home_ats_pct ?? 0,
      format: (val) => formatPercent(val),
    },
    {
      name: 'ATS Streak',
      awayValue: trends.away_ats_streak,
      homeValue: trends.home_ats_streak ?? 0,
      format: (val) => formatInt(val),
    },
    {
      name: 'Last Game Score Margin',
      awayValue: trends.away_last_margin,
      homeValue: trends.home_last_margin ?? 0,
      format: (val) => formatDecimal(val, 1),
    },
    {
      name: 'Over/Under %',
      awayValue: trends.away_over_pct,
      homeValue: trends.home_over_pct ?? 0,
      format: (val) => formatPercent(val),
      noColor: true, // No color conditioning for O/U %
    },
    {
      name: 'Pace Trend (Last 3)',
      awayValue: trends.away_adj_pace_pregame_l3_trend,
      homeValue: trends.home_adj_pace_pregame_l3_trend ?? 0,
      format: (val) => formatDecimal(val),
    },
    {
      name: 'Off. Rating Trend (L3)',
      awayValue: trends.away_adj_off_rtg_pregame_l3_trend,
      homeValue: trends.home_adj_off_rtg_pregame_l3_trend ?? 0,
      format: (val) => formatDecimal(val),
    },
    {
      name: 'Def. Rating Trend (L3)',
      awayValue: trends.away_adj_def_rtg_pregame_l3_trend,
      homeValue: trends.home_adj_def_rtg_pregame_l3_trend ?? 0,
      format: (val) => formatDecimal(val),
      lowerIsBetter: true, // Lower defensive rating is better
    },
  ] : [];

  const renderMetricRow = (metric: TrendMetric, index: number) => {
    const awayColor = getTrendColor(
      metric.awayValue,
      metric.homeValue,
      true,
      metric.lowerIsBetter,
      metric.noColor
    );
    const homeColor = getTrendColor(
      metric.awayValue,
      metric.homeValue,
      false,
      metric.lowerIsBetter,
      metric.noColor
    );

    return (
      <View
        key={metric.name}
        style={[
          styles.metricRow,
          index % 2 === 0 && { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }
        ]}
      >
        <Text
          style={[
            styles.metricValue,
            { color: awayColor === 'inherit' ? theme.colors.onSurface : awayColor }
          ]}
        >
          {metric.format(metric.awayValue)}
        </Text>
        <Text style={[styles.metricName, { color: theme.colors.onSurfaceVariant }]}>
          {metric.name}
        </Text>
        <Text
          style={[
            styles.metricValue,
            { color: homeColor === 'inherit' ? theme.colors.onSurface : homeColor }
          ]}
        >
          {metric.format(metric.homeValue)}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
      {/* Header - Always visible, tappable */}
      <TouchableOpacity onPress={handleToggleExpand} activeOpacity={0.7}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="trending-up" size={20} color="#3b82f6" />
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Recent Trends</Text>
          </View>
          <View style={styles.headerRight}>
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}

      {/* Expanded Content */}
      {expanded && !isLoading && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 200 }}
        >
          {!trends ? (
            <View style={[styles.emptyContainer, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
              <MaterialCommunityIcons name="information-outline" size={32} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                No trend data available for this matchup
              </Text>
            </View>
          ) : (
            <View style={styles.content}>
              {/* Table Header with team initials */}
              <View style={[styles.tableHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                <View style={styles.teamHeaderCell}>
                  <LinearGradient
                    colors={[awayColors.primary, awayColors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.teamCircleSmall}
                  >
                    <Text style={[
                      styles.teamInitialsSmall,
                      { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) }
                    ]}>
                      {getNBATeamInitials(awayTeam)}
                    </Text>
                  </LinearGradient>
                </View>
                <Text style={[styles.headerMetricLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Metric
                </Text>
                <View style={styles.teamHeaderCell}>
                  <LinearGradient
                    colors={[homeColors.primary, homeColors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.teamCircleSmall}
                  >
                    <Text style={[
                      styles.teamInitialsSmall,
                      { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) }
                    ]}>
                      {getNBATeamInitials(homeTeam)}
                    </Text>
                  </LinearGradient>
                </View>
              </View>

              {/* Metrics Rows */}
              <View style={styles.metricsContainer}>
                {metrics.map((metric, index) => renderMetricRow(metric, index))}
              </View>
            </View>
          )}
        </MotiView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  teamHeaderCell: {
    width: 70,
    alignItems: 'center',
  },
  teamCircleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitialsSmall: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  headerMetricLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  metricsContainer: {
    gap: 0,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  metricValue: {
    width: 70,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  metricName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
