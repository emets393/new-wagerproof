// ChatPublicBettingWidget — Betting splits visualization for NFL/CFB.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  data: Record<string, unknown>;
}

function SplitBar({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  // Parse "KC 72% / BUF 28%" format
  const parts = String(value).split('/').map((s) => s.trim());
  if (parts.length < 2) return null;

  const leftMatch = parts[0].match(/(\S+)\s+(\d+)%/);
  const rightMatch = parts[1].match(/(\S+)\s+(\d+)%/);
  if (!leftMatch || !rightMatch) return null;

  const leftPct = parseInt(leftMatch[2]);
  const rightPct = parseInt(rightMatch[2]);

  return (
    <View style={styles.splitRow}>
      <Text style={styles.splitLabel}>{label}</Text>
      <Text style={styles.splitTeam}>{leftMatch[1]}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barLeft, { flex: leftPct }]} />
        <View style={[styles.barRight, { flex: rightPct }]} />
      </View>
      <Text style={styles.splitTeam}>{rightMatch[1]}</Text>
    </View>
  );
}

export default function ChatPublicBettingWidget({ data }: Props) {
  const d = data as any;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="account-group" size={14} color="rgba(255,255,255,0.5)" />
        <Text style={styles.headerText}>Public Betting</Text>
      </View>
      <SplitBar label="ML" value={d.ml_splits_label} />
      <SplitBar label="Spread" value={d.spread_splits_label} />
      <SplitBar label="Total" value={d.total_splits_label} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 10, gap: 5 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  headerText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  splitLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '600', width: 36 },
  splitTeam: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', width: 28 },
  barTrack: { flex: 1, flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  barLeft: { backgroundColor: '#3b82f6', height: '100%' },
  barRight: { backgroundColor: 'rgba(255,255,255,0.15)', height: '100%' },
});
