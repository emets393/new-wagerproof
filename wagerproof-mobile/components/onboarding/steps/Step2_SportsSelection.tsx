import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Vibration } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Button } from '../../ui/Button';
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
  const { nextStep, updateOnboardingData } = useOnboarding();
  const theme = useTheme();
  const [selectedSports, setSelectedSports] = useState<string[]>([]);

  const handleToggleSport = (sport: string) => {
    Vibration.vibrate([0, 10, 10]);
    setSelectedSports((prev) =>
      prev.includes(sport)
        ? prev.filter((s) => s !== sport)
        : [...prev, sport]
    );
  };

  const handleNext = () => {
    Vibration.vibrate([0, 15, 10, 15]);
    updateOnboardingData({ favoriteSports: selectedSports });
    nextStep();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Which sports do you follow most?
      </Text>
      
      <View style={styles.grid}>
        {sportsOptions.map((sport) => (
          <Button
            key={sport}
            onPress={() => handleToggleSport(sport)}
            variant="glass"
            selected={selectedSports.includes(sport)}
            style={styles.sportButton}
          >
            {sport}
          </Button>
        ))}
      </View>
      
      <Text style={[styles.hint, { color: 'rgba(255, 255, 255, 0.7)' }]}>
        You can change this later in Settings.
      </Text>
      
      <Button onPress={handleNext} fullWidth variant="glass">
        Next
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
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
  },
});

