import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { useRevenueCat } from '../../../contexts/RevenueCatContext';
import { presentPaywall } from '../../../services/revenuecat';

export function DataTransparency() {
  const theme = useTheme();
  const router = useRouter();
  const { submitOnboardingData } = useOnboarding();
  const { refreshCustomerInfo } = useRevenueCat();
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

  const handleCompletion = async () => {
    try {
      console.log('Starting onboarding completion...');
      await submitOnboardingData();
      console.log('Onboarding data submitted successfully!');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const handleContinue = async () => {
    if (isLoading) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsLoading(true);

    try {
      console.log('Presenting RevenueCat paywall...');
      const result = await presentPaywall();
      console.log('Paywall result:', result);

      // Refresh customer info to ensure entitlements are up to date if purchase was made
      console.log('🔄 Refreshing customer info after paywall...');
      await refreshCustomerInfo();
      console.log('✅ Customer info refreshed');

      // Handle paywall result - complete onboarding regardless of purchase
      // User can subscribe later from settings
      await handleCompletion();
    } catch (error: any) {
      console.error('Error presenting paywall:', error);

      // If paywall fails to present, still allow user to continue
      Alert.alert(
        'Continue to App',
        'Would you like to continue to the app? You can subscribe anytime from Settings.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsLoading(false) },
          { text: 'Continue', onPress: handleCompletion },
        ]
      );
      return;
    }

    setIsLoading(false);
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
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  lottieContainer: {
    alignItems: 'center',
    marginBottom: 32,
    height: 300,
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
});

