import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { useRevenueCat } from '../../../contexts/RevenueCatContext';
import { presentPaywall } from '../../../services/revenuecat';

export function AgentAccessScreen() {
  const { nextStep, agentFormState, onboardingData } = useOnboarding();
  const { refreshCustomerInfo } = useRevenueCat();
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  const hasAgent = !!onboardingData.createdAgentId;

  const handleUnlock = async () => {
    if (isLoading) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsLoading(true);

    try {
      const result = await presentPaywall();
      console.log('Paywall result:', result);

      await refreshCustomerInfo();
      nextStep();
    } catch (error: any) {
      console.error('Error presenting paywall:', error);

      // If paywall fails, still allow user to continue
      Alert.alert(
        'Continue',
        'You can subscribe anytime from Settings.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsLoading(false) },
          { text: 'Continue', onPress: () => nextStep() },
        ]
      );
      return;
    }

    setIsLoading(false);
  };

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    nextStep();
  };

  return (
    <View style={styles.container}>
      {/* Celebration icon */}
      <View style={styles.celebrationContainer}>
        <MaterialCommunityIcons name="party-popper" size={48} color="#FFD700" />
      </View>

      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        {hasAgent ? 'Your agent is ready!' : 'Almost there!'}
      </Text>

      {/* Agent preview card */}
      {hasAgent && (
        <View style={styles.agentCard}>
          <View
            style={[
              styles.agentAvatar,
              { backgroundColor: `${agentFormState.avatar_color}30` },
            ]}
          >
            <Text style={styles.agentEmoji}>
              {agentFormState.avatar_emoji || '🤖'}
            </Text>
          </View>
          <Text style={styles.agentName}>
            {agentFormState.name || 'Your Agent'}
          </Text>
          <View style={styles.sportBadges}>
            {agentFormState.preferred_sports.map((sport) => (
              <View key={sport} style={styles.sportBadge}>
                <Text style={styles.sportBadgeText}>{sport.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text style={styles.subtitle}>
        {hasAgent
          ? 'Unlock Pro to start receiving daily AI picks from your agent and track its performance over time.'
          : 'Upgrade to Pro to create AI agents that generate picks for you every day.'}
      </Text>

      <View style={styles.benefitsList}>
        {[
          'Daily AI-generated picks',
          'Performance tracking & analytics',
          'Up to 5 custom agents',
          'Global leaderboard access',
        ].map((benefit, index) => (
          <View key={index} style={styles.benefitRow}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#00E676" />
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        {hasAgent ? (
          <Button
            onPress={handleUnlock}
            fullWidth
            variant="glass"
            forceDarkMode
            disabled={isLoading}
            loading={isLoading}
          >
            Unlock Your Agent
          </Button>
        ) : (
          <Button onPress={handleContinue} fullWidth variant="glass" forceDarkMode>
            Continue
          </Button>
        )}
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
  celebrationContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  agentCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  agentAvatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  agentEmoji: {
    fontSize: 36,
  },
  agentName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },
  sportBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  sportBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  sportBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsList: {
    gap: 14,
    marginBottom: 32,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  buttonContainer: {
    marginTop: 'auto',
  },
});
