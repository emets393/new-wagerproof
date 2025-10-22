import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function Paywall() {
  const { submitOnboardingData } = useOnboarding();
  const theme = useTheme();
  const router = useRouter();

  const handleContinue = async () => {
    try {
      console.log('Starting onboarding completion...');
      await submitOnboardingData();
      console.log('Onboarding data submitted, navigating to main app...');
      // Small delay to ensure database update completes
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 500);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Still navigate even if there's an error, but log it
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Free for you—enter now
      </Text>
      
      <Text style={[styles.description, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        Early access applies to your account. Enjoy WagerProof and share with a friend!
      </Text>
      
      <Button onPress={handleContinue} fullWidth>
        Continue to App (Free)
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    marginBottom: 48,
    textAlign: 'center',
    lineHeight: 24,
  },
});

