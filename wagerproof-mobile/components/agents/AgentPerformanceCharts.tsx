import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, MD3Theme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CartesianChart, Line } from 'victory-native';
import { Rect } from '@shopify/react-native-skia';
import { useThemeContext } from '@/contexts/ThemeContext';
import { AgentPick, Sport } from '@/types/agent';
import { computeAgentChartStats, SportChartData } from '@/utils/agentChartData';

// ============================================================================
// PROPS
// ============================================================================

interface AgentPerformanceChartsProps {
  allPicks: AgentPick[];
  preferredSports: Sport[];
  agentColor: string;
}

function sanitizeChartData(data: { x: number; y: number }[]) {
  return data.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
  );
}

function hasValidBounds(chartBounds: any): boolean {
  return (
    Number.isFinite(chartBounds?.top) &&
    Number.isFinite(chartBounds?.bottom) &&
    chartBounds.bottom > chartBounds.top
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AgentPerformanceCharts({
  allPicks,
  preferredSports,
  agentColor,
}: AgentPerformanceChartsProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const chartStats = useMemo(
    () => computeAgentChartStats(allPicks, preferredSports),
    [allPicks, preferredSports],
  );

  const overallStats = chartStats.find((s) => s.sport === 'all');
  const sportStats = chartStats.filter((s) => s.sport !== 'all');
  const safeOverallChartData = sanitizeChartData((overallStats?.chartData || []) as { x: number; y: number }[]);

  // Need at least 2 graded picks to show charts
  const hasEnoughData = overallStats && safeOverallChartData.length > 2;

  if (!hasEnoughData) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
        <MaterialCommunityIcons
          name="chart-line"
          size={36}
          color={theme.colors.onSurfaceVariant}
        />
        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          Performance charts will appear after picks are graded
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Section Title */}
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Performance
      </Text>

      {/* Overall Cumulative Units Chart */}
      <View
        style={[
          styles.chartCard,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
        ]}
      >
        <View style={styles.chartTitleRow}>
          <Text style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
            Cumulative Units
          </Text>
          {overallStats.bestRunIndices && (
            <View style={[styles.chartLegend, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
              <MaterialCommunityIcons name="fire" size={12} color="#22c55e" />
              <Text style={styles.chartLegendText}>Best Run</Text>
            </View>
          )}
        </View>
        <View style={styles.chartContainer}>
          <CartesianChart
            data={safeOverallChartData}
            xKey="x"
            yKeys={["y"]}
            axisOptions={{
              font: undefined,
              lineColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
              labelColor: theme.colors.onSurfaceVariant,
              formatXLabel: (value: any) => {
                if (value === 0) return 'Start';
                if (value === safeOverallChartData.length - 1) return 'Now';
                return '';
              },
              formatYLabel: (value: any) =>
                `${value >= 0 ? '+' : ''}${Number(value).toFixed(1)}`,
            }}
          >
            {({ points, chartBounds }: any) => {
              const bestRunIndices = overallStats.bestRunIndices;
              const safePoints = (points?.y || []).filter(
                (p: any) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
              );
              const canDrawBestRun =
                !!bestRunIndices &&
                safePoints.length > bestRunIndices.end &&
                hasValidBounds(chartBounds) &&
                Number.isFinite(safePoints[bestRunIndices.start]?.x) &&
                Number.isFinite(safePoints[bestRunIndices.end]?.x) &&
                safePoints[bestRunIndices.end].x > safePoints[bestRunIndices.start].x;
              return (
                <>
                  {canDrawBestRun && (
                    <Rect
                      x={safePoints[bestRunIndices!.start].x}
                      y={chartBounds.top}
                      width={
                        safePoints[bestRunIndices!.end].x -
                        safePoints[bestRunIndices!.start].x
                      }
                      height={chartBounds.bottom - chartBounds.top}
                      color="rgba(34, 197, 94, 0.15)"
                    />
                  )}
                  <Line
                    points={safePoints}
                    color={overallStats.netUnits >= 0 ? '#22c55e' : '#ef4444'}
                    strokeWidth={2}
                    curveType="monotoneX"
                  />
                </>
              );
            }}
          </CartesianChart>
        </View>
      </View>

      {/* Best Run Card */}
      {overallStats.bestRun && overallStats.bestRun.netUnits > 0 && (
        <LinearGradient
          colors={
            isDark
              ? ['rgba(34, 197, 94, 0.2)', 'rgba(34, 197, 94, 0.1)']
              : ['rgba(220, 252, 231, 1)', 'rgba(187, 247, 208, 1)']
          }
          style={[
            styles.bestRunCard,
            { borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : '#86efac' },
          ]}
        >
          <View style={styles.bestRunHeader}>
            <MaterialCommunityIcons
              name="chart-timeline-variant-shimmer"
              size={20}
              color="#22c55e"
            />
            <Text
              style={[
                styles.bestRunTitle,
                { color: isDark ? '#86efac' : '#166534' },
              ]}
            >
              Best Run
            </Text>
          </View>
          <View style={styles.bestRunStats}>
            <View style={styles.bestRunStat}>
              <Text style={[styles.bestRunStatValue, { color: '#22c55e' }]}>
                +{overallStats.bestRun.netUnits.toFixed(2)}
              </Text>
              <Text
                style={[
                  styles.bestRunStatLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Units Gained
              </Text>
            </View>
            <View
              style={[
                styles.bestRunDivider,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.2)'
                    : 'rgba(0,0,0,0.1)',
                },
              ]}
            />
            <View style={styles.bestRunStat}>
              <Text
                style={[
                  styles.bestRunStatValue,
                  { color: theme.colors.onSurface },
                ]}
              >
                {overallStats.bestRun.wins}-{overallStats.bestRun.losses}
              </Text>
              <Text
                style={[
                  styles.bestRunStatLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Record
              </Text>
            </View>
            <View
              style={[
                styles.bestRunDivider,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.2)'
                    : 'rgba(0,0,0,0.1)',
                },
              ]}
            />
            <View style={styles.bestRunStat}>
              <Text
                style={[
                  styles.bestRunStatValue,
                  { color: theme.colors.onSurface },
                ]}
              >
                {overallStats.bestRun.picks}
              </Text>
              <Text
                style={[
                  styles.bestRunStatLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Picks
              </Text>
            </View>
          </View>
        </LinearGradient>
      )}

      {/* By Sport Section */}
      {sportStats.length > 1 && (
        <>
          <Text style={[styles.bySportTitle, { color: theme.colors.onSurface }]}>
            By Sport
          </Text>
          {sportStats.map((stat) => (
            <SportChartCard key={stat.sport} stat={stat} isDark={isDark} theme={theme} />
          ))}
        </>
      )}
    </View>
  );
}

// ============================================================================
// SPORT CHART CARD
// ============================================================================

function SportChartCard({
  stat,
  isDark,
  theme,
}: {
  stat: SportChartData;
  isDark: boolean;
  theme: MD3Theme;
}) {
  const hasData = stat.chartData.length > 1;
  const safeChartData = sanitizeChartData(stat.chartData as { x: number; y: number }[]);
  const record = `${stat.wins}-${stat.losses}${stat.pushes > 0 ? `-${stat.pushes}` : ''}`;

  return (
    <View
      style={[
        styles.sportChartCard,
        {
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(0,0,0,0.03)',
        },
      ]}
    >
      <View style={styles.sportChartHeader}>
        <Text style={[styles.sportChartLabel, { color: theme.colors.onSurface }]}>
          {stat.label}
        </Text>
        <View style={styles.sportChartStats}>
          <Text
            style={[
              styles.sportChartRecord,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {record}
          </Text>
          <Text
            style={[
              styles.sportChartUnits,
              { color: stat.netUnits >= 0 ? '#22c55e' : '#ef4444' },
            ]}
          >
            {stat.netUnits >= 0 ? '+' : ''}
            {stat.netUnits.toFixed(2)}u
          </Text>
        </View>
      </View>

      {hasData && safeChartData.length > 1 ? (
        <View style={styles.sportChartContainer}>
          <CartesianChart
            data={safeChartData}
            xKey="x"
            yKeys={["y"]}
            axisOptions={{
              font: undefined,
              lineColor: isDark
                ? 'rgba(255,255,255,0.15)'
                : 'rgba(0,0,0,0.08)',
              labelColor: theme.colors.onSurfaceVariant,
              formatXLabel: () => '',
              formatYLabel: (value: any) =>
                `${value >= 0 ? '+' : ''}${Number(value).toFixed(0)}`,
            }}
          >
            {({ points, chartBounds }: any) => {
              const bestRunIndices = stat.bestRunIndices;
              const safePoints = (points?.y || []).filter(
                (p: any) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
              );
              const canDrawBestRun =
                !!bestRunIndices &&
                safePoints.length > bestRunIndices.end &&
                hasValidBounds(chartBounds) &&
                Number.isFinite(safePoints[bestRunIndices.start]?.x) &&
                Number.isFinite(safePoints[bestRunIndices.end]?.x) &&
                safePoints[bestRunIndices.end].x > safePoints[bestRunIndices.start].x;
              return (
                <>
                  {canDrawBestRun && (
                      <Rect
                        x={safePoints[bestRunIndices!.start].x}
                        y={chartBounds.top}
                        width={
                          safePoints[bestRunIndices!.end].x -
                          safePoints[bestRunIndices!.start].x
                        }
                        height={chartBounds.bottom - chartBounds.top}
                        color="rgba(34, 197, 94, 0.2)"
                      />
                  )}
                  <Line
                    points={safePoints}
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
        <View style={styles.noDataContainer}>
          <Text
            style={[
              styles.noDataText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            No graded picks yet
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    gap: 10,
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },

  // ---- Main chart card ----
  chartCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
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

  // ---- Best Run Card ----
  bestRunCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
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

  // ---- By Sport ----
  bySportTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 4,
  },
  sportChartCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  sportChartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sportChartLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  sportChartStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sportChartRecord: {
    fontSize: 13,
    fontWeight: '600',
  },
  sportChartUnits: {
    fontSize: 14,
    fontWeight: '800',
  },
  sportChartContainer: {
    height: 120,
  },
  noDataContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 12,
  },
});
