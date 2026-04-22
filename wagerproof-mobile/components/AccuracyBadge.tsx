import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { BucketAccuracyResult } from '@/utils/mlbBucketAccuracy';

// Mirrors the web accuracyBadge() treatment in src/pages/MLB.tsx: color-coded
// pill driven by win_pct thresholds (≥65 / ≥55 / otherwise).
export function AccuracyBadge({ info }: { info: BucketAccuracyResult | null | undefined }) {
  if (!info) return null;
  const style = info.win_pct >= 65
    ? { bg: 'rgba(16,185,129,0.18)', border: 'rgba(52,211,153,0.45)', text: '#6ee7b7' }
    : info.win_pct >= 55
      ? { bg: 'rgba(249,115,22,0.18)', border: 'rgba(251,146,60,0.45)', text: '#fdba74' }
      : { bg: 'rgba(239,68,68,0.18)', border: 'rgba(248,113,113,0.45)', text: '#fca5a5' };
  return (
    <View style={[styles.pill, { backgroundColor: style.bg, borderColor: style.border }]}>
      <Text style={[styles.text, { color: style.text }]}>
        {info.win_pct}% W ({info.record})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
