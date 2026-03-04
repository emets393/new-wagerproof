import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { Button } from '../../ui/Button';
import { onboardingCta } from '../onboardingStyles';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function DataTransparency() {
  const theme = useTheme();
  const { nextStep } = useOnboarding();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const requestATT = async () => {
      if (Platform.OS !== 'ios') return;

      try {
        const { status } = await getTrackingPermissionsAsync();
        if (status === 'undetermined') {
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          One quick thing
        </Text>

        <Text style={styles.description}>
          Please tap <Text style={styles.allowText}>Allow</Text> so that we can
          prevent you from seeing advertising in the future and also find more
          users that would like to use the app.
        </Text>

        {/* ATT Pop-up Mockup */}
        <View style={styles.attMockup}>
          <View style={styles.attIconRow}>
            <View style={styles.appIcon}>
              <MaterialCommunityIcons name="chart-line" size={28} color="#22c55e" />
            </View>
          </View>

          <Text style={styles.attTitle}>
            Allow "WagerProof" to track your{'\n'}activity across other companies'{'\n'}apps and websites?
          </Text>

          <Text style={styles.attBody}>
            Your data will be used to deliver personalized ads to you.
          </Text>

          <View style={styles.attDivider} />

          <View style={styles.attButton}>
            <Text style={styles.attButtonTextAllow}>Allow</Text>
          </View>

          <View style={styles.attDivider} />

          <View style={styles.attButton}>
            <Text style={styles.attButtonText}>Ask App Not to Track</Text>
          </View>
        </View>

        <View style={styles.hintRow}>
          <MaterialCommunityIcons name="arrow-up" size={18} color="rgba(255,255,255,0.5)" />
          <Text style={styles.hintText}>Tap Allow when the pop-up appears</Text>
        </View>
      </ScrollView>

      <View style={onboardingCta.fixedBottom}>
        <Button onPress={handleContinue} fullWidth variant="glass" forceDarkMode style={onboardingCta.button} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Continue'}
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
    marginBottom: 14,
    textAlign: 'center',
    lineHeight: 36,
  },
  description: {
    fontSize: 16,
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 8,
  },
  allowText: {
    color: '#22c55e',
    fontWeight: '700',
  },
  attMockup: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  attIconRow: {
    marginBottom: 12,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0f1117',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  attBody: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  attDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    width: '100%',
  },
  attButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  attButtonTextAllow: {
    fontSize: 17,
    fontWeight: '600',
    color: '#22c55e',
  },
  attButtonText: {
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  hintText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
