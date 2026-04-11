// ChatPolymarketWidget — Compact prediction market odds with bar visualization.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  data: Record<string, unknown>;
}

export default function ChatPolymarketWidget({ data }: Props) {
  const d = data as any;
  const homePrice = Number(d.home_yes_price || 0);
  const awayPrice = Number(d.away_yes_price || 0);
  const homePct = Math.round(homePrice * 100);
  const awayPct = Math.round(awayPrice * 100);
  const volume = d.volume ? `$${(Number(d.volume) / 1000).toFixed(1)}K` : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="chart-line" size={14} color="#8b5cf6" />
        <Text style={styles.headerText}>Polymarket</Text>
        {volume && <Text style={styles.volume}>Vol: {volume}</Text>}
      </View>

      <View style={styles.barContainer}>
        <Text style={styles.teamLabel}>{d.away_abbr || d.away_team}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { flex: awayPct, backgroundColor: '#3b82f6' }]} />
          <View style={[styles.barFill, { flex: homePct, backgroundColor: '#ef4444' }]} />
        </View>
        <Text style={styles.teamLabel}>{d.home_abbr || d.home_team}</Text>
      </View>

      <View style={styles.pctRow}>
        <Text style={[styles.pctText, { color: '#3b82f6' }]}>{awayPct}¢</Text>
        <Text style={[styles.pctText, { color: '#ef4444' }]}>{homePct}¢</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 10, gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerText: { color: '#8b5cf6', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  volume: { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginLeft: 'auto' },
  barContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', width: 32 },
  barTrack: { flex: 1, flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  barFill: { height: '100%' },
  pctRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 40 },
  pctText: { fontSize: 12, fontWeight: '700' },
});
