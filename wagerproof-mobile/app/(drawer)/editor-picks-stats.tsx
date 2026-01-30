import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CartesianChart, Line } from 'victory-native';
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
  const [selectedSport, setSelectedSport] = useState<Sport>('all');

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

      return {
        sport,
        label,
        won,
        lost,
        push,
        netUnits: totalUnits.netUnits,
        winRate,
        picks,
      };
    });
  }, [allPicks]);

  // Calculate cumulative units data for chart
  const cumulativeUnitsData = useMemo(() => {
    const picks = selectedSport === 'all'
      ? allPicks
      : allPicks.filter(p => p.game_type === selectedSport);

    // Sort by created_at
    const sortedPicks = [...picks].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let cumulative = 0;
    const data: { x: number; y: number }[] = [{ x: 0, y: 0 }];

    sortedPicks.forEach((pick, index) => {
      if (pick.result && pick.result !== 'pending') {
        const calc = calculateUnits(pick.result, pick.best_price, pick.units);
        cumulative += calc.netUnits;
      }
      data.push({ x: index + 1, y: cumulative });
    });

    return data;
  }, [allPicks, selectedSport]);

  // Find best recent run (consecutive wins or positive streak)
  const bestRun = useMemo((): BestRun | null => {
    const picks = selectedSport === 'all'
      ? allPicks
      : allPicks.filter(p => p.game_type === selectedSport);

    // Sort by created_at descending (most recent first)
    const sortedPicks = [...picks]
      .filter(p => p.result && p.result !== 'pending')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (sortedPicks.length === 0) return null;

    let bestRun: BestRun | null = null;
    let currentRun: BestRun = {
      startIndex: 0,
      endIndex: 0,
      wins: 0,
      losses: 0,
      netUnits: 0,
      maxUnits: 0,
      picks: [],
    };

    let runningUnits = 0;
    let maxUnitsInRun = 0;

    // Look for best consecutive winning streak or positive run
    for (let i = 0; i < sortedPicks.length; i++) {
      const pick = sortedPicks[i];
      const calc = calculateUnits(pick.result, pick.best_price, pick.units);

      if (pick.result === 'won') {
        currentRun.wins++;
        currentRun.picks.push(pick);
        runningUnits += calc.netUnits;
        currentRun.netUnits = runningUnits;
        maxUnitsInRun = Math.max(maxUnitsInRun, runningUnits);
        currentRun.maxUnits = maxUnitsInRun;
        currentRun.endIndex = i;

        // Update best run if current is better
        if (!bestRun || currentRun.wins > bestRun.wins ||
            (currentRun.wins === bestRun.wins && currentRun.netUnits > bestRun.netUnits)) {
          bestRun = { ...currentRun };
        }
      } else if (pick.result === 'lost') {
        // Reset current run on loss
        currentRun = {
          startIndex: i + 1,
          endIndex: i + 1,
          wins: 0,
          losses: 0,
          netUnits: 0,
          maxUnits: 0,
          picks: [],
        };
        runningUnits = 0;
        maxUnitsInRun = 0;
      }
    }

    return bestRun;
  }, [allPicks, selectedSport]);

  const currentStats = sportStats.find(s => s.sport === selectedSport) || sportStats[0];

  // Transform data for CartesianChart format
  const chartData = useMemo(() => {
    return cumulativeUnitsData.map(d => ({
      x: d.x,
      y: d.y,
    }));
  }, [cumulativeUnitsData]);

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

        {/* Sport Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sportTabs}
        >
          {sportStats.map(stat => (
            <TouchableOpacity
              key={stat.sport}
              style={[
                styles.sportTab,
                selectedSport === stat.sport && styles.sportTabActive,
                { backgroundColor: selectedSport === stat.sport
                  ? (isDark ? 'rgba(59, 130, 246, 0.3)' : '#2563eb')
                  : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                }
              ]}
              onPress={() => setSelectedSport(stat.sport)}
            >
              <Text style={[
                styles.sportTabText,
                { color: selectedSport === stat.sport
                  ? (isDark ? '#ffffff' : '#ffffff')
                  : theme.colors.onSurfaceVariant
                }
              ]}>
                {stat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Overall Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
            <Text style={[styles.statCardLabel, { color: theme.colors.onSurfaceVariant }]}>Record</Text>
            <Text style={[styles.statCardValue, { color: theme.colors.onSurface }]}>
              {currentStats.won}-{currentStats.lost}{currentStats.push > 0 ? `-${currentStats.push}` : ''}
            </Text>
            <Text style={[styles.statCardSubtext, { color: isDark ? '#93c5fd' : '#2563eb' }]}>
              {currentStats.winRate.toFixed(1)}% Win Rate
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
            <Text style={[styles.statCardLabel, { color: theme.colors.onSurfaceVariant }]}>Net Units</Text>
            <Text style={[
              styles.statCardValue,
              { color: currentStats.netUnits >= 0 ? '#22c55e' : '#ef4444' }
            ]}>
              {currentStats.netUnits >= 0 ? '+' : ''}{currentStats.netUnits.toFixed(2)}
            </Text>
            <Text style={[styles.statCardSubtext, { color: theme.colors.onSurfaceVariant }]}>
              Units P/L
            </Text>
          </View>
        </View>

        {/* Best Recent Run Card */}
        {bestRun && bestRun.wins > 0 && (
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
                  {bestRun.wins}
                </Text>
                <Text style={[styles.bestRunStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Wins
                </Text>
              </View>
              <View style={[styles.bestRunDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]} />
              <View style={styles.bestRunStat}>
                <Text style={[styles.bestRunStatValue, { color: '#22c55e' }]}>
                  +{bestRun.netUnits.toFixed(2)}
                </Text>
                <Text style={[styles.bestRunStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Units Won
                </Text>
              </View>
              <View style={[styles.bestRunDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]} />
              <View style={styles.bestRunStat}>
                <Text style={[styles.bestRunStatValue, { color: theme.colors.onSurface }]}>
                  {bestRun.maxUnits.toFixed(2)}
                </Text>
                <Text style={[styles.bestRunStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Max Units
                </Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* Cumulative Units Chart */}
        <View style={[styles.chartCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
          <Text style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
            Cumulative Units Over Time
          </Text>
          {chartData.length > 1 ? (
            <View style={styles.chartContainer}>
              <CartesianChart
                data={chartData}
                xKey="x"
                yKeys={["y"]}
                axisOptions={{
                  font: undefined,
                  lineColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                  labelColor: theme.colors.onSurfaceVariant,
                  formatXLabel: (value: number) => {
                    if (value === 0) return 'Start';
                    if (value === chartData.length - 1) return 'Now';
                    return '';
                  },
                  formatYLabel: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`,
                }}
              >
                {({ points }) => (
                  <Line
                    points={points.y}
                    color={currentStats.netUnits >= 0 ? '#22c55e' : '#ef4444'}
                    strokeWidth={2}
                    curveType="monotoneX"
                  />
                )}
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

        {/* Sport Breakdown */}
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Breakdown by Sport
        </Text>
        {sportStats.filter(s => s.sport !== 'all').map(stat => (
          <View
            key={stat.sport}
            style={[styles.sportBreakdownCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
          >
            <View style={styles.sportBreakdownHeader}>
              <Text style={[styles.sportBreakdownLabel, { color: theme.colors.onSurface }]}>
                {stat.label}
              </Text>
              <Text style={[
                styles.sportBreakdownUnits,
                { color: stat.netUnits >= 0 ? '#22c55e' : '#ef4444' }
              ]}>
                {stat.netUnits >= 0 ? '+' : ''}{stat.netUnits.toFixed(2)}u
              </Text>
            </View>
            <View style={styles.sportBreakdownStats}>
              <Text style={[styles.sportBreakdownRecord, { color: theme.colors.onSurfaceVariant }]}>
                {stat.won}-{stat.lost}{stat.push > 0 ? `-${stat.push}` : ''} ({stat.winRate.toFixed(1)}%)
              </Text>
              <Text style={[styles.sportBreakdownPicks, { color: theme.colors.onSurfaceVariant }]}>
                {stat.picks.length} picks
              </Text>
            </View>
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
  sportTabs: {
    gap: 8,
    paddingBottom: 16,
  },
  sportTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sportTabActive: {},
  sportTabText: {
    fontSize: 14,
    fontWeight: '600',
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
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
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
  sportBreakdownCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  sportBreakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sportBreakdownLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  sportBreakdownUnits: {
    fontSize: 16,
    fontWeight: '800',
  },
  sportBreakdownStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sportBreakdownRecord: {
    fontSize: 13,
  },
  sportBreakdownPicks: {
    fontSize: 13,
  },
});
