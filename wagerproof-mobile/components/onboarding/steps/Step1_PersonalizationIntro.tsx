import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { onboardingCta } from '../onboardingStyles';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function PersonalizationIntro() {
  const { nextStep, isTransitioning } = useOnboarding();
  const theme = useTheme();

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    nextStep();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Welcome!
        </Text>

        <Text style={styles.subtitle}>
          Let's personalize your experience.
        </Text>

        <LottieView
          source={require('../../../assets/face-recognition-mobile.json')}
          autoPlay
          loop
          style={styles.lottie}
        />

        <Text style={styles.description}>
          Answer a few quick questions so we can tune your dashboard and picks.
        </Text>
      </ScrollView>

      <View style={onboardingCta.fixedBottom}>
        <Button onPress={handleContinue} fullWidth variant="glass" forceDarkMode style={onboardingCta.button} loading={isTransitioning}>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  lottie: {
    width: 280,
    height: 280,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  description: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
