import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

const sources = [
  'TikTok',
  'X/Twitter',
  'YouTube',
  'Google',
  'Friend/Referral',
  'Other',
];

export function AcquisitionSource() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const theme = useTheme();
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const handleSelect = (source: string) => {
    setSelectedSource(source);
  };

  const handleNext = () => {
    if (selectedSource) {
      updateOnboardingData({ acquisitionSource: selectedSource });
      nextStep();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Where did you hear about us?
      </Text>
      
      <View style={styles.grid}>
        {sources.map((source) => (
          <Button
            key={source}
            onPress={() => handleSelect(source)}
            variant={selectedSource === source ? 'primary' : 'outline'}
            style={styles.sourceButton}
          >
            {source}
          </Button>
        ))}
      </View>
      
      <Button 
        onPress={handleNext} 
        disabled={!selectedSource} 
        fullWidth
      >
        Continue
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  sourceButton: {
    marginHorizontal: 4,
    marginVertical: 4,
  },
});

