import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Switch, Modal, TouchableOpacity, Animated } from 'react-native';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import * as StoreReview from 'expo-store-review';
import { useRouter } from 'expo-router';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { useThemeContext } from '@/contexts/ThemeContext';
import { Sport } from '@/types/agent';
import { useRevenueCat } from '../../../contexts/RevenueCatContext';
import { presentPaywall } from '../../../services/revenuecat';

const SPORT_ICONS: Record<Sport, string> = {
  nfl: 'football',
  cfb: 'shield-half-full',
  nba: 'basketball',
  ncaab: 'school',
};

function getPrimaryColor(value: string): string {
  if (value.startsWith('gradient:')) {
    return value.replace('gradient:', '').split(',')[0];
  }
  return value;
}

export function AgentBornStep() {
  const { currentStep, agentFormState, submitOnboardingData } = useOnboarding();
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const router = useRouter();
  const { refreshCustomerInfo } = useRevenueCat();
  const [isRevealComplete, setIsRevealComplete] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [isContinuing, setIsContinuing] = useState(false);
  const [revealRunId, setRevealRunId] = useState(0);
  const [pulseReady, setPulseReady] = useState(false);
  const primaryColor = getPrimaryColor(agentFormState.avatar_color || '#00E676');
  const researchPulse = React.useRef(new Animated.Value(0.55)).current;
  const elementsOpacity = React.useRef(new Animated.Value(0)).current;

  const handleContinue = async () => {
    if (isContinuing) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsContinuing(true);

    try {
      await presentPaywall();
      await refreshCustomerInfo();
    } catch (error: any) {
      console.error('Error presenting paywall:', error);
      // Continue even if paywall fails/cancels; user can subscribe later.
    }

    try {
      await submitOnboardingData();
      router.replace('/(tabs)' as any);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsContinuing(false);
    }
  };

  // Replay green intro whenever user lands on Agent Born.
  useEffect(() => {
    if (currentStep !== 22) return;
    setIsRevealComplete(false);
    setShowFeedbackModal(false);
    setRating(0);
    setPulseReady(false);
    setRevealRunId((prev) => prev + 1);
    elementsOpacity.setValue(0);

    // Keep reveal visible long enough to fully read as an intro.
    const revealTimeout = setTimeout(() => {
      setIsRevealComplete(true);
    }, 3000);

    // Start fading elements in 1s after reveal starts.
    const fadeInTimeout = setTimeout(() => {
      Animated.timing(elementsOpacity, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }).start();
    }, 1000);

    return () => {
      clearTimeout(revealTimeout);
      clearTimeout(fadeInTimeout);
    };
  }, [currentStep, elementsOpacity]);

  useEffect(() => {
    if (!isRevealComplete) return;
    const t = setTimeout(() => setPulseReady(true), 160);
    return () => clearTimeout(t);
  }, [isRevealComplete]);

  useEffect(() => {
    if (!isRevealComplete) return;
    const timeout = setTimeout(() => {
      setShowFeedbackModal(true);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [isRevealComplete]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(researchPulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(researchPulse, {
          toValue: 0.55,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [researchPulse]);

  const handleSkipFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFeedbackModal(false);
  };

  const handleSubmitFeedback = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (rating >= 4) {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
      }
    }
    setShowFeedbackModal(false);
  };

  return (
    <View style={styles.container}>
      <LottieView
        source={require('@/assets/WaveLinesAnimation.json')}
        autoPlay
        loop
        style={styles.backgroundLottie}
      />

      <Animated.View style={[styles.content, { opacity: elementsOpacity }]}>
        <Text style={styles.title}>Agent is Born!</Text>
        <Text style={styles.subtitle}>Your AI bettor is live and ready to cook.</Text>

        <View style={styles.feedCardWrap}>
          <View
            style={[
              styles.feedCardContainer,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.99)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.10)',
                borderLeftColor: primaryColor,
              },
            ]}
          >
            <View style={styles.agentHeader}>
              <View style={[styles.agentEmojiContainer, { backgroundColor: `${primaryColor}25` }]}>
                <Text style={styles.agentEmoji}>{agentFormState.avatar_emoji || '🤖'}</Text>
              </View>
              <View style={styles.agentInfo}>
                <View style={styles.agentTitleRow}>
                  <Text
                    style={[styles.agentName, { color: theme.colors.onSurface }]}
                    numberOfLines={1}
                  >
                    {agentFormState.name || 'Your Agent'}
                  </Text>
                  <View style={styles.sportBadges}>
                    {(agentFormState.preferred_sports || []).slice(0, 2).map((sport) => (
                      <View
                        key={sport}
                        style={[
                          styles.sportBadge,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.08)'
                              : 'rgba(0,0,0,0.05)',
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={SPORT_ICONS[sport] as any}
                          size={12}
                          color={theme.colors.onSurfaceVariant}
                        />
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.agentStatsRow}>
                  <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>0-0</Text>
                  <Text style={[styles.statText, { color: '#10b981', fontWeight: '700' }]}>+0.00u</Text>
                  <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>-</Text>
                </View>
              </View>

              <View style={styles.toggleArea}>
                <Switch
                  value
                  disabled
                  trackColor={{
                    false: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                    true: `${primaryColor}80`,
                  }}
                  thumbColor={primaryColor}
                  style={styles.activeToggle}
                />
                <View style={styles.autopilotRow}>
                  <Text style={[styles.autopilotText, { color: '#10b981' }]}>autopilot on</Text>
                  {pulseReady && (
                    <LottieView
                      source={require('@/assets/pulselottie.json')}
                      autoPlay
                      loop
                      style={styles.autopilotLottie}
                    />
                  )}
                </View>
              </View>
            </View>

            <View
              style={[
                styles.divider,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
              ]}
            />

            <View style={styles.picksContainer}>
              <View style={styles.noPicksRow}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={14}
                  color={theme.colors.onSurfaceVariant}
                />
                <Animated.Text style={[styles.noPicksText, { color: theme.colors.onSurfaceVariant, opacity: researchPulse }]}>
                  Researching...
                </Animated.Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.buttonWrap}>
          <Button
            onPress={handleContinue}
            fullWidth
            variant="glass"
            forceDarkMode
            disabled={isContinuing}
            loading={isContinuing}
          >
            Continue
          </Button>
        </View>
      </Animated.View>

      {isRevealComplete && (
        <LottieView
          source={require('@/assets/confetti.json')}
          autoPlay
          loop={false}
          style={styles.confetti}
        />
      )}

      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="fade"
        onRequestClose={handleSkipFeedback}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleSkipFeedback} />
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="star-circle-outline" size={48} color="#00E676" />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Did you like Agent Creation?
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Let us know how we are doing so far:
            </Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={34}
                    color={star <= rating ? '#FACC15' : theme.colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <Button onPress={handleSubmitFeedback} fullWidth variant="glass" forceDarkMode>
                Submit
              </Button>
              <Button onPress={handleSkipFeedback} fullWidth variant="outline" forceDarkMode>
                Skip for now
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {!isRevealComplete && (
        <View style={styles.revealOverlay} pointerEvents="none">
          <LottieView
            key={`reveal-${revealRunId}`}
            source={require('@/assets/FullscreenGreen.json')}
            autoPlay
            loop={false}
            resizeMode="cover"
            style={styles.revealLottie}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundLottie: {
    ...StyleSheet.absoluteFillObject,
  },
  revealLottie: {
    ...StyleSheet.absoluteFillObject,
  },
  revealOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  confetti: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 88,
    paddingBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    color: '#ffffff',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 28,
  },
  feedCardWrap: {
    marginTop: 8,
  },
  // ---- Feed card styles (mirrors AgentTimeline header/panel) ----
  feedCardContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  agentEmojiContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentEmoji: {
    fontSize: 22,
  },
  agentInfo: {
    flex: 1,
  },
  agentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  sportBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  sportBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  activeToggle: {
    transform: [{ scale: 0.8 }],
    alignSelf: 'flex-end',
    margin: -4,
  },
  autopilotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginTop: -4,
  },
  autopilotLottie: {
    width: 32,
    height: 32,
  },
  autopilotText: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    marginHorizontal: 14,
  },
  picksContainer: {
    padding: 10,
    gap: 6,
  },
  noPicksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 6,
  },
  noPicksText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  buttonWrap: {
    marginTop: 'auto',
  },
  // Feedback modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  modalContent: {
    width: '84%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 22,
  },
  modalIconWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  modalButtons: {
    gap: 10,
  },
});
