import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import { Scale1To5 } from '@/types/agent';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SliderInputProps {
  value: Scale1To5;
  onChange: (value: Scale1To5) => void;
  label: string;
  description?: string;
  labels: [string, string, string, string, string]; // 5 labels for each value
}

export function SliderInput({
  value,
  onChange,
  label,
  description,
  labels,
}: SliderInputProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const handleStepPress = useCallback(
    (step: Scale1To5) => {
      if (step !== value) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(step);
      }
    },
    [onChange, value]
  );

  const currentLabel = labels[value - 1];

  // Calculate the fill percentage for the track
  const fillPercentage = ((value - 1) / 4) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: theme.colors.onSurface }]}>
          {label}
        </Text>
        <View
          style={[
            styles.valueBadge,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.05)',
            },
          ]}
        >
          <Text style={[styles.valueText, { color: theme.colors.primary }]}>
            {currentLabel}
          </Text>
        </View>
      </View>

      {description && (
        <Text
          style={[
            styles.description,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {description}
        </Text>
      )}

      {/* Custom Slider Track */}
      <View style={styles.sliderContainer}>
        {/* Background Track */}
        <View
          style={[
            styles.track,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.15)'
                : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
        >
          {/* Filled Track */}
          <View
            style={[
              styles.filledTrack,
              {
                backgroundColor: theme.colors.primary,
                width: `${fillPercentage}%`,
              },
            ]}
          />
        </View>

        {/* Step Buttons */}
        <View style={styles.stepsContainer}>
          {([1, 2, 3, 4, 5] as Scale1To5[]).map((step) => {
            const isSelected = step === value;
            const isFilled = step <= value;

            return (
              <TouchableOpacity
                key={step}
                style={styles.stepTouchable}
                onPress={() => handleStepPress(step)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor: isFilled
                        ? theme.colors.primary
                        : isDark
                        ? 'rgba(255, 255, 255, 0.3)'
                        : 'rgba(0, 0, 0, 0.15)',
                      borderColor: isSelected
                        ? theme.colors.primary
                        : 'transparent',
                      transform: [{ scale: isSelected ? 1.3 : 1 }],
                    },
                    isSelected && styles.selectedDot,
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Labels Row */}
      <View style={styles.labelsRow}>
        {labels.map((stepLabel, index) => (
          <TouchableOpacity
            key={index}
            style={styles.labelTouchable}
            onPress={() => handleStepPress((index + 1) as Scale1To5)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.stepLabel,
                {
                  color:
                    index + 1 === value
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant,
                  fontWeight: index + 1 === value ? '600' : '400',
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {stepLabel}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  valueBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  valueText: {
    fontSize: 13,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  sliderContainer: {
    height: 48,
    justifyContent: 'center',
    marginVertical: 8,
    paddingHorizontal: 12,
  },
  track: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  filledTrack: {
    height: '100%',
    borderRadius: 3,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepTouchable: {
    padding: 8,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  selectedDot: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  labelTouchable: {
    flex: 1,
    paddingVertical: 4,
  },
  stepLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
});
