import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useTheme, Chip } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';

interface OddsInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  type: 'favorite' | 'underdog';
}

export function OddsInput({ value, onChange, label, type }: OddsInputProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const [inputValue, setInputValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Determine valid range based on type
  const isFavorite = type === 'favorite';
  const minValue = isFavorite ? -500 : 100;
  const maxValue = isFavorite ? -100 : 500;
  const prefix = isFavorite ? '-' : '+';
  const placeholder = isFavorite ? '-200' : '+150';

  // Sync input value with prop value
  useEffect(() => {
    if (value !== null) {
      setInputValue(formatOdds(value));
    } else {
      setInputValue('');
    }
  }, [value]);

  const formatOdds = (odds: number): string => {
    if (odds >= 0) return `+${odds}`;
    return odds.toString();
  };

  const parseOdds = (text: string): number | null => {
    // Remove any non-numeric characters except minus
    const cleaned = text.replace(/[^0-9-]/g, '');
    if (!cleaned) return null;

    const parsed = parseInt(cleaned, 10);
    if (isNaN(parsed)) return null;

    return parsed;
  };

  const validateOdds = (odds: number | null): string | null => {
    if (odds === null) return null;

    if (isFavorite) {
      if (odds > -100) {
        return 'Favorite odds must be -100 or lower';
      }
      if (odds < -500) {
        return 'Favorite odds cannot be lower than -500';
      }
    } else {
      if (odds < 100) {
        return 'Underdog odds must be +100 or higher';
      }
      if (odds > 500) {
        return 'Underdog odds cannot exceed +500';
      }
    }

    return null;
  };

  const handleTextChange = useCallback(
    (text: string) => {
      setInputValue(text);
      const parsed = parseOdds(text);
      const validationError = validateOdds(parsed);
      setError(validationError);

      if (!validationError && parsed !== null) {
        onChange(parsed);
      }
    },
    [onChange, isFavorite]
  );

  const handleBlur = useCallback(() => {
    if (!inputValue) {
      // If empty, keep as null (no limit)
      return;
    }

    const parsed = parseOdds(inputValue);
    if (parsed === null) {
      setInputValue(value ? formatOdds(value) : '');
      return;
    }

    // Clamp to valid range
    let clampedValue = parsed;
    if (isFavorite) {
      clampedValue = Math.max(-500, Math.min(-100, parsed));
    } else {
      clampedValue = Math.max(100, Math.min(500, parsed));
    }

    setInputValue(formatOdds(clampedValue));
    setError(null);
    onChange(clampedValue);
  }, [inputValue, value, onChange, isFavorite]);

  const handleNoLimitToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (value === null) {
      // Set a default value
      onChange(isFavorite ? -200 : 150);
      setInputValue(isFavorite ? '-200' : '+150');
    } else {
      onChange(null);
      setInputValue('');
    }
    setError(null);
  }, [value, onChange, isFavorite]);

  const isNoLimit = value === null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.06)'
            : 'rgba(255, 255, 255, 0.82)',
          borderColor: isDark
            ? 'rgba(255, 255, 255, 0.12)'
            : 'rgba(255, 255, 255, 0.72)',
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>
            {label}
          </Text>
          <Text
            style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}
          >
            {isFavorite
              ? 'Skip heavier favorites once the price gets too steep.'
              : 'Only allow plus-money dogs that clear your floor.'}
          </Text>
        </View>
        <View
          style={[
            styles.modeBadge,
            {
              backgroundColor: isNoLimit
                ? isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(15, 23, 42, 0.06)'
                : isDark
                ? 'rgba(59, 130, 246, 0.22)'
                : 'rgba(59, 130, 246, 0.12)',
            },
          ]}
        >
          <Text
            style={[
              styles.modeBadgeText,
              {
                color: isNoLimit
                  ? theme.colors.onSurfaceVariant
                  : isDark
                  ? '#BFDBFE'
                  : '#1D4ED8',
              },
            ]}
          >
            {isNoLimit ? 'No limit' : formatOdds(value)}
          </Text>
        </View>
      </View>

      <View style={styles.inputRow}>
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.03)',
              borderColor: error
                ? '#ef4444'
                : isDark
                ? 'rgba(255, 255, 255, 0.15)'
                : 'rgba(0, 0, 0, 0.1)',
              opacity: isNoLimit ? 0.5 : 1,
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                color: theme.colors.onSurface,
              },
            ]}
            value={inputValue}
            onChangeText={handleTextChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.onSurfaceVariant}
            keyboardType="numbers-and-punctuation"
            editable={!isNoLimit}
            selectTextOnFocus
          />
        </View>

        <Chip
          mode={isNoLimit ? 'flat' : 'outlined'}
          selected={isNoLimit}
          onPress={handleNoLimitToggle}
          style={[
            styles.noLimitChip,
            isNoLimit && { backgroundColor: theme.colors.primaryContainer },
          ]}
          textStyle={{
            color: isNoLimit
              ? theme.colors.onPrimaryContainer
              : theme.colors.onSurfaceVariant,
            fontSize: 12,
          }}
        >
          No limit
        </Chip>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  noLimitChip: {
    borderRadius: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  modeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
