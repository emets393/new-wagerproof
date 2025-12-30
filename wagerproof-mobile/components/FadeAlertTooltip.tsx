import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface FadeAlertTooltipProps {
  betType: 'spread' | 'total';
  suggestedBet: string; // e.g., "Under 45.5" or "Patriots +3.5"
}

export function FadeAlertTooltip({ betType, suggestedBet }: FadeAlertTooltipProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="lightning-bolt" size={16} color="#f59e0b" />
        <Text style={styles.headerText}>Fade Alert Triggered</Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          Our model is showing <Text style={styles.highlight}>extreme confidence</Text> on this pick.
          Historical backtesting across thousands of games reveals that when the model is{' '}
          <Text style={styles.highlight}>overconfident</Text>, betting the opposite direction
          has been <Text style={styles.profitableText}>more profitable</Text>.
        </Text>

        <View style={styles.suggestionBox}>
          <View style={styles.suggestionHeader}>
            <MaterialCommunityIcons name="swap-horizontal" size={14} color="#22c55e" />
            <Text style={styles.suggestionLabel}>Consider the Fade</Text>
          </View>
          <Text style={styles.suggestionText}>
            Instead of following the model, consider betting <Text style={styles.fadeTarget}>{suggestedBet}</Text>
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="chart-line" size={12} color="#22c55e" />
            <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
              Higher hit rate when fading
            </Text>
          </View>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="cash" size={12} color="#22c55e" />
            <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
              Historically profitable
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    gap: 12,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  highlight: {
    fontWeight: '700',
    color: '#f59e0b',
  },
  profitableText: {
    fontWeight: '700',
    color: '#22c55e',
  },
  suggestionBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 8,
    padding: 10,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  suggestionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22c55e',
    textTransform: 'uppercase',
  },
  suggestionText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 17,
  },
  fadeTarget: {
    fontWeight: '700',
    color: '#22c55e',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
  },
});
