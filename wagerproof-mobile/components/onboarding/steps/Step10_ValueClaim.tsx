import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
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
  // Initialize directly - LottieView is loaded synchronously at module level
  const useLottie = !!LottieView;

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    nextStep();
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Stop guessing.
      </Text>
      
      <Text style={[styles.description, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        Users report cutting research time and "wasting less on dumb bets." (their words not ours)
      </Text>
      
      {/* Animation or Fallback */}
      <View style={styles.animationContainer}>
        {useLottie && LottieView ? (
          <LottieView
            source={require('../../../assets/statistics-animation.json')}
            autoPlay
            loop={false}
            style={styles.animation}
          />
        ) : (
          // Fallback Stats
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
      
      <Button onPress={handleContinue} fullWidth variant="glass" forceDarkMode>
        Continue
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    marginBottom: 18,
    textAlign: 'center',
    lineHeight: 20,
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

