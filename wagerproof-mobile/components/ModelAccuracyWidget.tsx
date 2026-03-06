import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';
import { GameAccuracyData } from '@/types/modelAccuracy';

interface ModelAccuracyWidgetProps {
  data: GameAccuracyData;
  awayAbbr: string;
  homeAbbr: string;
  isLoading?: boolean;
}

function getAccuracyColor(pct: number | null): string {
  if (pct === null) return '#9ca3af';
  if (pct >= 60) return '#22c55e';
  if (pct >= 50) return '#eab308';
  return '#ef4444';
}

function AccuracyRow({
  label,
  pick,
  edge,
  accuracy,
  themeColors,
}: {
  label: string;
  pick: string;
  edge: string;
  accuracy: { games: number; accuracy_pct: number } | null;
  themeColors: { onSurface: string; onSurfaceVariant: string };
}) {
  const accColor = getAccuracyColor(accuracy?.accuracy_pct ?? null);

  return (
    <View style={styles.accRow}>
      <View style={styles.accLabelCol}>
        <Text style={[styles.accLabel, { color: themeColors.onSurfaceVariant }]}>{label}</Text>
      </View>
      <View style={styles.accPickCol}>
        <Text style={[styles.accPick, { color: themeColors.onSurface }]} numberOfLines={1}>{pick}</Text>
      </View>
      <View style={styles.accEdgeCol}>
        <Text style={[styles.accEdge, { color: '#3b82f6' }]}>{edge}</Text>
      </View>
      <View style={styles.accAccCol}>
        {accuracy ? (
          <>
            <Text style={[styles.accPct, { color: accColor }]}>{accuracy.accuracy_pct.toFixed(0)}%</Text>
            <Text style={[styles.accGames, { color: themeColors.onSurfaceVariant }]}>({accuracy.games}g)</Text>
          </>
        ) : (
          <Text style={[styles.accPct, { color: '#9ca3af' }]}>-</Text>
        )}
      </View>
    </View>
  );
}

export function ModelAccuracyWidget({
  data,
  awayAbbr,
  homeAbbr,
  isLoading,
}: ModelAccuracyWidgetProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="bullseye-arrow" size={20} color="#14b8a6" />
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Model Accuracy</Text>
          </View>
          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 12 }} />
        </View>
      </View>
    );
  }

  // Spread pick
  const spreadPickTeam = data.homeSpreadDiff !== null
    ? (data.homeSpreadDiff > 0 ? homeAbbr : awayAbbr)
    : '-';
  const spreadEdge = data.homeSpreadDiff !== null ? `${Math.abs(data.homeSpreadDiff).toFixed(1)} pts` : '-';

  // ML pick
  const mlPickTeam = data.mlPickIsHome !== null
    ? (data.mlPickIsHome ? homeAbbr : awayAbbr)
    : '-';
  const mlProb = data.mlPickIsHome !== null
    ? `${((data.mlPickIsHome ? (data.homeWinProb ?? 0) : (data.awayWinProb ?? 0)) * 100).toFixed(0)}%`
    : '-';

  // O/U pick
  const ouPick = data.overLineDiff !== null
    ? (data.overLineDiff > 0 ? 'Over' : 'Under')
    : '-';
  const ouEdge = data.overLineDiff !== null ? `${Math.abs(data.overLineDiff).toFixed(1)} pts` : '-';

  const themeColors = { onSurface: theme.colors.onSurface, onSurfaceVariant: theme.colors.onSurfaceVariant };

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="bullseye-arrow" size={20} color="#14b8a6" />
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>Model Accuracy</Text>
        </View>

        <View style={[styles.tableContainer, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
          {/* Table header */}
          <View style={styles.accRow}>
            <View style={styles.accLabelCol}>
              <Text style={[styles.tableHeaderText, { color: theme.colors.onSurfaceVariant }]}>Type</Text>
            </View>
            <View style={styles.accPickCol}>
              <Text style={[styles.tableHeaderText, { color: theme.colors.onSurfaceVariant }]}>Pick</Text>
            </View>
            <View style={styles.accEdgeCol}>
              <Text style={[styles.tableHeaderText, { color: theme.colors.onSurfaceVariant }]}>Edge</Text>
            </View>
            <View style={styles.accAccCol}>
              <Text style={[styles.tableHeaderText, { color: theme.colors.onSurfaceVariant }]}>Accuracy</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <AccuracyRow
            label="Spread"
            pick={spreadPickTeam}
            edge={spreadEdge}
            accuracy={data.spreadAccuracy}
            themeColors={themeColors}
          />
          <AccuracyRow
            label="ML"
            pick={mlPickTeam}
            edge={mlProb}
            accuracy={data.mlAccuracy}
            themeColors={themeColors}
          />
          <AccuracyRow
            label="O/U"
            pick={ouPick}
            edge={ouEdge}
            accuracy={data.ouAccuracy}
            themeColors={themeColors}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, overflow: 'hidden', marginBottom: 12 },
  content: { padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '600' },
  tableContainer: { borderRadius: 8, padding: 8 },
  tableHeaderText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 4 },
  accRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  accLabelCol: { width: 52 },
  accPickCol: { flex: 1, alignItems: 'center' },
  accEdgeCol: { flex: 1, alignItems: 'center' },
  accAccCol: { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 3 },
  accLabel: { fontSize: 12, fontWeight: '600' },
  accPick: { fontSize: 12, fontWeight: '700' },
  accEdge: { fontSize: 12, fontWeight: '600' },
  accPct: { fontSize: 13, fontWeight: '700' },
  accGames: { fontSize: 10, fontWeight: '500' },
});
