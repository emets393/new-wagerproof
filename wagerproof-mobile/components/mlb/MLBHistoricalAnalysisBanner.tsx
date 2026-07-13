import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';

export function MLBHistoricalAnalysisBanner() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const router = useRouter();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(drawer)/(tabs)/mlb-historical-analysis' as any);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#12261a', '#1a3324'] : ['#e8f8ee', '#d4f0df']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={['#22c55e', '#15803d']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBackground}
          >
            <MaterialCommunityIcons name="chart-timeline-variant" size={24} color="#ffffff" />
          </LinearGradient>
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            MLB Historical Analysis
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Situational hit rates, F5 markets & matching games
          </Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={28}
          color={theme.colors.onSurfaceVariant}
        />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 70,
  },
  iconContainer: {
    marginRight: 14,
  },
  iconBackground: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
});
