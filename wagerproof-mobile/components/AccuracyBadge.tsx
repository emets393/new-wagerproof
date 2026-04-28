import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { BucketAccuracyResult } from '@/utils/mlbBucketAccuracy';

// Mirrors web MLB thresholds in src/pages/MLB.tsx:
// green >= 54.1, orange 52.1-54.0, red < 52.1.
export function AccuracyBadge({ info }: { info: BucketAccuracyResult | null | undefined }) {
  if (!info) return null;
  const style = info.win_pct >= 54.1
    ? { bg: 'rgba(16,185,129,0.18)', border: 'rgba(52,211,153,0.45)', text: '#6ee7b7' }
    : info.win_pct >= 52.1
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
