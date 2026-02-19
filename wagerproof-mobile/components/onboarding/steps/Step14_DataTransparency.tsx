import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function DataTransparency() {
  const theme = useTheme();
  const { nextStep } = useOnboarding();
  const [isLoading, setIsLoading] = useState(false);

  // Request App Tracking Transparency permission on iOS
  useEffect(() => {
    const requestATT = async () => {
      if (Platform.OS !== 'ios') return;

      try {
        const { status } = await getTrackingPermissionsAsync();
        if (status === 'undetermined') {
          // Small delay to ensure the view is fully rendered before showing the prompt
          setTimeout(async () => {
            const { status: newStatus } = await requestTrackingPermissionsAsync();
            console.log('ATT permission status:', newStatus);
          }, 500);
        } else {
          console.log('ATT permission already determined:', status);
        }
      } catch (error) {
        console.error('Error requesting ATT permission:', error);
      }
    };

    requestATT();
  }, []);

  const handleContinue = async () => {
    if (isLoading) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsLoading(true);

    try {
      nextStep();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        How we keep it fair
      </Text>

      <Text style={[styles.description, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        We pay for verified data feeds, public money splits, and historical stats. That's how we keep results honest and repeatable.
      </Text>

      <View style={styles.lottieContainer}>
        <LottieView
          source={require('../../../assets/Data Animation.json')}
          autoPlay
          loop
          style={styles.lottie}
        />
      </View>

      <Button onPress={handleContinue} fullWidth variant="glass" forceDarkMode disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Continue'}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 14,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  lottieContainer: {
    alignItems: 'center',
    marginBottom: 20,
    height: 210,
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
});
