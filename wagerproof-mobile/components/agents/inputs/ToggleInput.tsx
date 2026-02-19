import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Switch } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';

interface ToggleInputProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}

export function ToggleInput({
  value,
  onChange,
  label,
  description,
}: ToggleInputProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const handleToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(!value);
  }, [onChange, value]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.03)'
            : 'rgba(0, 0, 0, 0.02)',
          borderColor: isDark
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.05)',
        },
      ]}
    >
      <View style={styles.textContainer}>
        <Text style={[styles.label, { color: theme.colors.onSurface }]}>
          {label}
        </Text>
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
      <Switch
        value={value}
        onValueChange={handleToggle}
        color={theme.colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 6,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
});
