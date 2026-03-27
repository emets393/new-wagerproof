import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useThemeContext } from '@/contexts/ThemeContext';
import { SwipeableEmojiPicker } from '@/components/agents/inputs/SwipeableEmojiPicker';
import { GlowingCardWrapper } from '@/components/agents/GlowingCardWrapper';


// ============================================================================
// TYPES
// ============================================================================

interface Screen2_IdentityProps {
  name: string;
  emoji: string;
  color: string;
  onNameChange: (name: string) => void;
  onEmojiChange: (emoji: string) => void;
  onColorChange: (color: string) => void;
  /** Existing agent names for the current user (used for duplicate detection) */
  existingNames?: string[];
}

// All color options are gradients (stored as "gradient:#color1,#color2")
const COLOR_OPTIONS = [
  'gradient:#6366f1,#ec4899', // Indigo → Pink
  'gradient:#8b5cf6,#06b6d4', // Purple → Cyan
  'gradient:#ef4444,#f97316', // Red → Orange
  'gradient:#22c55e,#06b6d4', // Green → Cyan
  'gradient:#f97316,#eab308', // Orange → Yellow
  'gradient:#ec4899,#8b5cf6', // Pink → Purple
  'gradient:#06b6d4,#6366f1', // Cyan → Indigo
  'gradient:#22c55e,#eab308', // Green → Yellow
  'gradient:#ef4444,#ec4899', // Red → Pink
  'gradient:#8b5cf6,#f97316', // Purple → Orange
  'gradient:#3b82f6,#22c55e', // Blue → Green
  'gradient:#f59e0b,#ef4444', // Amber → Red
  'gradient:#14b8a6,#8b5cf6', // Teal → Purple
  'gradient:#6366f1,#3b82f6', // Indigo → Blue
  'gradient:#dc2626,#7c3aed', // Red → Violet
  'gradient:#0ea5e9,#22d3ee', // Sky → Cyan
];

// Parse a color value into its components
function parseColor(value: string): { isGradient: boolean; colors: string[] } {
  if (value.startsWith('gradient:')) {
    const colors = value.replace('gradient:', '').split(',');
    return { isGradient: true, colors };
  }
  return { isGradient: false, colors: [value] };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function Screen2_Identity({
  name,
  emoji,
  color,
  onNameChange,
  onEmojiChange,
  onColorChange,
  existingNames,
}: Screen2_IdentityProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  // Handle emoji selection
  const handleEmojiSelect = useCallback(
    (selectedEmoji: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onEmojiChange(selectedEmoji);
    },
    [onEmojiChange]
  );

  // Handle color selection
  const handleColorSelect = useCallback(
    (selectedColor: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onColorChange(selectedColor);
    },
    [onColorChange]
  );

  const nameLength = name.length;
  const nameOverLimit = nameLength > 50;
  const nameIsDuplicate = !!(
    name.trim() &&
    existingNames?.some((n) => n.toLowerCase() === name.trim().toLowerCase())
  );

  const parsed = parseColor(color);
  // For border/tint use first color of gradient or the solid color
  const primaryColor = parsed.colors[0];

  return (
    <View style={styles.container}>
      {/* Live Preview */}
      <View style={styles.previewSection}>
        <View
          style={[
            styles.previewContainer,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.03)',
              borderColor: isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.05)',
            },
          ]}
        >
          <View style={{ marginBottom: 12 }}>
            <GlowingCardWrapper color={parsed.colors[0]} borderRadius={24}>
              {parsed.isGradient ? (
                <LinearGradient
                  colors={parsed.colors as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.avatarPreview, { borderColor: primaryColor }]}
                >
                  <Text style={styles.avatarEmoji}>{emoji || '\uD83E\uDD16'}</Text>
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.avatarPreview,
                    { backgroundColor: `${color}30`, borderColor: color },
                  ]}
                >
                  <Text style={styles.avatarEmoji}>{emoji || '\uD83E\uDD16'}</Text>
                </View>
              )}
            </GlowingCardWrapper>
          </View>
          <Text
            style={[
              styles.previewName,
              { color: theme.colors.onSurface },
              !name && { opacity: 0.5 },
            ]}
            numberOfLines={1}
          >
            {name || 'Agent Name'}
          </Text>
        </View>
      </View>

      {/* Name Input */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Agent Name
        </Text>
        <Text
          style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}
        >
          Give your agent a unique name (required)
        </Text>

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.03)',
              borderColor: nameOverLimit || nameIsDuplicate
                ? theme.colors.error
                : isDark
                ? 'rgba(255, 255, 255, 0.15)'
                : 'rgba(0, 0, 0, 0.1)',
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: theme.colors.onSurface }]}
            value={name}
            onChangeText={onNameChange}
            placeholder="e.g., Sharp Shooter, The Oracle"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            maxLength={60} // Allow typing slightly over to show error
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        <View style={styles.charCountContainer}>
          <Text
            style={[
              styles.charCount,
              {
                color: nameOverLimit
                  ? theme.colors.error
                  : theme.colors.onSurfaceVariant,
              },
            ]}
          >
            {nameLength}/50
          </Text>
        </View>
        {nameIsDuplicate && (
          <Text style={[styles.helperText, { color: theme.colors.error }]}>
            You already have an agent with this name
          </Text>
        )}
      </View>

      {/* Emoji Picker */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Choose an Emoji
        </Text>
        <Text
          style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}
        >
          Select an emoji to represent your agent (required)
        </Text>

        <SwipeableEmojiPicker
          selectedEmoji={emoji}
          selectedColor={parsed.colors[0]}
          onEmojiSelect={handleEmojiSelect}
        />

        {!emoji && (
          <Text style={[styles.helperText, { color: theme.colors.error }]}>
            Please select an emoji
          </Text>
        )}
      </View>

      {/* Color Picker */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Choose a Color
        </Text>
        <Text
          style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}
        >
          Select a gradient color for your agent
        </Text>

        <View style={styles.colorGrid}>
          {COLOR_OPTIONS.map((gradientValue) => {
            const isSelected = color === gradientValue;
            const gradientColors = gradientValue.replace('gradient:', '').split(',');
            return (
              <TouchableOpacity
                key={gradientValue}
                style={[
                  styles.colorButtonOuter,
                  isSelected && styles.colorButtonSelected,
                ]}
                onPress={() => handleColorSelect(gradientValue)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={gradientColors as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientSwatch}
                >
                  {isSelected && (
                    <View style={styles.colorCheckmark}>
                      <MaterialCommunityIcons name="check" size={14} color="#ffffff" />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 8,
  },
  previewContainer: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    width: '100%',
  },
  avatarPreview: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  avatarEmoji: {
    fontSize: 40,
  },
  previewName: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  inputContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    fontSize: 16,
    fontWeight: '500',
  },
  charCountContainer: {
    alignItems: 'flex-end',
    marginTop: 6,
  },
  charCount: {
    fontSize: 12,
  },
  helperText: {
    fontSize: 13,
    marginTop: 12,
  },
  colorGroupLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorButtonOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  gradientSwatch: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorButtonSelected: {
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: Platform.OS === 'android' ? 0 : 4,
  },
  colorCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
