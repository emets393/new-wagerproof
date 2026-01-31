import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CartesianChart, Line } from 'victory-native';
import { Rect } from '@shopify/react-native-skia';
import { useThemeContext } from '@/contexts/ThemeContext';
import { supabase } from '@/services/supabase';
import { EditorPick } from '@/types/editorsPicks';
import { calculateUnits, calculateTotalUnits } from '@/utils/unitsCalculation';

const { width: screenWidth } = Dimensions.get('window');

type Sport = 'all' | 'nfl' | 'cfb' | 'nba' | 'ncaab';
type DateFilter = 'best_run' | '7d' | '30d' | '90d' | 'all_time';

const DATE_FILTERS: { id: DateFilter; label: string; icon: string }[] = [
  { id: 'best_run', label: 'Best Run', icon: 'chart-timeline-variant-shimmer' },
  { id: '7d', label: '7 Days', icon: 'calendar-week' },
  { id: '30d', label: '30 Days', icon: 'calendar-month' },
  { id: '90d', label: '90 Days', icon: 'calendar-range' },
  { id: 'all_time', label: 'All Time', icon: 'calendar-star' },
];

interface SportStats {
  sport: Sport;
  label: string;
  won: number;
  lost: number;
  push: number;
  netUnits: number;
  winRate: number;
  picks: EditorPick[];
  chartData: { x: number; y: number; isBestRun?: boolean }[];
  bestRunIndices: { start: number; end: number } | null;
  bestRun: BestRun | null;
}

interface BestRun {
  startIndex: number;
  endIndex: number;
  wins: number;
  losses: number;
  netUnits: number;
  lowPoint: number;
  highPoint: number;
  picks: EditorPick[];
}

