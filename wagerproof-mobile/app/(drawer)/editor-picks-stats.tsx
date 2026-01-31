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
}

interface BestRun {
  startIndex: number;
  endIndex: number;
  wins: number;
  losses: number;
  netUnits: number;
  maxUnits: number;
  picks: EditorPick[];
}

export default function EditorPicksStatsScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [allPicks, setAllPicks] = useState<EditorPick[]>([]);
  const [loading, setLoading] = useState(true);

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
  const calculateBestRun = (picks: EditorPick[]): { bestRun: BestRun | null; bestRunIndices: { start: number; end: number } | null } => {
    const sortedPicks = [...picks]
      .filter(p => p.result && p.result !== 'pending')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (sortedPicks.length === 0) return { bestRun: null, bestRunIndices: null };

    let bestRun: BestRun | null = null;
    let currentRunStart = 0;
    let currentWins = 0;
    let runningUnits = 0;
    let maxUnitsInRun = 0;
    let currentPicks: EditorPick[] = [];

    for (let i = 0; i < sortedPicks.length; i++) {
      const pick = sortedPicks[i];
      const calc = calculateUnits(pick.result, pick.best_price, pick.units);

      if (pick.result === 'won') {
        currentWins++;
        currentPicks.push(pick);
        runningUnits += calc.netUnits;
        maxUnitsInRun = Math.max(maxUnitsInRun, runningUnits);

        if (!bestRun || currentWins > bestRun.wins ||
            (currentWins === bestRun.wins && runningUnits > bestRun.netUnits)) {
          bestRun = {
            startIndex: currentRunStart,
            endIndex: i,
            wins: currentWins,
            losses: 0,
            netUnits: runningUnits,
            maxUnits: maxUnitsInRun,
            picks: [...currentPicks],
          };
        }
      } else if (pick.result === 'lost') {
        currentRunStart = i + 1;
        currentWins = 0;
        runningUnits = 0;
        maxUnitsInRun = 0;
        currentPicks = [];
      }
    }

    return {
      bestRun,
      bestRunIndices: bestRun ? { start: bestRun.startIndex, end: bestRun.endIndex } : null
    };
  };

  // Calculate stats for each sport
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
        ? allPicks
        : allPicks.filter(p => p.game_type === sport);

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
      const { bestRunIndices } = calculateBestRun(picks);

      // Mark best run points in chart data
      if (bestRunIndices) {
        for (let i = bestRunIndices.start + 1; i <= bestRunIndices.end + 1; i++) {
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
      };
    });
  }, [allPicks]);

  // Get overall stats (all sports)
  const overallStats = sportStats.find(s => s.sport === 'all') || sportStats[0];

  // Get individual sport stats (excluding 'all')
  const individualSportStats = sportStats.filter(s => s.sport !== 'all');

  // Calculate overall best run
  const overallBestRun = useMemo(() => {
    const { bestRun } = calculateBestRun(allPicks);
    return bestRun;
  }, [allPicks]);

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

        {/* Best Recent Run Card */}
        {overallBestRun && overallBestRun.wins > 0 && (
          <LinearGradient
            colors={isDark
              ? ['rgba(34, 197, 94, 0.2)', 'rgba(34, 197, 94, 0.1)']
              : ['rgba(220, 252, 231, 1)', 'rgba(187, 247, 208, 1)']}
            style={[styles.bestRunCard, { borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : '#86efac' }]}
          >
            <View style={styles.bestRunHeader}>
              <MaterialCommunityIcons name="fire" size={24} color="#22c55e" />
              <Text style={[styles.bestRunTitle, { color: isDark ? '#86efac' : '#166534' }]}>
                Best Recent Run
              </Text>
            </View>
            <View style={styles.bestRunStats}>
              <View style={styles.bestRunStat}>
                <Text style={[styles.bestRunStatValue, { color: theme.colors.onSurface }]}>
                  {overallBestRun.wins}
                </Text>
                <Text style={[styles.bestRunStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Wins
                </Text>
              </View>
              <View style={[styles.bestRunDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]} />
              <View style={styles.bestRunStat}>
                <Text style={[styles.bestRunStatValue, { color: '#22c55e' }]}>
                  +{overallBestRun.netUnits.toFixed(2)}
                </Text>
                <Text style={[styles.bestRunStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Units Won
                </Text>
              </View>
              <View style={[styles.bestRunDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]} />
              <View style={styles.bestRunStat}>
                <Text style={[styles.bestRunStatValue, { color: theme.colors.onSurface }]}>
                  {overallBestRun.maxUnits.toFixed(2)}
                </Text>
                <Text style={[styles.bestRunStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Max Units
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
                      {bestRunIndices && points.y.length > bestRunIndices.end + 1 && (
                        <Rect
                          x={points.y[bestRunIndices.start + 1]?.x ?? 0}
                          y={chartBounds.top}
                          width={(points.y[bestRunIndices.end + 1]?.x ?? 0) - (points.y[bestRunIndices.start + 1]?.x ?? 0)}
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
                        {bestRunIndices && points.y.length > bestRunIndices.end + 1 && (
                          <Rect
                            x={points.y[bestRunIndices.start + 1]?.x ?? 0}
                            y={chartBounds.top}
                            width={(points.y[bestRunIndices.end + 1]?.x ?? 0) - (points.y[bestRunIndices.start + 1]?.x ?? 0)}
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
