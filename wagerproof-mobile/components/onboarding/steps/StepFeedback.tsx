import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function FeedbackStep() {
  const { nextStep } = useOnboarding();
  const theme = useTheme();

  const handleYes = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const isAvailable = await StoreReview.isAvailableAsync();
    if (isAvailable) {
      await StoreReview.requestReview();
    }
    nextStep();
  };

  const handleNotNow = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    nextStep();
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name="message-text-outline"
          size={64}
          color="#00E676"
        />
      </View>

      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Would you leave us some early feedback?
      </Text>

      <Text style={styles.subtitle}>
        Your feedback helps us build a better app for you!
      </Text>

      <View style={styles.buttonContainer}>
        <Button
          onPress={handleYes}
          fullWidth
          variant="glass"
          forceDarkMode
          style={styles.button}
        >
          Yes, I'd love to!
        </Button>

        <Button
          onPress={handleNotNow}
          fullWidth
          variant="outline"
          forceDarkMode
          style={[styles.button, styles.outlineButton]}
        >
          Not now
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 'auto',
  },
  button: {
    marginBottom: 0,
  },
  outlineButton: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
});
