import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { onboardingCta } from '../onboardingStyles';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { PixelOffice } from '../../agents/PixelOffice';
import { AgentWithPerformance } from '@/types/agent';

const screenWidth = Dimensions.get('window').width;

const DEMO_AGENTS: AgentWithPerformance[] = [
  {
    id: 'demo-1', name: 'Sharp Edge', avatar_emoji: '🦅', avatar_color: '#3b82f6',
    preferred_sports: ['nba'], is_active: true, auto_generate: true,
    auto_generate_time: '09:00', auto_generate_timezone: 'America/New_York',
    performance: { wins: 42, losses: 28, pushes: 2, total_picks: 72, net_units: 8.5, win_rate: 0.58, current_streak: 3, best_streak: 7, worst_streak: -4, roi: 11.8, last_calculated_at: '' },
  } as any,
  {
    id: 'demo-2', name: 'Taco King', avatar_emoji: '🌮', avatar_color: '#f59e0b',
    preferred_sports: ['nfl'], is_active: true, auto_generate: true,
    auto_generate_time: '09:00', auto_generate_timezone: 'America/New_York',
    performance: { wins: 35, losses: 30, pushes: 1, total_picks: 66, net_units: 2.1, win_rate: 0.53, current_streak: -1, best_streak: 5, worst_streak: -3, roi: 3.2, last_calculated_at: '' },
  } as any,
  {
    id: 'demo-3', name: 'Data Bot', avatar_emoji: '🤖', avatar_color: '#8b5cf6',
    preferred_sports: ['nba', 'nfl'], is_active: true, auto_generate: true,
    auto_generate_time: '09:00', auto_generate_timezone: 'America/New_York',
    performance: { wins: 50, losses: 22, pushes: 3, total_picks: 75, net_units: 15.3, win_rate: 0.67, current_streak: 5, best_streak: 9, worst_streak: -2, roi: 20.4, last_calculated_at: '' },
  } as any,
  {
    id: 'demo-4', name: 'Moneyline', avatar_emoji: '💰', avatar_color: '#10b981',
    preferred_sports: ['mlb'], is_active: true, auto_generate: true,
    auto_generate_time: '09:00', auto_generate_timezone: 'America/New_York',
    performance: { wins: 28, losses: 25, pushes: 0, total_picks: 53, net_units: -1.2, win_rate: 0.53, current_streak: -2, best_streak: 4, worst_streak: -5, roi: -2.3, last_calculated_at: '' },
  } as any,
];

export function AgentValue1_247() {
  const { nextStep, isTransitioning } = useOnboarding();
  const theme = useTheme();

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    nextStep();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.officeContainer}>
          <PixelOffice agents={DEMO_AGENTS} startAtDesks hideControls />
        </View>

        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Now lets create an agent that works for you 24/7
        </Text>

        <Text style={styles.subtitle}>
          Your AI picks expert never sleeps. It scans every game, every line, and every edge — so you don't have to.
        </Text>
      </ScrollView>

      <View style={onboardingCta.fixedBottom}>
        <Button onPress={handleContinue} fullWidth variant="glass" forceDarkMode style={onboardingCta.button} loading={isTransitioning}>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  officeContainer: {
    width: screenWidth - 32,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 36,
    paddingHorizontal: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
});
