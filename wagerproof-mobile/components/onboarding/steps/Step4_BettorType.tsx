import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
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
    <ScrollView contentContainerStyle={styles.container}>
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
            <Text style={[styles.cardDescription, { color: 'rgba(255, 255, 255, 0.7)' }]}>
              {description}
            </Text>
          </Card>
        ))}
      </View>
      
      <Button
        onPress={handleNext}
        disabled={!selectedType}
        fullWidth
        variant="glass"
        forceDarkMode
      >
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
    marginBottom: 32,
    textAlign: 'center',
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
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
});

