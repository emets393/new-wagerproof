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
}

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
}: TextInputProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const borderColor = error
    ? theme.colors.error
    : isFocused
    ? theme.colors.primary
    : theme.colors.outline;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: theme.colors.onSurface }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            borderColor,
            backgroundColor: theme.colors.surface,
          },
          !editable && styles.disabled,
        ]}
      >
        {icon && (
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={theme.colors.onSurfaceVariant}
            style={styles.leftIcon}
          />
        )}
        <RNTextInput
          style={[
            styles.input,
            {
              color: theme.colors.onSurface,
            },
            multiline && styles.multiline,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.onSurfaceVariant}
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
              color={theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
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

