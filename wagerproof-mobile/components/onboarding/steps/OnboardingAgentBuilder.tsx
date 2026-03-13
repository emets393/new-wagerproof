import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { onboardingCta } from '../onboardingStyles';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { useCreateAgent } from '@/hooks/useAgents';
import { fetchUserAgents } from '@/services/agentService';
import { useAuth } from '@/contexts/AuthContext';
import { Sport } from '@/types/agent';

// Import agent builder screen components
import { Screen1_SportArchetype } from '@/components/agents/creation/Screen1_SportArchetype';
import { Screen2_Identity } from '@/components/agents/creation/Screen2_Identity';
import { Screen3_Personality } from '@/components/agents/creation/Screen3_Personality';
import { Screen4_DataAndConditions } from '@/components/agents/creation/Screen4_DataAndConditions';
import { Screen5_CustomInsights } from '@/components/agents/creation/Screen5_CustomInsights';

// Agent builder screens span onboarding steps 15-20 (0-indexed: screens 0-5)
const AGENT_BUILDER_START_STEP = 15;

const SPORT_MAP: Record<string, Sport> = {
  NFL: 'nfl',
  'College Football': 'cfb',
  NBA: 'nba',
  NCAAB: 'ncaab',
};

export function OnboardingAgentBuilder() {
  const {
    currentStep,
    nextStep,
    isTransitioning,
    prevStep,
    onboardingData,
    agentFormState,
    updateAgentFormState,
    updateAgentPersonalityParam,
    updateAgentCustomInsight,
    applyArchetypePreset,
    setCreatedAgentId,
    markOnboardingCompleted,
  } = useOnboarding();

  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const createMutation = useCreateAgent();

  // Pre-fill agent sports from onboarding sports selection (was in AgentBuilderTransition)
  useEffect(() => {
    const selectedSports = (onboardingData.favoriteSports || [])
      .map((s) => SPORT_MAP[s])
      .filter(Boolean) as Sport[];
    const sports = selectedSports.length > 0 ? selectedSports : ['nfl' as Sport];
    updateAgentFormState('preferred_sports', sports);
  }, [onboardingData.favoriteSports, updateAgentFormState]);

  // Compute which agent builder screen we're on (0-5)
  const agentScreenIndex = currentStep - AGENT_BUILDER_START_STEP;

  // Internal transition animation for switching between agent builder screens
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [displayIndex, setDisplayIndex] = useState(agentScreenIndex);
  const prevIndexRef = useRef(agentScreenIndex);

  useEffect(() => {
    if (agentScreenIndex === prevIndexRef.current) return;

    const goingForward = agentScreenIndex > prevIndexRef.current;
    prevIndexRef.current = agentScreenIndex;

    // Fade out current screen
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: goingForward ? -20 : 20,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Set up for incoming screen
      fadeAnim.setValue(0);
      slideAnim.setValue(goingForward ? 20 : -20);
      setDisplayIndex(agentScreenIndex);

      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      });
    });
  }, [agentScreenIndex, fadeAnim, slideAnim]);

  // Validation for each agent builder screen
  const validateScreen = useCallback(
    (screen: number): boolean => {
      switch (screen) {
        case 0: // Sport & Archetype
          return agentFormState.preferred_sports.length > 0;
        case 1: // Identity
          return (
            agentFormState.name.trim().length > 0 &&
            agentFormState.name.trim().length <= 50 &&
            agentFormState.avatar_emoji.length > 0 &&
            agentFormState.avatar_color.length > 0
          );
        case 2: // Personality - always valid (has defaults)
          return true;
        case 3: // Data & Conditions - always valid (has defaults)
          return true;
        case 4: // Custom Insights - always valid (optional)
          return true;
        default:
          return false;
      }
    },
    [agentFormState]
  );

  const getValidationError = useCallback(
    (screen: number): string | null => {
      switch (screen) {
        case 0:
          if (agentFormState.preferred_sports.length === 0) {
            return 'Please select at least one sport';
          }
          return null;
        case 1:
          if (agentFormState.name.trim().length === 0) {
            return 'Please enter a name for your agent';
          }
          if (agentFormState.name.trim().length > 50) {
            return 'Name must be 50 characters or less';
          }
          if (agentFormState.avatar_emoji.length === 0) {
            return 'Please select an emoji';
          }
          return null;
        default:
          return null;
      }
    },
    [agentFormState]
  );

  // Handle agent creation (called on last screen's Continue)
  const handleCreate = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // Race the mutation against a timeout so the user never stares at a spinner forever
      const CREATION_TIMEOUT_MS = 12000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Agent creation is taking too long. Please check your connection and try again.')), CREATION_TIMEOUT_MS)
      );

      const newAgent = await Promise.race([
        createMutation.mutateAsync({
          name: agentFormState.name.trim(),
          avatar_emoji: agentFormState.avatar_emoji,
          avatar_color: agentFormState.avatar_color,
          preferred_sports: agentFormState.preferred_sports,
          archetype: agentFormState.archetype,
          personality_params: agentFormState.personality_params,
          custom_insights: agentFormState.custom_insights,
          auto_generate: agentFormState.auto_generate,
          auto_generate_time: agentFormState.auto_generate_time,
          auto_generate_timezone: agentFormState.auto_generate_timezone,
        }),
        timeoutPromise,
      ]);

      setCreatedAgentId(newAgent.id);
      markOnboardingCompleted(newAgent.id).catch(() => {});
      nextStep();
    } catch (error: any) {
      // If agent limit was hit (user retrying onboarding), use their existing agent instead
      if (
        error?.message?.includes('Agent limit reached') ||
        error?.message?.includes('row-level security') ||
        error?.message?.includes('permission denied')
      ) {
        try {
          if (user?.id) {
            const existingAgents = await fetchUserAgents(user.id);
            if (existingAgents.length > 0) {
              setCreatedAgentId(existingAgents[0].id);
              markOnboardingCompleted(existingAgents[0].id).catch(() => {});
              nextStep();
              return;
            }
          }
        } catch {
          // Fall through to error alert
        }
      }

      Alert.alert(
        'Error',
        error?.message || 'Failed to create agent. Please try again.'
      );
    }
  }, [agentFormState, createMutation, setCreatedAgentId, markOnboardingCompleted, nextStep, user?.id]);

  const handleNext = useCallback(() => {
    if (!validateScreen(agentScreenIndex)) {
      const error = getValidationError(agentScreenIndex);
      if (error) {
        Alert.alert('Required', error);
      }
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    // On the last agent builder screen, create the agent and go to generation animation
    if (agentScreenIndex === 4) {
      handleCreate();
      return;
    }

    nextStep();
  }, [agentScreenIndex, validateScreen, getValidationError, nextStep, handleCreate]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    prevStep();
  }, [prevStep]);

  // Render the appropriate agent builder screen based on displayIndex (for smooth transitions)
  const renderScreenContent = () => {
    switch (displayIndex) {
      case 0:
        return (
          <Screen1_SportArchetype
            selectedSports={agentFormState.preferred_sports}
            selectedArchetype={agentFormState.archetype}
            onSportsChange={(sports) => updateAgentFormState('preferred_sports', sports)}
            onArchetypeChange={applyArchetypePreset}
            isOnboarding
          />
        );
      case 1:
        return (
          <Screen2_Identity
            name={agentFormState.name}
            emoji={agentFormState.avatar_emoji}
            color={agentFormState.avatar_color}
            onNameChange={(name) => updateAgentFormState('name', name)}
            onEmojiChange={(emoji) => updateAgentFormState('avatar_emoji', emoji)}
            onColorChange={(color) => updateAgentFormState('avatar_color', color)}
          />
        );
      case 2:
        return (
          <Screen3_Personality
            params={agentFormState.personality_params}
            onParamChange={updateAgentPersonalityParam}
          />
        );
      case 3:
        return (
          <Screen4_DataAndConditions
            params={agentFormState.personality_params}
            selectedSports={agentFormState.preferred_sports}
            onParamChange={updateAgentPersonalityParam}
          />
        );
      case 4:
        return (
          <Screen5_CustomInsights
            insights={agentFormState.custom_insights}
            onInsightChange={updateAgentCustomInsight}
          />
        );
      default:
        return null;
    }
  };

  const isLastAgentScreen = false; // All screens now show nav buttons (Continue triggers creation on screen 4)
  const canProceed = validateScreen(agentScreenIndex);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          {renderScreenContent()}
        </Animated.View>
      </ScrollView>

      {/* Navigation buttons (except for Review screen which has its own Create button) */}
      {!isLastAgentScreen && (
        <View style={styles.fixedBottom}>
          <LinearGradient
            colors={['transparent', 'rgba(15, 17, 23, 0.85)', '#0f1117']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.buttonRow}>
            <View style={styles.backButtonContainer}>
              <Button onPress={handleBack} fullWidth variant="glass" forceDarkMode>
                Back
              </Button>
            </View>
            <View style={styles.nextButtonContainer}>
              <Button
                onPress={handleNext}
                fullWidth
                variant="glass"
                forceDarkMode
                style={onboardingCta.button}
                disabled={!canProceed || createMutation.isPending}
                loading={isTransitioning || createMutation.isPending}
              >
                Continue
              </Button>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 100,
    flexGrow: 1,
  },
  fixedBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 32,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backButtonContainer: {
    flex: 1,
  },
  nextButtonContainer: {
    flex: 2,
  },
});
