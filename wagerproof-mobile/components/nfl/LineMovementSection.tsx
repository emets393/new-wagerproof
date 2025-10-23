import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CartesianChart, Line } from 'victory-native';
import { fetchLineMovement, LineMovementData } from '@/utils/nflDataFetchers';
import { getNFLTeamColors } from '@/utils/teamColors';

interface LineMovementSectionProps {
  trainingKey: string;
  homeTeam: string;
  awayTeam: string;
}

export function LineMovementSection({ trainingKey, homeTeam, awayTeam }: LineMovementSectionProps) {
  const theme = useTheme();
  const [lineData, setLineData] = useState<LineMovementData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLineMovement();
  }, [trainingKey]);

  const loadLineMovement = async () => {
    setLoading(true);
    const data = await fetchLineMovement(trainingKey);
    setLineData(data);
    setLoading(false);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getSpreadChange = () => {
    if (lineData.length < 2) return null;
    const first = lineData[0].home_spread;
    const last = lineData[lineData.length - 1].home_spread;
    if (first === null || last === null) return null;
    const change = last - first;
    return change;
  };

  const getTotalChange = () => {
    if (lineData.length < 2) return null;
    const first = lineData[0].over_line;
    const last = lineData[lineData.length - 1].over_line;
    if (first === null || last === null) return null;
    const change = last - first;
    return change;
  };

  const spreadChange = getSpreadChange();
  const totalChange = getTotalChange();

  const currentLine = lineData[lineData.length - 1];
  const openingLine = lineData[0];

  const awayTeamColors = getNFLTeamColors(awayTeam);
  const homeTeamColors = getNFLTeamColors(homeTeam);

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Transform data for charts - victory-native needs specific format
  const awaySpreadData = lineData
    .filter(item => item.away_spread !== null)
    .map((item, index) => ({ 
      x: index, 
      y: item.away_spread as number 
    }));
  
  const homeSpreadData = lineData
    .filter(item => item.home_spread !== null)
    .map((item, index) => ({ 
      x: index, 
      y: item.home_spread as number 
    }));
  
  const totalData = lineData
    .filter(item => item.over_line !== null)
    .map((item, index) => ({ 
      x: index, 
      y: item.over_line as number 
    }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="chart-line" size={20} color="#10b981" />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Line Movement
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      ) : lineData.length === 0 ? (
        <View style={[styles.emptyContainer, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
          <MaterialCommunityIcons name="information-outline" size={32} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No line movement data available
          </Text>
        </View>
      ) : (
        <View>
          {/* Summary and Current Row */}
          <View style={styles.topRow}>
            {/* Summary Widget */}
            {(spreadChange !== null || totalChange !== null) && (
              <View style={[styles.widget, { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)', flex: 1 }]}>
                <Text style={[styles.widgetTitle, { color: theme.colors.onSurfaceVariant }]}>
                  Movement
                </Text>
                <View style={styles.widgetContent}>
                  {spreadChange !== null && (
                    <View style={styles.widgetRow}>
                      <Text style={[styles.widgetLabel, { color: theme.colors.onSurfaceVariant }]}>
                        Spread
                      </Text>
                      <Text style={[
                        styles.widgetValue,
                        { color: spreadChange > 0 ? '#22c55e' : spreadChange < 0 ? '#ef4444' : theme.colors.onSurface }
                      ]}>
                        {spreadChange > 0 ? '+' : ''}{spreadChange.toFixed(1)}
                      </Text>
                    </View>
                  )}
                  {totalChange !== null && (
                    <View style={styles.widgetRow}>
                      <Text style={[styles.widgetLabel, { color: theme.colors.onSurfaceVariant }]}>
                        Total
                      </Text>
                      <Text style={[
                        styles.widgetValue,
                        { color: totalChange > 0 ? '#22c55e' : totalChange < 0 ? '#ef4444' : theme.colors.onSurface }
                      ]}>
                        {totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Current Line Widget */}
            {currentLine && (
              <View style={[styles.widget, { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)', flex: 1 }]}>
                <Text style={[styles.widgetTitle, { color: theme.colors.onSurfaceVariant }]}>
                  Current
                </Text>
                <View style={styles.widgetContent}>
                  <View style={styles.widgetRow}>
                    <Text style={[styles.widgetLabel, { color: theme.colors.onSurfaceVariant }]}>
                      Spread
                    </Text>
                    <Text style={[styles.widgetValue, { color: theme.colors.onSurface }]}>
                      {currentLine.home_spread ? (currentLine.home_spread > 0 ? `+${currentLine.home_spread}` : currentLine.home_spread) : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.widgetRow}>
                    <Text style={[styles.widgetLabel, { color: theme.colors.onSurfaceVariant }]}>
                      Total
                    </Text>
                    <Text style={[styles.widgetValue, { color: theme.colors.onSurface }]}>
                      {currentLine.over_line || 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Line Movement Charts */}
          <View style={styles.chartSection}>
            <Text style={[styles.chartTitle, { color: theme.colors.onSurfaceVariant }]}>
              Spread Movement
            </Text>
            
            {/* Away Team Spread Chart */}
            {awaySpreadData.length > 0 && (
              <View style={[styles.chartContainer, { 
                backgroundColor: hexToRgba(awayTeamColors.primary, 0.1), 
                borderColor: hexToRgba(awayTeamColors.primary, 0.3) 
              }]}>
                <View style={styles.chartHeader}>
                  <Text style={[styles.chartTeamLabel, { color: theme.colors.onSurface }]}>
                    {awayTeam} Spread
                  </Text>
                  <View style={styles.chartLegend}>
                    <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                      Open: {awaySpreadData[0]?.y.toFixed(1)} → Now: {awaySpreadData[awaySpreadData.length - 1]?.y.toFixed(1)}
                    </Text>
                  </View>
                </View>
                <View style={{ height: 120 }}>
                  <CartesianChart
                    data={awaySpreadData}
                    xKey="x"
                    yKeys={["y"]}
                    axisOptions={{
                      font: undefined,
                      lineColor: theme.colors.outline,
                      labelColor: theme.colors.onSurfaceVariant,
                      formatXLabel: (value) => {
                        const index = Math.round(value);
                        if (index === 0) return 'Open';
                        if (index === awaySpreadData.length - 1) return 'Now';
                        return '';
                      },
                      formatYLabel: (value) => value.toFixed(1),
                    }}
                  >
                    {({ points }) => (
                      <Line
                        points={points.y}
                        color={awayTeamColors.primary}
                        strokeWidth={2}
                        animate={{ type: "timing", duration: 300 }}
                      />
                    )}
                  </CartesianChart>
                </View>
              </View>
            )}

            {/* Home Team Spread Chart */}
            {homeSpreadData.length > 0 && (
              <View style={[styles.chartContainer, { 
                backgroundColor: hexToRgba(homeTeamColors.primary, 0.1), 
                borderColor: hexToRgba(homeTeamColors.primary, 0.3) 
              }]}>
                <View style={styles.chartHeader}>
                  <Text style={[styles.chartTeamLabel, { color: theme.colors.onSurface }]}>
                    {homeTeam} Spread
                  </Text>
                  <View style={styles.chartLegend}>
                    <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                      Open: {homeSpreadData[0]?.y.toFixed(1)} → Now: {homeSpreadData[homeSpreadData.length - 1]?.y.toFixed(1)}
                    </Text>
                  </View>
                </View>
                <View style={{ height: 120 }}>
                  <CartesianChart
                    data={homeSpreadData}
                    xKey="x"
                    yKeys={["y"]}
                    axisOptions={{
                      font: undefined,
                      lineColor: theme.colors.outline,
                      labelColor: theme.colors.onSurfaceVariant,
                      formatXLabel: (value) => {
                        const index = Math.round(value);
                        if (index === 0) return 'Open';
                        if (index === homeSpreadData.length - 1) return 'Now';
                        return '';
                      },
                      formatYLabel: (value) => value.toFixed(1),
                    }}
                  >
                    {({ points }) => (
                      <Line
                        points={points.y}
                        color={homeTeamColors.primary}
                        strokeWidth={2}
                        animate={{ type: "timing", duration: 300 }}
                      />
                    )}
                  </CartesianChart>
                </View>
              </View>
            )}

            {/* Over/Under Chart */}
            {totalData.length > 0 && (
              <View style={styles.ouChartContainer}>
                <Text style={[styles.chartTitle, { color: theme.colors.onSurfaceVariant, marginBottom: 8, marginTop: 16 }]}>
                  Over/Under Movement
                </Text>
                <View style={[styles.chartContainer, { backgroundColor: 'rgba(249, 115, 22, 0.1)', borderColor: 'rgba(249, 115, 22, 0.3)' }]}>
                  <View style={styles.chartHeader}>
                    <Text style={[styles.chartTeamLabel, { color: theme.colors.onSurface }]}>
                      Total Line
                    </Text>
                    <View style={styles.chartLegend}>
                      <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                        Open: {totalData[0]?.y.toFixed(1)} → Now: {totalData[totalData.length - 1]?.y.toFixed(1)}
                      </Text>
                    </View>
                  </View>
                  <View style={{ height: 120 }}>
                    <CartesianChart
                      data={totalData}
                      xKey="x"
                      yKeys={["y"]}
                      axisOptions={{
                        font: undefined,
                        lineColor: theme.colors.outline,
                        labelColor: theme.colors.onSurfaceVariant,
                        formatXLabel: (value) => {
                          const index = Math.round(value);
                          if (index === 0) return 'Open';
                          if (index === totalData.length - 1) return 'Now';
                          return '';
                        },
                        formatYLabel: (value) => value.toFixed(1),
                      }}
                    >
                      {({ points }) => (
                        <Line
                          points={points.y}
                          color="#f97316"
                          strokeWidth={2}
                          animate={{ type: "timing", duration: 300 }}
                        />
                      )}
                    </CartesianChart>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  widget: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  widgetTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  widgetContent: {
    gap: 6,
  },
  widgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  widgetLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  widgetValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  chartSection: {
    gap: 12,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  chartHeader: {
    marginBottom: 8,
  },
  chartTeamLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },
  ouChartContainer: {
    marginTop: 8,
  },
});

