import React from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WAGERPROOF_GREEN = '#00E676';

interface LearnSlideProps {
  icon: string;
  title: string;
  description: string;
  valueProposition?: string;
  children: React.ReactNode;
}

export function LearnSlide({
  icon,
  title,
  description,
  valueProposition,
  children,
}: LearnSlideProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.container, { width: SCREEN_WIDTH }]}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Title Card - Glassmorphic Container */}
      <View style={styles.titleCardContainer}>
        <BlurView
          intensity={isDark ? 40 : 60}
          tint={isDark ? 'dark' : 'light'}
          style={styles.titleCardBlur}
        >
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)']
                : ['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.titleCardGradient}
          >
            {/* Icon Badge */}
            <View style={styles.iconRow}>
              <LinearGradient
                colors={[WAGERPROOF_GREEN, '#00C853']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconBadge}
              >
                <MaterialCommunityIcons
                  name={icon as any}
                  size={18}
                  color="#000"
                />
              </LinearGradient>
            </View>

            {/* Text Content */}
            <View style={styles.textContainer}>
              <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                {title}
              </Text>
              <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
                {description}
              </Text>
            </View>
          </LinearGradient>
        </BlurView>
      </View>

      {/* Mockup Content */}
      <View style={styles.mockupContainer}>
        {children}
      </View>

      {/* Value Proposition - Glassmorphic (only if provided) */}
      {valueProposition && (
        <View style={styles.valueContainer}>
          <BlurView
            intensity={isDark ? 25 : 40}
            tint={isDark ? 'dark' : 'light'}
            style={styles.valueBlur}
          >
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(0, 230, 118, 0.08)', 'rgba(0, 200, 83, 0.04)']
                  : ['rgba(0, 230, 118, 0.12)', 'rgba(0, 200, 83, 0.06)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.valueGradient}
            >
              <View style={styles.valueIconRow}>
                <MaterialCommunityIcons name="lightbulb-on" size={16} color={WAGERPROOF_GREEN} />
                <Text style={[styles.valueLabel, { color: WAGERPROOF_GREEN }]}>
                  Why This Matters
                </Text>
              </View>
              <Text style={[styles.valueText, { color: theme.colors.onSurface }]}>
                {valueProposition}
              </Text>
            </LinearGradient>
          </BlurView>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  titleCardContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  titleCardBlur: {
    overflow: 'hidden',
  },
  titleCardGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconRow: {
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
  mockupContainer: {
    width: '100%',
  },
  valueContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.2)',
  },
  valueBlur: {
    overflow: 'hidden',
  },
  valueGradient: {
    padding: 10,
  },
  valueIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  valueLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueText: {
    fontSize: 12,
    lineHeight: 17,
  },
});
