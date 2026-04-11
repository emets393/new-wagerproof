// ChatMatchupWidget — Team logos, abbreviations, odds, and game time.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TeamAvatar } from '../../TeamAvatar';

interface Props {
  data: Record<string, unknown>;
  sport: string;
}

function fmt(n: unknown): string {
  if (n == null) return '';
  const v = Number(n);
  return v > 0 ? `+${v}` : String(v);
}

function formatTime(time: unknown): string {
  if (!time || typeof time !== 'string') return '';
  if (time.includes('T')) {
    try {
      const d = new Date(time);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
    } catch { return ''; }
  }
  return time.replace(/:\d{2}(?=\s|$)/, '');
}

export default function ChatMatchupWidget({ data, sport }: Props) {
  const d = data as any;
  return (
    <View style={styles.container}>
      <View style={styles.teamsRow}>
        <View style={styles.teamSide}>
          <TeamAvatar teamName={d.away_team || ''} sport={sport as any} size={28} />
          <View>
            <Text style={styles.abbr}>{d.away_abbr}</Text>
            <Text style={styles.odds}>{fmt(d.away_spread)} {fmt(d.away_ml)}</Text>
          </View>
        </View>

        <View style={styles.center}>
          <Text style={styles.at}>@</Text>
          {d.over_under != null && (
            <View style={styles.ouBadge}>
              <Text style={styles.ouText}>O/U: {d.over_under}</Text>
            </View>
          )}
        </View>

        <View style={[styles.teamSide, { flexDirection: 'row-reverse' }]}>
          <TeamAvatar teamName={d.home_team || ''} sport={sport as any} size={28} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.abbr}>{d.home_abbr}</Text>
            <Text style={styles.odds}>{fmt(d.home_spread)} {fmt(d.home_ml)}</Text>
          </View>
        </View>

        {d.game_time ? (
          <View style={styles.timeBadge}>
            <Text style={styles.timeText}>{formatTime(d.game_time)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 10 },
  teamsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamSide: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  abbr: { color: '#fff', fontSize: 15, fontWeight: '700' },
  odds: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  center: { flex: 1, alignItems: 'center', gap: 2 },
  at: { color: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: '600' },
  ouBadge: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  ouText: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '600' },
  timeBadge: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  timeText: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '600' },
});
