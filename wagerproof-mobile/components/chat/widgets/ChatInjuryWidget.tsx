// ChatInjuryWidget — Key injured players with status indicators.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  data: Record<string, unknown>;
}

const STATUS_COLORS: Record<string, string> = {
  out: '#ef4444',
  doubtful: '#f97316',
  questionable: '#eab308',
  probable: '#84cc16',
  'day-to-day': '#eab308',
};

function InjuryRow({ player, status, impact }: { player: string; status: string; impact?: number }) {
  const color = STATUS_COLORS[status?.toLowerCase()] || 'rgba(255,255,255,0.4)';
  return (
    <View style={styles.injuryRow}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.playerName} numberOfLines={1}>{player}</Text>
      <Text style={[styles.statusText, { color }]}>{status}</Text>
      {impact != null && <Text style={styles.impactText}>PIE: {Number(impact).toFixed(1)}</Text>}
    </View>
  );
}

export default function ChatInjuryWidget({ data }: Props) {
  const d = data as any;
  const awayInjuries = Array.isArray(d.away_injuries) ? d.away_injuries.slice(0, 3) : [];
  const homeInjuries = Array.isArray(d.home_injuries) ? d.home_injuries.slice(0, 3) : [];

  if (awayInjuries.length === 0 && homeInjuries.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="hospital-box-outline" size={14} color="rgba(255,255,255,0.5)" />
        <Text style={styles.headerText}>Key Injuries</Text>
      </View>

      {awayInjuries.length > 0 && (
        <View style={styles.teamSection}>
          <Text style={styles.teamLabel}>{d.away_abbr || d.away_team}</Text>
          {awayInjuries.map((inj: any, i: number) => (
            <InjuryRow key={i} player={inj.player} status={inj.status} impact={inj.impact} />
          ))}
        </View>
      )}
      {homeInjuries.length > 0 && (
        <View style={styles.teamSection}>
          <Text style={styles.teamLabel}>{d.home_abbr || d.home_team}</Text>
          {homeInjuries.map((inj: any, i: number) => (
            <InjuryRow key={i} player={inj.player} status={inj.status} impact={inj.impact} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 10, gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  headerText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  teamSection: { gap: 3 },
  teamLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', marginBottom: 1 },
  injuryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  playerName: { color: 'rgba(255,255,255,0.7)', fontSize: 12, flex: 1 },
  statusText: { fontSize: 10, fontWeight: '600' },
  impactText: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
});
