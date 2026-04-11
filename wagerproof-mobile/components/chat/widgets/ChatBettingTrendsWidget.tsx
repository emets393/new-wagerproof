// ChatBettingTrendsWidget — ATS and O/U percentages with streaks.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  data: Record<string, unknown>;
}

function pct(v: unknown): string {
  if (v == null) return '—';
  return `${(Number(v) * 100).toFixed(0)}%`;
}

function streak(v: unknown): string {
  if (v == null) return '—';
  const n = Number(v);
  return n > 0 ? `W${n}` : n < 0 ? `L${Math.abs(n)}` : '—';
}

export default function ChatBettingTrendsWidget({ data }: Props) {
  const d = data as any;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="trending-up" size={14} color="rgba(255,255,255,0.5)" />
        <Text style={styles.headerText}>Betting Trends</Text>
      </View>

      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.cell, styles.teamCell]} />
          <Text style={[styles.cell, styles.headerCell]}>ATS%</Text>
          <Text style={[styles.cell, styles.headerCell]}>O/U%</Text>
          <Text style={[styles.cell, styles.headerCell]}>Streak</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={[styles.cell, styles.teamCell, styles.teamText]}>{d.away_abbr}</Text>
          <Text style={[styles.cell, styles.dataText]}>{pct(d.away_ats_pct)}</Text>
          <Text style={[styles.cell, styles.dataText]}>{pct(d.away_over_pct)}</Text>
          <Text style={[styles.cell, styles.dataText]}>{streak(d.away_streak)}</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={[styles.cell, styles.teamCell, styles.teamText]}>{d.home_abbr}</Text>
          <Text style={[styles.cell, styles.dataText]}>{pct(d.home_ats_pct)}</Text>
          <Text style={[styles.cell, styles.dataText]}>{pct(d.home_over_pct)}</Text>
          <Text style={[styles.cell, styles.dataText]}>{streak(d.home_streak)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 10, gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  headerText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  table: { gap: 2 },
  headerRow: { flexDirection: 'row' },
  dataRow: { flexDirection: 'row' },
  cell: { flex: 1, paddingVertical: 2 },
  teamCell: { flex: 0.8 },
  headerCell: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '600' },
  teamText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
  dataText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
});
