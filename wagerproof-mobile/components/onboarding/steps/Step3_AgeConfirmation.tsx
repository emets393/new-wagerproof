import React, { useState } from 'react';
import { View, Text, StyleSheet, Vibration } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Button } from '../../ui/Button';
import { TextInput } from '../../ui/TextInput';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function AgeConfirmation() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const theme = useTheme();
  const [age, setAge] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    const ageNumber = parseInt(age, 10);
    if (ageNumber && ageNumber >= 18) {
      Vibration.vibrate([0, 15, 10, 15]);
      updateOnboardingData({ age: ageNumber });
      nextStep();
    } else {
      Vibration.vibrate([30, 30, 30]);
      setError('You must be 18 or older to continue.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Confirm your age
      </Text>
      
      <Text style={[styles.description, { color: 'rgba(255, 255, 255, 0.8)' }]}>
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
      />
      
      <Button 
        onPress={handleNext} 
        disabled={!age} 
        fullWidth
        variant="glass"
      >
        Continue
      </Button>
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});

