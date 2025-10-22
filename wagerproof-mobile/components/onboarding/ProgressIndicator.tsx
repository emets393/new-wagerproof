import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={[styles.track, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
        <View
          style={[
            styles.progress,
            {
              width: `${progressPercentage}%`,
              backgroundColor: theme.colors.primary,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  track: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    borderRadius: 6,
  },
});

