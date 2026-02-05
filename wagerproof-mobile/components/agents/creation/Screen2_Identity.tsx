import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useThemeContext } from '@/contexts/ThemeContext';

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
}

// ============================================================================
// CONSTANTS
// ============================================================================

// 32 popular emojis for agents (4x8 grid)
const EMOJI_OPTIONS = [
  // Row 1 - Animals
  '\uD83E\uDD16', // Robot
  '\uD83E\uDDEB', // Sloth
  '\uD83E\uDD8A', // Fox
  '\uD83D\uDC3A', // Wolf
  '\uD83E\uDD81', // Lion
  '\uD83D\uDC2F', // Tiger
  '\uD83E\uDD85', // Eagle
  '\uD83E\uDD89', // Owl
  // Row 2 - More Animals
  '\uD83D\uDC32', // Dragon
  '\uD83E\uDD88', // Shark
  '\uD83D\uDC0D', // Snake
  '\uD83E\uDD9C', // Parrot
  '\uD83D\uDC3B', // Bear
  '\uD83E\uDDA2', // Swan
  '\uD83E\uDD8D', // Gorilla
  '\uD83D\uDC1D', // Bee
  // Row 3 - Objects/Symbols
  '\uD83D\uDD25', // Fire
  '\uD83D\uDCAF', // 100
  '\uD83D\uDCA5', // Collision
  '\u26A1',       // Lightning
  '\uD83C\uDFAF', // Target
  '\uD83D\uDC8E', // Gem
  '\uD83D\uDC51', // Crown
  '\uD83C\uDFC6', // Trophy
  // Row 4 - More Objects
  '\uD83D\uDE80', // Rocket
  '\uD83D\uDCC8', // Chart Up
  '\uD83C\uDFB0', // Slot Machine
  '\uD83C\uDFB2', // Dice
  '\u265F\uFE0F', // Chess Pawn
  '\uD83E\uDDE0', // Brain
  '\uD83D\uDCA1', // Light Bulb
  '\uD83D\uDD2E', // Crystal Ball
];

// Solid colors
const SOLID_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
];

// Gradient options stored as "gradient:#color1,#color2"
const GRADIENT_OPTIONS = [
  'gradient:#6366f1,#ec4899', // Indigo → Pink
  'gradient:#8b5cf6,#06b6d4', // Purple → Cyan
  'gradient:#ef4444,#f97316', // Red → Orange
  'gradient:#22c55e,#06b6d4', // Green → Cyan
  'gradient:#f97316,#eab308', // Orange → Yellow
  'gradient:#ec4899,#8b5cf6', // Pink → Purple
  'gradient:#06b6d4,#6366f1', // Cyan → Indigo
  'gradient:#22c55e,#eab308', // Green → Yellow
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
          {parsed.isGradient ? (
            <LinearGradient
              colors={parsed.colors as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.avatarPreview, { borderColor: primaryColor }]}
            >
              <Text style={styles.avatarEmoji}>
                {emoji || '\u2753'}
              </Text>
            </LinearGradient>
          ) : (
            <View
              style={[
                styles.avatarPreview,
                { backgroundColor: `${color}30`, borderColor: color },
              ]}
            >
              <Text style={styles.avatarEmoji}>
                {emoji || '\u2753'}
              </Text>
            </View>
          )}
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
              borderColor: nameOverLimit
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

        <View style={styles.emojiGrid}>
          {EMOJI_OPTIONS.map((emojiOption, index) => {
            const isSelected = emoji === emojiOption;
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.emojiButton,
                  {
                    backgroundColor: isSelected
                      ? `${color}30`
                      : isDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.03)',
                    borderColor: isSelected
                      ? color
                      : isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.05)',
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => handleEmojiSelect(emojiOption)}
                activeOpacity={0.7}
              >
                <Text style={styles.emojiText}>{emojiOption}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
          Select a solid color or gradient for your agent
        </Text>

        {/* Solid Colors */}
        <Text style={[styles.colorGroupLabel, { color: theme.colors.onSurfaceVariant }]}>
          Solid
        </Text>
        <View style={styles.colorGrid}>
          {SOLID_COLORS.map((colorOption) => {
            const isSelected = color === colorOption;
            return (
              <TouchableOpacity
                key={colorOption}
                style={[
                  styles.colorButton,
                  { backgroundColor: colorOption },
                  isSelected && styles.colorButtonSelected,
                ]}
                onPress={() => handleColorSelect(colorOption)}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <View style={styles.colorCheckmark}>
                    <MaterialCommunityIcons name="check" size={14} color="#000000" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Gradient Colors */}
        <Text style={[styles.colorGroupLabel, { color: theme.colors.onSurfaceVariant, marginTop: 16 }]}>
          Gradient
        </Text>
        <View style={styles.colorGrid}>
          {GRADIENT_OPTIONS.map((gradientValue) => {
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
                      <MaterialCommunityIcons name="check" size={14} color="#000000" />
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
    marginBottom: 12,
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
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 24,
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
    elevation: 4,
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
