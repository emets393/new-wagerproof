import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { TextInput } from '../../ui/TextInput';
import { onboardingCta } from '../onboardingStyles';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function AgeConfirmation() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const theme = useTheme();
  const [age, setAge] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    const ageNumber = parseInt(age, 10);
    if (ageNumber && ageNumber >= 18) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateOnboardingData({ age: ageNumber });
      nextStep();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setError('You must be 18 or older to continue.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Confirm your age
        </Text>

        <Text style={styles.description}>
          WagerProof provides analytics for educational use only. You must be 18+ to continue.
        </Text>

        <TextInput
          label="Age"
          value={age}
          onChangeText={(text) => {
            setAge(text);
            setError(null);
          }}
          placeholder="Enter your age"
          keyboardType="numeric"
          error={error || undefined}
          forceDarkMode
        />
      </ScrollView>

      <View style={onboardingCta.fixedBottom}>
        <Button
          onPress={handleNext}
          disabled={!age}
          fullWidth
          variant="glass"
          forceDarkMode
          style={onboardingCta.button}
        >
          Continue
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 36,
  },
  description: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
    paddingHorizontal: 8,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