export default function EditorPicksStatsScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [allPicks, setAllPicks] = useState<EditorPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('best_run');

  // Fetch all picks
  useEffect(() => {
    const fetchPicks = async () => {
      try {
        const { data, error } = await supabase
          .from('editors_picks')
          .select('*')
          .eq('is_published', true)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setAllPicks(data || []);
      } catch (err) {
        console.error('Error fetching picks:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPicks();
  }, []);

  // Helper to calculate best run for a set of picks
  // This finds the period from lowest low to highest high (maximum gain period)
  const calculateBestRun = (picks: EditorPick[]): { bestRun: BestRun | null; bestRunIndices: { start: number; end: number } | null } => {
    const sortedPicks = [...picks]
      .filter(p => p.result && p.result !== 'pending')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (sortedPicks.length === 0) return { bestRun: null, bestRunIndices: null };

    // Calculate cumulative units at each point
    const cumulativeUnits: number[] = [0]; // Start at 0
    let running = 0;
    
    sortedPicks.forEach(pick => {
      const calc = calculateUnits(pick.result, pick.best_price, pick.units);
      running += calc.netUnits;
      cumulativeUnits.push(running);
    });

    // Find the maximum gain period (lowest point to highest point after it)
    let bestGain = 0;
    let bestStartIdx = 0;
    let bestEndIdx = 0;
    let minValue = cumulativeUnits[0];
    let minIdx = 0;

    for (let i = 1; i < cumulativeUnits.length; i++) {
      // Update minimum if we find a new low
      if (cumulativeUnits[i] < minValue) {
        minValue = cumulativeUnits[i];
        minIdx = i;
      }
      
      // Check if current point gives us a better gain from the lowest point
      const currentGain = cumulativeUnits[i] - minValue;
      if (currentGain > bestGain) {
        bestGain = currentGain;
        bestStartIdx = minIdx;
        bestEndIdx = i;
      }
    }

    // If no positive gain found, return null
    if (bestGain <= 0) return { bestRun: null, bestRunIndices: null };

    // Get the picks in the best run period (indices are offset by 1 due to starting at 0)
    const runPicks = sortedPicks.slice(bestStartIdx, bestEndIdx);
    const wins = runPicks.filter(p => p.result === 'won').length;
    const losses = runPicks.filter(p => p.result === 'lost').length;

    const bestRun: BestRun = {
      startIndex: bestStartIdx,
      endIndex: bestEndIdx - 1, // Adjust for 0-based pick index
      wins,
      losses,
      netUnits: bestGain,
      lowPoint: minValue,
      highPoint: cumulativeUnits[bestEndIdx],
      picks: runPicks,
    };

    return {
      bestRun,
      bestRunIndices: { start: bestStartIdx, end: bestEndIdx }
    };
  };

  // Helper to filter picks by date range
  const getFilteredPicks = useMemo(() => {
    if (dateFilter === 'all_time') {
      return allPicks;
    }

    if (dateFilter === 'best_run') {
      // For best run, we'll show the picks in the best run period
      const { bestRun } = calculateBestRun(allPicks);
      return bestRun ? bestRun.picks : allPicks;
    }

    const now = new Date();
    let cutoffDate: Date;

    switch (dateFilter) {
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        return allPicks;
    }

    return allPicks.filter(pick => new Date(pick.created_at) >= cutoffDate);
  }, [allPicks, dateFilter]);

  // Calculate stats for each sport (using filtered picks)
  const sportStats = useMemo((): SportStats[] => {
    const sports: { sport: Sport; label: string }[] = [
      { sport: 'all', label: 'All Sports' },
      { sport: 'nba', label: 'NBA' },
      { sport: 'ncaab', label: 'NCAAB' },
      { sport: 'nfl', label: 'NFL' },
      { sport: 'cfb', label: 'CFB' },
    ];

    return sports.map(({ sport, label }) => {
      const picks = sport === 'all'
        ? getFilteredPicks
        : getFilteredPicks.filter(p => p.game_type === sport);

      const won = picks.filter(p => p.result === 'won').length;
      const lost = picks.filter(p => p.result === 'lost').length;
      const push = picks.filter(p => p.result === 'push').length;
      const total = won + lost + push;
      const winRate = total > 0 ? (won / total) * 100 : 0;
      const totalUnits = calculateTotalUnits(picks);

      // Calculate chart data
      const sortedPicks = [...picks].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      let cumulative = 0;
      const chartData: { x: number; y: number; isBestRun?: boolean }[] = [{ x: 0, y: 0 }];

      sortedPicks.forEach((pick, index) => {
        if (pick.result && pick.result !== 'pending') {
          const calc = calculateUnits(pick.result, pick.best_price, pick.units);
          cumulative += calc.netUnits;
        }
        chartData.push({ x: index + 1, y: cumulative });
      });

      // Calculate best run indices
      const { bestRunIndices, bestRun } = calculateBestRun(picks);

      // Mark best run points in chart data
      if (bestRunIndices) {
        for (let i = bestRunIndices.start; i <= bestRunIndices.end; i++) {
          if (chartData[i]) {
            chartData[i].isBestRun = true;
          }
        }
      }

      return {
        sport,
        label,
        won,
        lost,
        push,
        netUnits: totalUnits.netUnits,
        winRate,
        picks,
        chartData,
        bestRunIndices,
        bestRun,
      };
    });
  }, [getFilteredPicks]);

  // Get overall stats (all sports)
  const overallStats = sportStats.find(s => s.sport === 'all') || sportStats[0];

  // Get individual sport stats (excluding 'all')
  const individualSportStats = sportStats.filter(s => s.sport !== 'all');

  // Calculate overall best run (for filtered data)
  const overallBestRun = useMemo(() => {
    const { bestRun } = calculateBestRun(getFilteredPicks);
    return bestRun;
  }, [getFilteredPicks]);

  // Get the date range label for display
  const getDateRangeLabel = () => {
    const filter = DATE_FILTERS.find(f => f.id === dateFilter);
    return filter?.label || 'All Time';
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Editor's Picks Stats</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Editor Card */}
        <LinearGradient
          colors={isDark
            ? ['rgba(30, 64, 175, 0.3)', 'rgba(30, 64, 175, 0.1)']
            : ['rgba(239, 246, 255, 1)', 'rgba(219, 234, 254, 1)']}
          style={[styles.editorCard, { borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(191, 219, 254, 1)' }]}
        >
          <View style={[styles.avatarContainer, { borderColor: isDark ? '#3b82f6' : '#2563eb' }]}>
            <Image
              source={require('@/assets/editor-avatar.png')}
              style={styles.avatar}
              resizeMode="cover"
            />
          </View>
          <View style={styles.editorInfo}>
            <Text style={[styles.editorName, { color: theme.colors.onSurface }]}>WagerProof Editor</Text>
            <Text style={[styles.editorSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {allPicks.length} Total Picks
            </Text>
          </View>
        </LinearGradient>

        {/* Transparency Description */}
        <View style={[styles.transparencyCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
          <View style={styles.transparencyHeader}>
            <MaterialCommunityIcons name="shield-check" size={20} color="#00E676" />
            <Text style={[styles.transparencyTitle, { color: theme.colors.onSurface }]}>
              Full Transparency
            </Text>
          </View>
          <Text style={[styles.transparencyText, { color: theme.colors.onSurfaceVariant }]}>
            This page is dedicated to providing complete transparency. Unlike other apps, we want to show users everything that we do — the wins, the losses, and everything in between.
          </Text>
          <Text style={[styles.transparencyText, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
            WagerProof was designed in Columbus, Ohio and Austin, Texas by two childhood friends who share a passion for sports and technology. We built this for bettors like us who value honesty and data-driven insights.
          </Text>
        </View>

        {/* Overall Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
            <Text style={[styles.statCardLabel, { color: theme.colors.onSurfaceVariant }]}>Record</Text>
            <Text style={[styles.statCardValue, { color: theme.colors.onSurface }]}>
              {overallStats.won}-{overallStats.lost}{overallStats.push > 0 ? `-${overallStats.push}` : ''}
            </Text>
            <Text style={[styles.statCardSubtext, { color: isDark ? '#93c5fd' : '#2563eb' }]}>
              {overallStats.winRate.toFixed(1)}% Win Rate
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
            <Text style={[styles.statCardLabel, { color: theme.colors.onSurfaceVariant }]}>Net Units</Text>
            <Text style={[
              styles.statCardValue,
              { color: overallStats.netUnits >= 0 ? '#22c55e' : '#ef4444' }
            ]}>
              {overallStats.netUnits >= 0 ? '+' : ''}{overallStats.netUnits.toFixed(2)}
            </Text>
            <Text style={[styles.statCardSubtext, { color: theme.colors.onSurfaceVariant }]}>
              Units P/L
            </Text>
          </View>
        </View>

        {/* Date Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateFilterScroll}
          contentContainerStyle={styles.dateFilterContainer}
        >
          {DATE_FILTERS.map(filter => {
            const isActive = dateFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.dateFilterPill,
                  { 
                    backgroundColor: isActive 
                      ? (isDark ? 'rgba(0, 230, 118, 0.2)' : 'rgba(0, 230, 118, 0.15)')
                      : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                    borderColor: isActive ? '#00E676' : 'transparent',
                  }
                ]}
                onPress={() => setDateFilter(filter.id)}
              >
                <MaterialCommunityIcons 
                  name={filter.icon as any} 
                  size={14} 
                  color={isActive ? '#00E676' : theme.colors.onSurfaceVariant} 
                />
                <Text style={[
                  styles.dateFilterText,
                  { color: isActive ? '#00E676' : theme.colors.onSurfaceVariant }
                ]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Filter Context Label */}
        <Text style={[styles.filterContextLabel, { color: theme.colors.onSurfaceVariant }]}>
          Showing: {getDateRangeLabel()} ({getFilteredPicks.length} picks)
        </Text>

        {/* Best Run Card - Lowest Low to Highest High */}
        {overallBestRun && overallBestRun.netUnits > 0 && (
          <LinearGradient
            colors={isDark
              ? ['rgba(34, 197, 94, 0.2)', 'rgba(34, 197, 94, 0.1)']
              : ['rgba(220, 252, 231, 1)', 'rgba(187, 247, 208, 1)']}
            style={[styles.bestRunCard, { borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : '#86efac' }]}
          >
            <View style={styles.bestRunHeader}>
              <MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={24} color="#22c55e" />
              <Text style={[styles.bestRunTitle, { color: isDark ? '#86efac' : '#166534' }]}>
                Best Run (Low to High)
              </Text>
            </View>
            <Text style={[styles.bestRunSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              From lowest point to peak performance
            </Text>
            <View style={styles.bestRunStats}>
              <View style={styles.bestRunStat}>
                <Text style={[styles.bestRunStatValue, { color: '#22c55e' }]}>
                  +{overallBestRun.netUnits.toFixed(2)}
                </Text>
                <Text style={[styles.bestRunStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Units Gained
                </Text>
              </View>
              <View style={[styles.bestRunDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]} />
              <View style={styles.bestRunStat}>
                <Text style={[styles.bestRunStatValue, { color: theme.colors.onSurface }]}>
                  {overallBestRun.wins}-{overallBestRun.losses}
                </Text>
                <Text style={[styles.bestRunStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Record
                </Text>
              </View>
              <View style={[styles.bestRunDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]} />
              <View style={styles.bestRunStat}>
                <Text style={[styles.bestRunStatValue, { color: theme.colors.onSurface }]}>
                  {overallBestRun.picks.length}
                </Text>
                <Text style={[styles.bestRunStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Picks
                </Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* Overall Cumulative Units Chart */}
        <View style={[styles.chartCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
          <View style={styles.chartTitleRow}>
            <Text style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
              All Sports - Cumulative Units
            </Text>
            {overallStats.bestRunIndices && (
              <View style={[styles.chartLegend, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
                <MaterialCommunityIcons name="fire" size={12} color="#22c55e" />
                <Text style={styles.chartLegendText}>Best Run</Text>
              </View>
            )}
          </View>
          {overallStats.chartData.length > 1 ? (
            <View style={styles.chartContainer}>
              <CartesianChart
                data={overallStats.chartData}
                xKey="x"
                yKeys={["y"]}
                axisOptions={{
                  font: undefined,
                  lineColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                  labelColor: theme.colors.onSurfaceVariant,
                  formatXLabel: (value: number) => {
                    if (value === 0) return 'Start';
                    if (value === overallStats.chartData.length - 1) return 'Now';
                    return '';
                  },
                  formatYLabel: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`,
                }}
              >
                {({ points, chartBounds }) => {
                  const bestRunIndices = overallStats.bestRunIndices;
                  return (
                    <>
                      {/* Best Run Highlight Area */}
                      {bestRunIndices && points.y.length > bestRunIndices.end && (
                        <Rect
                          x={points.y[bestRunIndices.start]?.x ?? 0}
                          y={chartBounds.top}
                          width={(points.y[bestRunIndices.end]?.x ?? 0) - (points.y[bestRunIndices.start]?.x ?? 0)}
                          height={chartBounds.bottom - chartBounds.top}
                          color="rgba(34, 197, 94, 0.15)"
                        />
                      )}
                      {/* Main Line */}
                      <Line
                        points={points.y}
                        color={overallStats.netUnits >= 0 ? '#22c55e' : '#ef4444'}
                        strokeWidth={2}
                        curveType="monotoneX"
                      />
                    </>
                  );
                }}
              </CartesianChart>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialCommunityIcons name="chart-line" size={40} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.noDataText, { color: theme.colors.onSurfaceVariant }]}>
                No data available
              </Text>
            </View>
          )}
        </View>

        {/* Individual Sport Charts */}
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Performance by Sport
        </Text>
        {individualSportStats.map(stat => (
          <View
            key={stat.sport}
            style={[styles.sportChartCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
          >
            {/* Sport Header */}
            <View style={styles.sportChartHeader}>
              <Text style={[styles.sportChartLabel, { color: theme.colors.onSurface }]}>
                {stat.label}
              </Text>
              <View style={styles.sportChartStats}>
                <Text style={[styles.sportChartRecord, { color: theme.colors.onSurfaceVariant }]}>
                  {stat.won}-{stat.lost}{stat.push > 0 ? `-${stat.push}` : ''}
                </Text>
                <Text style={[
                  styles.sportChartUnits,
                  { color: stat.netUnits >= 0 ? '#22c55e' : '#ef4444' }
                ]}>
                  {stat.netUnits >= 0 ? '+' : ''}{stat.netUnits.toFixed(2)}u
                </Text>
              </View>
            </View>

            {/* Best Run Badge for this sport */}
            {stat.bestRun && stat.bestRun.netUnits > 0 && (
              <View style={[styles.sportBestRunBadge, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)' }]}>
                <MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={14} color="#22c55e" />
                <Text style={styles.sportBestRunText}>
                  Best Run: <Text style={{ fontWeight: '700' }}>+{stat.bestRun.netUnits.toFixed(2)}u</Text> ({stat.bestRun.wins}-{stat.bestRun.losses})
                </Text>
              </View>
            )}

            {/* Sport Chart */}
            {stat.chartData.length > 1 ? (
              <View style={styles.sportChartContainer}>
                <CartesianChart
                  data={stat.chartData}
                  xKey="x"
                  yKeys={["y"]}
                  axisOptions={{
                    font: undefined,
                    lineColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
                    labelColor: theme.colors.onSurfaceVariant,
                    formatXLabel: () => '',
                    formatYLabel: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(0)}`,
                  }}
                >
                  {({ points, chartBounds }) => {
                    const bestRunIndices = stat.bestRunIndices;
                    return (
                      <>
                        {/* Best Run Highlight Area */}
                        {bestRunIndices && points.y.length > bestRunIndices.end && (
                          <Rect
                            x={points.y[bestRunIndices.start]?.x ?? 0}
                            y={chartBounds.top}
                            width={(points.y[bestRunIndices.end]?.x ?? 0) - (points.y[bestRunIndices.start]?.x ?? 0)}
                            height={chartBounds.bottom - chartBounds.top}
                            color="rgba(34, 197, 94, 0.2)"
                          />
                        )}
                        {/* Main Line */}
                        <Line
                          points={points.y}
                          color={stat.netUnits >= 0 ? '#22c55e' : '#ef4444'}
                          strokeWidth={2}
                          curveType="monotoneX"
                        />
                      </>
                    );
                  }}
                </CartesianChart>
              </View>
            ) : (
              <View style={styles.noDataContainerSmall}>
                <Text style={[styles.noDataTextSmall, { color: theme.colors.onSurfaceVariant }]}>
                  No picks yet
                </Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  editorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 14,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  editorInfo: {
    flex: 1,
  },
  editorName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  editorSubtitle: {
    fontSize: 14,
  },
  transparencyCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  transparencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  transparencyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  transparencyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  statCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statCardValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  statCardSubtext: {
    fontSize: 12,
    fontWeight: '500',
  },
  dateFilterScroll: {
    marginBottom: 8,
    marginHorizontal: -16,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  dateFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  dateFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterContextLabel: {
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  bestRunCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  bestRunHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  bestRunTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  bestRunSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  bestRunStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bestRunStat: {
    alignItems: 'center',
  },
  bestRunStatValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  bestRunStatLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  bestRunDivider: {
    width: 1,
    height: '100%',
  },
  chartCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  chartTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chartLegendText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#22c55e',
  },
  chartContainer: {
    height: 200,
    marginTop: 8,
  },
  noDataContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  noDataText: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  sportChartCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  sportChartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sportChartLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  sportChartStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sportChartRecord: {
    fontSize: 14,
    fontWeight: '600',
  },
  sportChartUnits: {
    fontSize: 16,
    fontWeight: '800',
  },
  sportBestRunBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  sportBestRunText: {
    fontSize: 12,
    color: '#22c55e',
  },
  sportChartContainer: {
    height: 120,
  },
  noDataContainerSmall: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataTextSmall: {
    fontSize: 12,
  },
});
