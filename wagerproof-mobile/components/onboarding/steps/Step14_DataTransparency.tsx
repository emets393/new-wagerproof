import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { Button } from '../../ui/Button';
import { usePaywallSheet } from '../../../app/(onboarding)/index';

export function DataTransparency() {
  const { openPaywallSheet } = usePaywallSheet();
  const theme = useTheme();

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    openPaywallSheet();
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
      
      <Button onPress={handleContinue} fullWidth variant="glass" forceDarkMode>
        Continue
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

