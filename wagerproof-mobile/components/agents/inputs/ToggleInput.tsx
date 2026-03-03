import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, Switch } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';

interface ToggleInputProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function ToggleInput({
  value,
  onChange,
  label,
  description,
  disabled = false,
}: ToggleInputProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const handleToggle = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(!value);
  }, [onChange, value, disabled]);

  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.9}
      onPress={handleToggle}
      disabled={disabled}
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.07)'
            : 'rgba(255, 255, 255, 0.8)',
          borderColor: isDark
            ? 'rgba(255, 255, 255, 0.14)'
            : 'rgba(255, 255, 255, 0.72)',
          shadowColor: value ? theme.colors.primary : '#000000',
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.contentRow}>
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>
              {label}
            </Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: value
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.22)'
                      : 'rgba(16, 185, 129, 0.14)'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(15, 23, 42, 0.06)',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: value
                      ? isDark
                        ? '#A7F3D0'
                        : '#047857'
                      : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                {value ? 'On' : 'Off'}
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
        </View>
        <View
          style={[
            styles.switchShell,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.06)'
                : 'rgba(255, 255, 255, 0.88)',
              borderColor: isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(15, 23, 42, 0.06)',
            },
          ]}
        >
          <Switch
            value={value}
            onValueChange={handleToggle}
            color={theme.colors.primary}
            disabled={disabled}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 6,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 4,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginRight: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 19,
  },
  switchShell: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
});
