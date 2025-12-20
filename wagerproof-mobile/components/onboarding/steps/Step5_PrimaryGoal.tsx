import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useOnboarding } from '../../../contexts/OnboardingContext';

const goals = [
  { text: 'Find profitable edges faster', icon: 'lightning-bolt' },
  { text: 'Analyze data to improve strategy', icon: 'chart-line' },
  { text: 'Track my performance over time', icon: 'trending-up' },
  { text: 'Get timely alerts for model picks', icon: 'bell-alert' },
];

export function PrimaryGoalSelection() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const theme = useTheme();
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  const handleSelect = (goal: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGoal(goal);
  };

  const handleNext = () => {
    if (selectedGoal) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
            key={goal.text}
            onPress={() => handleSelect(goal.text)}
            selected={selectedGoal === goal.text}
            style={styles.card}
          >
            <View style={styles.cardContent}>
              <MaterialCommunityIcons
                name={goal.icon as any}
                size={24}
                color={selectedGoal === goal.text ? '#22c55e' : theme.colors.onBackground}
                style={styles.icon}
              />
              <Text style={[styles.cardText, { color: theme.colors.onBackground }]}>
                {goal.text}
              </Text>
            </View>
          </Card>
        ))}
      </View>
      
      <Button
        onPress={handleNext}
        disabled={!selectedGoal}
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
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  icon: {
    marginRight: 12,
    marginLeft: 4,
  },
  cardText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
    flex: 1,
  },
});

