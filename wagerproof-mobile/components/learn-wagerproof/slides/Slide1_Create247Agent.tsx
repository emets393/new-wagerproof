import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';

let LottieView: any = null;
try {
  LottieView = require('lottie-react-native').default;
} catch (e) {
  console.log('Lottie not available on this platform, using fallback.');
}

const WAGERPROOF_GREEN = '#00E676';

const BULLETS = [
  {
    icon: 'robot-outline',
    title: 'Build multiple agents',
    description: 'Create as many agents as you want, each with a different betting strategy.',
  },
  {
    icon: 'clock-outline',
    title: '24/7 research',
    description: 'Your agents continuously research games and surface picks around the clock.',
  },
  {
    icon: 'trophy-outline',
    title: 'Global leaderboard',
    description: "View the world's best agents, their records, and their latest picks.",
  },
];

export function Slide1_Create247Agent() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const useLottie = !!LottieView;

  return (
    <View style={styles.container}>
      <View style={[styles.animationCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        {useLottie && LottieView ? (
          <LottieView
            source={require('@/assets/RobotAnalyzing.json')}
            autoPlay
            loop
            style={styles.lottie}
          />
        ) : (
          <MaterialCommunityIcons name="robot-outline" size={72} color={WAGERPROOF_GREEN} />
        )}
      </View>

      <View style={styles.bulletsContainer}>
        {BULLETS.map((item) => (
          <View
            key={item.title}
            style={[styles.bulletCard, { backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }]}
          >
            <View style={styles.bulletHeader}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name={item.icon as any} size={16} color={WAGERPROOF_GREEN} />
              </View>
              <Text style={[styles.bulletTitle, { color: theme.colors.onSurface }]}>
                {item.title}
              </Text>
            </View>
            <Text style={[styles.bulletDescription, { color: theme.colors.onSurfaceVariant }]}>
              {item.description}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  animationCard: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 10,
    minHeight: 150,
  },
  lottie: {
    width: 170,
    height: 170,
  },
  bulletsContainer: {
    gap: 8,
  },
  bulletCard: {
    borderRadius: 12,
    padding: 10,
  },
  bulletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.14)',
  },
  bulletTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  bulletDescription: {
    fontSize: 11,
    lineHeight: 16,
  },
});
