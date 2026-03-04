import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { onboardingCta } from '../onboardingStyles';
import { useOnboarding } from '../../../contexts/OnboardingContext';

type BettorType = 'casual' | 'serious' | 'professional';

const bettorTypes: { type: BettorType; title: string; description: string }[] = [
  { type: 'casual', title: 'Casual', description: 'Occasional bets' },
  { type: 'serious', title: 'Serious', description: 'Research lines and trends' },
  { type: 'professional', title: 'Professional', description: 'Track units and ROI' },
];

export function BettorTypeSelection() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const theme = useTheme();
  const [selectedType, setSelectedType] = useState<BettorType | null>(null);

  const handleSelect = (type: BettorType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType(type);
  };

  const handleNext = () => {
    if (selectedType) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateOnboardingData({ bettorType: selectedType });
      nextStep();
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          What kind of bettor are you?
        </Text>

        <View style={styles.cardsContainer}>
          {bettorTypes.map(({ type, title, description }) => (
            <Card
              key={type}
              onPress={() => handleSelect(type)}
              selected={selectedType === type}
              style={styles.card}
            >
              <Text style={[styles.cardTitle, { color: theme.colors.onBackground }]}>
                {title}
              </Text>
              <Text style={styles.cardDescription}>
                {description}
              </Text>
            </Card>
          ))}
        </View>
      </ScrollView>

      <View style={onboardingCta.fixedBottom}>
        <Button
          onPress={handleNext}
          disabled={!selectedType}
          fullWidth
          variant="glass"
          forceDarkMode
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
  cardsContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  card: {
    width: '100%',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
