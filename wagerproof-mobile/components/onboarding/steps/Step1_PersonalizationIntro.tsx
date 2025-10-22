import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function PersonalizationIntro() {
  const { nextStep } = useOnboarding();
  const theme = useTheme();

  const handleContinue = () => {
    console.log('Continue button clicked!');
    nextStep();
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Welcome!
      </Text>
      
      <Text style={[styles.subtitle, { color: theme.colors.onBackground }]}>
        Let's personalize your experience.
      </Text>
      
      <Text style={[styles.description, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        Answer a few quick questions so we can tune your dashboard and picks.
      </Text>
      
      <Button onPress={handleContinue} fullWidth>
        Continue
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});

