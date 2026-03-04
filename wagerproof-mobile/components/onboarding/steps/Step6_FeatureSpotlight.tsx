import React from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { onboardingCta } from '../onboardingStyles';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { NFLGameCard } from '../../NFLGameCard';
import { NFLPrediction } from '@/types/nfl';

const DUMMY_GAMES: NFLPrediction[] = [
  {
    id: 'onboarding-1',
    away_team: 'Kansas City',
    home_team: 'Buffalo',
    home_ml: 135,
    away_ml: -155,
    home_spread: 2.5,
    away_spread: -2.5,
    over_line: 47.5,
    game_date: '2025-01-26',
    game_time: '18:30:00',
    training_key: 'demo',
    unique_id: 'demo-1',
    home_away_ml_prob: 0.42,
    home_away_spread_cover_prob: 0.72,
    ou_result_prob: 0.65,
    run_id: null,
    temperature: null,
    precipitation: null,
    wind_speed: null,
    icon: null,
    spread_splits_label: null,
    total_splits_label: null,
    ml_splits_label: null,
  },
  {
    id: 'onboarding-2',
    away_team: 'San Francisco',
    home_team: 'Dallas',
    home_ml: 120,
    away_ml: -140,
    home_spread: 2.5,
    away_spread: -2.5,
    over_line: 49.5,
    game_date: '2025-01-26',
    game_time: '16:00:00',
    training_key: 'demo',
    unique_id: 'demo-2',
    home_away_ml_prob: 0.38,
    home_away_spread_cover_prob: 0.58,
    ou_result_prob: 0.82,
    run_id: null,
    temperature: null,
    precipitation: null,
    wind_speed: null,
    icon: null,
    spread_splits_label: null,
    total_splits_label: null,
    ml_splits_label: null,
  },
];

export function FeatureSpotlight() {
  const { nextStep } = useOnboarding();
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const cardWidth = (width - 32 - 8) / 2;

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    nextStep();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          AI-Powered Predictions
        </Text>

        <Text style={styles.description}>
          Get model-driven picks with confidence scores for every game. Our AI analyzes thousands of data points to find value.
        </Text>

        <View style={styles.cardsContainer}>
          {DUMMY_GAMES.map((game) => (
            <NFLGameCard
              key={game.id}
              game={game}
              onPress={() => {}}
              cardWidth={cardWidth}
              forceDarkMode
            />
          ))}
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
    paddingHorizontal: 16,
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
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
});
