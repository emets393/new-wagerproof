import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { onboardingCta } from '../onboardingStyles';
import { useOnboarding } from '../../../contexts/OnboardingContext';

let LottieView: any = null;
try {
  LottieView = require('lottie-react-native').default;
} catch (e) {
  console.log('Lottie not available, using fallback');
}

export function ValueClaim() {
  const { nextStep } = useOnboarding();
  const theme = useTheme();
  const useLottie = !!LottieView;

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    nextStep();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Stop guessing.
        </Text>

        <Text style={styles.description}>
          Users report cutting research time and "wasting less on dumb bets." (their words not ours)
        </Text>

        <View style={styles.animationContainer}>
          {useLottie && LottieView ? (
            <LottieView
              source={require('../../../assets/statistics-animation.json')}
              autoPlay
              loop={false}
              style={styles.animation}
            />
          ) : (
            <View style={[styles.statsContainer, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
              <View style={styles.statBox}>
                <MaterialCommunityIcons name="clock-fast" size={40} color={theme.colors.primary} />
                <Text style={[styles.statValue, { color: theme.colors.onBackground }]}>5x</Text>
                <Text style={styles.statLabel}>Faster Research</Text>
              </View>

              <View style={styles.statBox}>
                <MaterialCommunityIcons name="chart-line" size={40} color={theme.colors.primary} />
                <Text style={[styles.statValue, { color: theme.colors.onBackground }]}>68%</Text>
                <Text style={styles.statLabel}>Win Rate</Text>
              </View>

              <View style={styles.statBox}>
                <MaterialCommunityIcons name="target" size={40} color={theme.colors.primary} />
                <Text style={[styles.statValue, { color: theme.colors.onBackground }]}>12+</Text>
                <Text style={styles.statLabel}>Value Edges/Week</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={onboardingCta.fixedBottom}>
        <Button onPress={handleContinue} fullWidth variant="glass" forceDarkMode style={onboardingCta.button}>
          Continue
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 36,
  },
  description: {
    fontSize: 16,
    marginBottom: 18,
    textAlign: 'center',
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  animationContainer: {
    width: '100%',
    minHeight: 220,
    marginBottom: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animation: {
    width: '100%',
    height: 220,
  },
  statsContainer: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statValue: {
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
