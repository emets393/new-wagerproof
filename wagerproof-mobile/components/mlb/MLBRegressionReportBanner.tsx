import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';

// Banner entry point for the MLB Regression Report screen. Mirrors
// MLBBettingTrendsBanner's layout so both tools read as a matched set.
export function MLBRegressionReportBanner() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const router = useRouter();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(drawer)/(tabs)/mlb-regression-report' as any);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#1e1a2e', '#2a1e32'] : ['#ede8f8', '#e1d4ed']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={['#a855f7', '#7e22ce']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBackground}
          >
            <MaterialCommunityIcons name="chart-bell-curve-cumulative" size={24} color="#ffffff" />
          </LinearGradient>
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            MLB Regression Report
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Daily picks, pitcher & batting regressions
          </Text>
        </View>

        <View style={styles.arrowContainer}>
          <MaterialCommunityIcons
            name="chevron-right"
            size={28}
            color={theme.colors.onSurfaceVariant}
          />
        </View>
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
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 13,
    fontWeight: '500',
  },
  arrowContainer: {
    marginLeft: 8,
  },
});
