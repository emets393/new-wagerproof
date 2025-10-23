import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function DiscordCommunity() {
  const { nextStep } = useOnboarding();
  const theme = useTheme();

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    nextStep();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name="chat" size={80} color="#5865F2" />
      </View>

      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Join Our Private Community
      </Text>
      
      <Text style={[styles.description, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        WagerProof members get exclusive free access to our private Discord community.
      </Text>

      <View style={styles.benefitsContainer}>
        <View style={styles.benefitItem}>
          <View style={styles.benefitIconContainer}>
            <MaterialCommunityIcons name="account-multiple" size={24} color="#22c55e" />
          </View>
          <View style={styles.benefitContent}>
            <Text style={[styles.benefitTitle, { color: theme.colors.onBackground }]}>
              Connect with Data-Driven Bettors
            </Text>
            <Text style={styles.benefitText}>
              Network with professional bettors using WagerProof
            </Text>
          </View>
        </View>

        <View style={styles.benefitItem}>
          <View style={styles.benefitIconContainer}>
            <MaterialCommunityIcons name="code-tags" size={24} color="#3b82f6" />
          </View>
          <View style={styles.benefitContent}>
            <Text style={[styles.benefitTitle, { color: theme.colors.onBackground }]}>
              Direct Access to Developers
            </Text>
            <Text style={styles.benefitText}>
              Ask questions and get support directly from our development team
            </Text>
          </View>
        </View>

        <View style={styles.benefitItem}>
          <View style={styles.benefitIconContainer}>
            <MaterialCommunityIcons name="lightbulb" size={24} color="#fbbf24" />
          </View>
          <View style={styles.benefitContent}>
            <Text style={[styles.benefitTitle, { color: theme.colors.onBackground }]}>
              Exclusive Insights & Strategies
            </Text>
            <Text style={styles.benefitText}>
              Share winning strategies and learn from the community's best bettors
            </Text>
          </View>
        </View>

        <View style={styles.benefitItem}>
          <View style={styles.benefitIconContainer}>
            <MaterialCommunityIcons name="bell" size={24} color="#ef4444" />
          </View>
          <View style={styles.benefitContent}>
            <Text style={[styles.benefitTitle, { color: theme.colors.onBackground }]}>
              Early Feature Access
            </Text>
            <Text style={styles.benefitText}>
              Be the first to test new tools and features before public release
            </Text>
          </View>
        </View>
      </View>

      <Button onPress={handleContinue} fullWidth variant="glass">
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
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
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
  benefitsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  benefitItem: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  benefitIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  benefitText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 16,
  },
});
