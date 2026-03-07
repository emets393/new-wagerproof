import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { onboardingCta } from '../onboardingStyles';
import { useOnboarding } from '../../../contexts/OnboardingContext';

interface BulletPoint {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  text: string;
}

interface AgentValueScreenProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  lottieSource?: any;
  lottieSize?: number;
  topPadding?: number;
  title: string;
  subtitle: string;
  bullets?: BulletPoint[];
}

export function AgentValueScreen({
  icon,
  iconColor = '#00E676',
  lottieSource,
  lottieSize = 130,
  topPadding = 40,
  title,
  subtitle,
  bullets,
}: AgentValueScreenProps) {
  const { nextStep, isTransitioning } = useOnboarding();
  const theme = useTheme();

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    nextStep();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding }]} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.iconContainer}>
          {lottieSource ? (
            <LottieView
              source={lottieSource}
              autoPlay
              loop
              style={[styles.lottie, { width: lottieSize, height: lottieSize }]}
            />
          ) : (
            <MaterialCommunityIcons name={icon} size={80} color={iconColor} />
          )}
        </View>

        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          {title}
        </Text>

        <Text style={styles.subtitle}>
          {subtitle}
        </Text>

        {bullets && bullets.length > 0 && (
          <View style={styles.bulletsContainer}>
            {bullets.map((bullet, index) => (
              <View key={index} style={styles.bulletRow}>
                <MaterialCommunityIcons
                  name={bullet.icon}
                  size={22}
                  color={iconColor}
                  style={styles.bulletIcon}
                />
                <Text style={styles.bulletText}>{bullet.text}</Text>
              </View>
            ))}
          </View>
        )}
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
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  lottie: {
    width: 130,
    height: 130,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  bulletsContainer: {
    marginBottom: 32,
    gap: 16,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletIcon: {
    marginRight: 12,
    marginTop: 1,
  },
  bulletText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 22,
    flex: 1,
  },
});
