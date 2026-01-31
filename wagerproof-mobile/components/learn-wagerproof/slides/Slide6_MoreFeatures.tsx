import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';

const FEATURES = [
  {
    icon: 'forum',
    title: 'Discord Community',
    description: 'Join 500+ bettors for real-time alerts',
    gradient: ['#5865F2', '#7289DA'] as const,
  },
  {
    icon: 'chart-line',
    title: 'Betting Trends',
    description: 'NBA situational trends, ATS records',
    gradient: ['#8B5CF6', '#A78BFA'] as const,
  },
  {
    icon: 'scoreboard',
    title: 'Live Scoreboard',
    description: 'Real-time scores with prediction overlay',
    gradient: ['#10B981', '#34D399'] as const,
  },
  {
    icon: 'clipboard-check',
    title: 'Bet Slip Grader',
    description: 'Grade your parlays before placing',
    gradient: ['#F59E0B', '#FBBF24'] as const,
  },
] as const;

function FeatureCard({ feature }: { feature: typeof FEATURES[number] }) {
  const theme = useTheme();

  return (
    <LinearGradient
      colors={feature.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.featureCard}
    >
      <View style={styles.featureIconContainer}>
        <MaterialCommunityIcons name={feature.icon as any} size={24} color="#fff" />
      </View>
      <Text style={styles.featureTitle}>{feature.title}</Text>
      <Text style={styles.featureDesc}>{feature.description}</Text>
    </LinearGradient>
  );
}

export function Slide6_MoreFeatures() {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  return (
    <View style={styles.container}>
      {/* 2x2 grid of feature cards */}
      <View style={styles.gridContainer}>
        <View style={styles.gridRow}>
          <FeatureCard feature={FEATURES[0]} />
          <FeatureCard feature={FEATURES[1]} />
        </View>
        <View style={styles.gridRow}>
          <FeatureCard feature={FEATURES[2]} />
          <FeatureCard feature={FEATURES[3]} />
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  gridContainer: {
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  featureCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 110,
    justifyContent: 'flex-start',
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 15,
  },
});
