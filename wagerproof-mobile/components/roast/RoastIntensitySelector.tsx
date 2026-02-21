import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import type { RoastIntensity } from '@/types/roast';

interface RoastIntensitySelectorProps {
  value: RoastIntensity;
  onChange: (intensity: RoastIntensity) => void;
}

const OPTIONS: { key: RoastIntensity; label: string; emoji: string }[] = [
  { key: 'max', label: 'Savage', emoji: '🔥' },
  { key: 'medium', label: 'Medium', emoji: '😏' },
  { key: 'light', label: 'Light', emoji: '😄' },
];

export function RoastIntensitySelector({ value, onChange }: RoastIntensitySelectorProps) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((opt) => {
        const isActive = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{opt.emoji}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pillActive: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderColor: '#22c55e',
  },
  emoji: {
    fontSize: 16,
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  labelActive: {
    color: '#22c55e',
  },
});
