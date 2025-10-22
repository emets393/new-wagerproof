import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTheme, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function Paywall() {
  const { submitOnboardingData } = useOnboarding();
  const theme = useTheme();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (isSubmitting) return; // Prevent double submission
    
    setIsSubmitting(true);
    try {
      console.log('Starting onboarding completion...');
      await submitOnboardingData();
      console.log('Onboarding data submitted successfully!');
      
      // Give a brief moment for the database to propagate
      setTimeout(() => {
        console.log('Navigating to main app...');
        router.replace('/(tabs)');
      }, 300);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsSubmitting(false);
      
      // Show error to user
      Alert.alert(
        'Oops!',
        'There was an issue completing your onboarding. Please try again.',
        [
          {
            text: 'Retry',
            onPress: handleContinue,
          },
          {
            text: 'Skip for now',
            onPress: () => router.replace('/(tabs)'),
            style: 'cancel',
          },
        ]
      );
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
      
      <Button onPress={handleContinue} fullWidth disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
            <Text style={{ color: '#fff' }}>Setting up your account...</Text>
          </>
        ) : (
          'Continue to App (Free)'
        )}
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

