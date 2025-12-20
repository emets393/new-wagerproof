import React, { useState } from 'react';
import { View, TextInput as RNTextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface TextInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Force dark mode styling regardless of system theme - useful for dark backgrounds like onboarding */
  forceDarkMode?: boolean;
}

// Dark mode colors for forced dark mode (e.g., onboarding)
const darkModeColors = {
  surface: 'rgba(255, 255, 255, 0.1)',
  onSurface: '#ffffff',
  onSurfaceVariant: 'rgba(255, 255, 255, 0.6)',
  outline: 'rgba(255, 255, 255, 0.2)',
  primary: '#22c55e',
  error: '#ef4444',
};

export function TextInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  autoCapitalize = 'none',
  autoCorrect = false,
  keyboardType = 'default',
  editable = true,
  multiline = false,
  numberOfLines,
  icon,
  forceDarkMode = false,
}: TextInputProps) {
  const paperTheme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Use dark mode colors if forceDarkMode is enabled, otherwise use theme colors
  const colors = forceDarkMode ? darkModeColors : {
    surface: paperTheme.colors.surface,
    onSurface: paperTheme.colors.onSurface,
    onSurfaceVariant: paperTheme.colors.onSurfaceVariant,
    outline: paperTheme.colors.outline,
    primary: paperTheme.colors.primary,
    error: paperTheme.colors.error,
  };

  const borderColor = error
    ? colors.error
    : isFocused
    ? colors.primary
    : colors.outline;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: colors.onSurface }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            borderColor,
            backgroundColor: colors.surface,
          },
          !editable && styles.disabled,
        ]}
      >
        {icon && (
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={colors.onSurfaceVariant}
            style={styles.leftIcon}
          />
        )}
        <RNTextInput
          style={[
            styles.input,
            {
              color: colors.onSurface,
            },
            multiline && styles.multiline,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurfaceVariant}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.eyeIcon}
          >
            <MaterialCommunityIcons
              name={isPasswordVisible ? 'eye-off' : 'eye'}
              size={20}
              color={colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  leftIcon: {
    marginRight: 8,
  },
  eyeIcon: {
    padding: 4,
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  disabled: {
    opacity: 0.5,
  },
});

