// ChatModelProjectionWidget — Model vs Vegas comparison with edge display.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  data: Record<string, unknown>;
}

function getEdgeColor(edge: number | null): string {
  if (edge == null) return 'rgba(255,255,255,0.4)';
  const abs = Math.abs(edge);
  if (abs >= 5) return '#22c55e';
  if (abs >= 3) return '#84cc16';
  if (abs >= 2) return '#eab308';
  return '#f97316';
}

export default function ChatModelProjectionWidget({ data }: Props) {
  const d = data as any;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={14} color="rgba(255,255,255,0.5)" />
        <Text style={styles.headerText}>Model vs Vegas</Text>
      </View>

      {/* ML Pick */}
      {d.ml_pick_team && d.ml_prob && (
        <View style={styles.row}>
          <Text style={styles.label}>ML</Text>
          <Text style={styles.value}>{d.ml_pick_team}</Text>
          <Text style={[styles.edgeValue, { color: getEdgeColor((d.ml_prob || 0) - 50) }]}>
            {d.ml_prob}%
          </Text>
        </View>
      )}

      {/* Spread */}
      {d.vegas_spread != null && (
        <View style={styles.row}>
          <Text style={styles.label}>Spread</Text>
          <View style={styles.comparison}>
            <Text style={styles.modelVal}>
              Model: {d.model_fair_spread != null ? (d.model_fair_spread > 0 ? '+' : '') + Number(d.model_fair_spread).toFixed(1) : '—'}
            </Text>
            <Text style={styles.vegasVal}>
              Vegas: {d.vegas_spread > 0 ? '+' : ''}{d.vegas_spread}
            </Text>
          </View>
          {d.spread_edge != null && (
            <Text style={[styles.edgeValue, { color: getEdgeColor(d.spread_edge) }]}>
              {d.spread_edge > 0 ? '+' : ''}{Number(d.spread_edge).toFixed(1)}
            </Text>
          )}
        </View>
      )}

      {/* Total */}
      {d.vegas_total != null && (
        <View style={styles.row}>
          <Text style={styles.label}>Total</Text>
          <View style={styles.comparison}>
            <Text style={styles.modelVal}>
              Model: {d.model_fair_total != null ? Number(d.model_fair_total).toFixed(1) : '—'}
            </Text>
            <Text style={styles.vegasVal}>
              Vegas: {d.vegas_total}
            </Text>
          </View>
          {d.total_edge != null && (
            <View style={styles.ouPill}>
              <MaterialCommunityIcons
                name={d.ou_pick === 'over' ? 'arrow-up-bold' : 'arrow-down-bold'}
                size={10}
                color={d.ou_pick === 'over' ? '#22c55e' : '#ef4444'}
              />
              <Text style={[styles.edgeValue, { color: getEdgeColor(d.total_edge) }]}>
                {d.total_edge > 0 ? '+' : ''}{Number(d.total_edge).toFixed(1)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 10, gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  headerText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', width: 42 },
  value: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  comparison: { flex: 1, flexDirection: 'row', gap: 10 },
  modelVal: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  vegasVal: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  edgeValue: { fontSize: 12, fontWeight: '700' },
  ouPill: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
