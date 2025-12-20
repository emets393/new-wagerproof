import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { TextInput } from '../../ui/TextInput';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { useAuth } from '../../../contexts/AuthContext';

export function EmailOptIn() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const { user } = useAuth();
  const theme = useTheme();
  const [optIn, setOptIn] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleToggleOptIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOptIn(!optIn);
  };

  const handleNext = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateOnboardingData({ 
      emailOptIn: optIn, 
      phoneNumber: optIn ? phoneNumber : undefined 
    });
    nextStep();
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Want picks in your inbox?
      </Text>
      
      <Text style={[styles.description, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        Get daily model summaries, edge alerts, and pre-game updates.
      </Text>
      
      <TouchableOpacity 
        style={styles.checkboxContainer}
        onPress={handleToggleOptIn}
      >
        <MaterialCommunityIcons 
          name={optIn ? "checkbox-marked" : "checkbox-blank-outline"} 
          size={24} 
          color={theme.colors.primary} 
        />
        <Text style={[styles.checkboxLabel, { color: theme.colors.onBackground }]}>
          Yes, sign me up!
        </Text>
      </TouchableOpacity>
      
      {optIn && (
        <View style={styles.inputsContainer}>
          <TextInput
            label="Email"
            value={user?.email || ''}
            onChangeText={() => {}}
            editable={false}
            forceDarkMode
          />
          <TextInput
            label="Phone Number (optional)"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            forceDarkMode
          />
        </View>
      )}
      
      <Button onPress={handleNext} fullWidth variant="glass" forceDarkMode>
        Next
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
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 16,
  },
  inputsContainer: {
    marginBottom: 24,
    gap: 16,
  },
});

