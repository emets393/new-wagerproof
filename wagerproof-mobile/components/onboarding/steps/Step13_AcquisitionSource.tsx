import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { onboardingCta } from '../onboardingStyles';
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
  const { nextStep, isTransitioning, updateOnboardingData } = useOnboarding();
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
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
      </ScrollView>

      <View style={onboardingCta.fixedBottom}>
        <Button
          onPress={handleNext}
          disabled={!selectedSource}
          fullWidth
          variant="glass"
          forceDarkMode
          loading={isTransitioning}
          style={onboardingCta.button}
        >
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
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 100,
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
    marginBottom: 32,
  },
  sourceButton: {
    marginHorizontal: 4,
    marginVertical: 4,
  },
});
