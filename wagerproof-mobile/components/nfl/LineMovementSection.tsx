import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchLineMovement, LineMovementData } from '@/utils/nflDataFetchers';

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

  const renderLineItem = (item: LineMovementData, index: number) => {
    const isFirst = index === 0;
    const isLast = index === lineData.length - 1;

    return (
      <View 
        key={item.as_of_ts} 
        style={[
          styles.lineItem,
          { backgroundColor: isLast ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)' }
        ]}
      >
        <View style={styles.timestampSection}>
          <Text style={[styles.timestampText, { color: theme.colors.onSurfaceVariant }]}>
            {formatTimestamp(item.as_of_ts)}
          </Text>
          {isFirst && (
            <Text style={[styles.labelBadge, { color: '#3b82f6' }]}>Opening</Text>
          )}
          {isLast && (
            <Text style={[styles.labelBadge, { color: '#22c55e' }]}>Current</Text>
          )}
        </View>

        <View style={styles.linesSection}>
          <View style={styles.lineValue}>
            <Text style={[styles.lineLabel, { color: theme.colors.onSurfaceVariant }]}>
              Spread:
            </Text>
            <Text style={[styles.lineNumber, { color: theme.colors.onSurface }]}>
              {item.home_spread ? (item.home_spread > 0 ? `+${item.home_spread}` : item.home_spread) : 'N/A'}
            </Text>
          </View>

          <View style={styles.lineValue}>
            <Text style={[styles.lineLabel, { color: theme.colors.onSurfaceVariant }]}>
              Total:
            </Text>
            <Text style={[styles.lineNumber, { color: theme.colors.onSurface }]}>
              {item.over_line || 'N/A'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="chart-line" size={24} color="#10b981" />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Line Movement
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : lineData.length === 0 ? (
        <View style={[styles.emptyContainer, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
          <MaterialCommunityIcons name="information-outline" size={40} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No line movement data available
          </Text>
        </View>
      ) : (
        <View>
          {/* Summary */}
          {(spreadChange !== null || totalChange !== null) && (
            <View style={[styles.summaryCard, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <Text style={[styles.summaryTitle, { color: theme.colors.onSurface }]}>
                Line Movement Summary
              </Text>
              <View style={styles.summaryRow}>
                {spreadChange !== null && (
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                      Spread:
                    </Text>
                    <Text style={[
                      styles.summaryValue,
                      { color: spreadChange > 0 ? '#22c55e' : spreadChange < 0 ? '#ef4444' : theme.colors.onSurface }
                    ]}>
                      {spreadChange > 0 ? '+' : ''}{spreadChange.toFixed(1)}
                    </Text>
                  </View>
                )}
                {totalChange !== null && (
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                      Total:
                    </Text>
                    <Text style={[
                      styles.summaryValue,
                      { color: totalChange > 0 ? '#22c55e' : totalChange < 0 ? '#ef4444' : theme.colors.onSurface }
                    ]}>
                      {totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Timeline */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.timelineScroll}
            contentContainerStyle={styles.timelineContent}
          >
            {lineData.map((item, index) => renderLineItem(item, index))}
          </ScrollView>
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
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 40,
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
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 24,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timelineScroll: {
    marginHorizontal: -16,
  },
  timelineContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  lineItem: {
    padding: 12,
    borderRadius: 10,
    minWidth: 160,
    gap: 8,
  },
  timestampSection: {
    gap: 4,
  },
  timestampText: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  linesSection: {
    gap: 6,
  },
  lineValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  lineNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

