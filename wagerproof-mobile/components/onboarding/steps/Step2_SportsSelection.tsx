import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { onboardingCta } from '../onboardingStyles';
import { useOnboarding } from '../../../contexts/OnboardingContext';

const sportsOptions = [
  'NFL',
  'College Football',
  'NBA',
  'MLB',
  'NCAAB',
  'Soccer',
  'Other',
];

export function SportsSelection() {
  const { nextStep, isTransitioning, updateOnboardingData } = useOnboarding();
  const theme = useTheme();
  const [selectedSports, setSelectedSports] = useState<string[]>([]);

  const handleToggleSport = (sport: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSports((prev) =>
      prev.includes(sport)
        ? prev.filter((s) => s !== sport)
        : [...prev, sport]
    );
  };

  const handleNext = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateOnboardingData({ favoriteSports: selectedSports });
    nextStep();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Which sports do you follow most?
        </Text>

        <View style={styles.grid}>
          {sportsOptions.map((sport) => (
            <Button
              key={sport}
              onPress={() => handleToggleSport(sport)}
              variant="glass"
              forceDarkMode
              selected={selectedSports.includes(sport)}
              style={styles.sportButton}
            >
              {sport}
            </Button>
          ))}
        </View>

        <Text style={styles.hint}>
          You can change this later in Settings.
        </Text>
      </ScrollView>

      <View style={onboardingCta.fixedBottom}>
        <Button onPress={handleNext} fullWidth variant="glass" forceDarkMode style={onboardingCta.button} loading={isTransitioning}>
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
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 36,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  sportButton: {
    marginHorizontal: 4,
    marginVertical: 4,
  },
  hint: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
