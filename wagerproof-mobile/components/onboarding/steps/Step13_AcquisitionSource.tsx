import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

const sources = [
  'TikTok',
  'X/Twitter',
  'YouTube',
  'Google',
  'Friend/Referral',
  'Other',
];

export function AcquisitionSource() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const theme = useTheme();
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const handleSelect = (source: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSource(source);
  };

  const handleNext = () => {
    if (selectedSource) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateOnboardingData({ acquisitionSource: selectedSource });
      nextStep();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Where did you hear about us?
      </Text>
      
      <View style={styles.grid}>
        {sources.map((source) => (
          <Button
            key={source}
            onPress={() => handleSelect(source)}
            variant="glass"
            forceDarkMode
            selected={selectedSource === source}
            style={styles.sourceButton}
          >
            {source}
          </Button>
        ))}
      </View>
      
      <Button
        onPress={handleNext}
        disabled={!selectedSource}
        fullWidth
        variant="glass"
        forceDarkMode
      >
        Continue
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  sourceButton: {
    marginHorizontal: 4,
    marginVertical: 4,
  },
});

