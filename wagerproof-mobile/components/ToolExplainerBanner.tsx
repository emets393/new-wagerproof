import React from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';

interface ExampleItem {
  icon: string;
  /** Short label e.g. "Lakers ATS after a win" */
  label: string;
  /** Result/value e.g. "72% (13-5)" */
  value: string;
  /** Color for the value text — green for positive signals, red for fades, etc. */
  valueColor?: string;
}

interface ToolExplainerBannerProps {
  /** Accent color for the banner (gradient tint, icon highlights) */
  accentColor: string;
  /** Tool name displayed as a label above the headline */
  title: string;
  /** Icon name shown next to the title */
  titleIcon: string;
  /** Main headline */
  headline: string;
  /** Supporting description text */
  description: string;
  /** Concrete example rows showing what kind of insights this tool surfaces */
  examples: ExampleItem[];
  /** Override wrapper style */
  wrapperStyle?: ViewStyle;
}

/**
 * Glassmorphic banner explaining what a tool does, with concrete example rows.
 * Reused at the top of every tool detail/list view.
 */
export function ToolExplainerBanner({ accentColor, title, titleIcon, headline, description, examples = [], wrapperStyle }: ToolExplainerBannerProps) {
  const { isDark } = useThemeContext();

  const textColor = isDark ? '#ffffff' : '#111111';
  const mutedColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.6)';
  const fallbackBg = isDark ? 'rgba(20, 20, 30, 0.85)' : 'rgba(255, 255, 255, 0.75)';
  const exampleBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)';

  const content = (
    <>
      <LinearGradient
        colors={[
          `${accentColor}${isDark ? '14' : '1F'}`,
          'transparent',
          `${accentColor}${isDark ? '14' : '1F'}`,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Accent stripe */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      <View style={styles.innerContent}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name={titleIcon as any} size={18} color={accentColor} style={{ marginRight: 6 }} />
          <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
        </View>
        <Text style={[styles.headline, { color: textColor }]}>{headline}</Text>
        <Text style={[styles.description, { color: mutedColor }]}>{description}</Text>

        {/* Example rows */}
        <View style={[styles.examplesContainer, { borderTopColor: dividerColor }]}>
          <Text style={[styles.examplesLabel, { color: mutedColor }]}>Example signals:</Text>
          {examples.map((ex, i) => (
            <View key={i} style={[styles.exampleRow, { backgroundColor: exampleBg }]}>
              <View style={[styles.exampleIconCircle, { backgroundColor: `${accentColor}33` }]}>
                <MaterialCommunityIcons name={ex.icon as any} size={16} color={accentColor} />
              </View>
              <Text style={[styles.exampleLabel, { color: textColor }]} numberOfLines={1}>
                {ex.label}
              </Text>
              <Text style={[styles.exampleValue, { color: ex.valueColor || accentColor }]} numberOfLines={1}>
                {ex.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );

  return (
    <View style={[styles.wrapper, { borderColor }, wrapperStyle]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={styles.blurFill}>
          {content}
        </BlurView>
      ) : (
        <View style={[styles.blurFill, { backgroundColor: fallbackBg }]}>
          {content}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: -12,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  blurFill: {
    overflow: 'hidden',
  },
  accentBar: {
    height: 3,
  },
  innerContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  examplesContainer: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  examplesLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  exampleIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  exampleValue: {
    fontSize: 12,
    fontWeight: '800',
  },
});
