import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useOnboarding } from '../../../contexts/OnboardingContext';

const goals = [
  'Find profitable edges faster',
  'Analyze data to improve strategy',
  'Track my performance over time',
  'Get timely alerts for model picks',
];

export function PrimaryGoalSelection() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const theme = useTheme();
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  const handleSelect = (goal: string) => {
    setSelectedGoal(goal);
  };

  const handleNext = () => {
    if (selectedGoal) {
      updateOnboardingData({ mainGoal: selectedGoal });
      nextStep();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        What's your main goal?
      </Text>
      
      <View style={styles.cardsContainer}>
        {goals.map((goal) => (
          <Card
            key={goal}
            onPress={() => handleSelect(goal)}
            selected={selectedGoal === goal}
            style={styles.card}
          >
            <Text style={[styles.cardText, { color: theme.colors.onBackground }]}>
              {goal}
            </Text>
          </Card>
        ))}
      </View>
      
      <Button 
        onPress={handleNext} 
        disabled={!selectedGoal} 
        fullWidth
      >
        Next
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
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
  cardText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

