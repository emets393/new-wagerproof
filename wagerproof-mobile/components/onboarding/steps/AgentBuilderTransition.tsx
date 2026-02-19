import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { Sport } from '@/types/agent';

// Map onboarding sport names to agent Sport type
const SPORT_MAP: Record<string, Sport> = {
  'NFL': 'nfl',
  'College Football': 'cfb',
  'NBA': 'nba',
  'NCAAB': 'ncaab',
};

export function AgentBuilderTransition() {
  const { nextStep, onboardingData, updateAgentFormState } = useOnboarding();
  const theme = useTheme();

  // Pre-fill agent sports from onboarding sports selection
  useEffect(() => {
    const selectedSports = (onboardingData.favoriteSports || [])
      .map((s) => SPORT_MAP[s])
      .filter(Boolean) as Sport[];

    // Default to NFL if no supported sports were selected
    const sports = selectedSports.length > 0 ? selectedSports : ['nfl' as Sport];
    updateAgentFormState('preferred_sports', sports);
  }, []);

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    nextStep();
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="robot-happy-outline" size={64} color="#00E676" />
        </View>
      </View>

      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Create your first agent now
      </Text>

      <Text style={styles.subtitle}>
        Build a personalized AI picks expert in just a few steps. Choose its style, personality, and strategy — then let it go to work for you.
      </Text>

      <View style={styles.stepsPreview}>
        {[
          { icon: 'football' as const, text: 'Pick your sports & style' },
          { icon: 'palette-outline' as const, text: 'Give it a name & look' },
          { icon: 'tune-vertical' as const, text: 'Tune its personality' },
          { icon: 'rocket-launch-outline' as const, text: 'Launch & get picks' },
        ].map((step, index) => (
          <View key={index} style={styles.stepRow}>
            <View style={styles.stepBadge}>
              <MaterialCommunityIcons name={step.icon} size={20} color="#00E676" />
            </View>
            <Text style={styles.stepText}>{step.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <Button onPress={handleContinue} fullWidth variant="glass" forceDarkMode>
          Let's Build It
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(0, 230, 118, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 22,
  },
  stepsPreview: {
    gap: 16,
    marginBottom: 32,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stepText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    flex: 1,
  },
  buttonContainer: {
    marginTop: 'auto',
  },
});
