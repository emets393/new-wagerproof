import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { useCreateAgent } from '@/hooks/useAgents';
import { Sport } from '@/types/agent';

// Import agent builder screen components
import { Screen1_SportArchetype } from '@/components/agents/creation/Screen1_SportArchetype';
import { Screen2_Identity } from '@/components/agents/creation/Screen2_Identity';
import { Screen3_Personality } from '@/components/agents/creation/Screen3_Personality';
import { Screen4_DataAndConditions } from '@/components/agents/creation/Screen4_DataAndConditions';
import { Screen5_CustomInsights } from '@/components/agents/creation/Screen5_CustomInsights';
import { Screen6_Review } from '@/components/agents/creation/Screen6_Review';

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
    prevStep,
    onboardingData,
    agentFormState,
    updateAgentFormState,
    updateAgentPersonalityParam,
    updateAgentCustomInsight,
    applyArchetypePreset,
    setCreatedAgentId,
  } = useOnboarding();

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
        case 5: // Review - always valid
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
    nextStep();
  }, [agentScreenIndex, validateScreen, getValidationError, nextStep]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    prevStep();
  }, [prevStep]);

  // Handle agent creation on the Review screen
  const handleCreate = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const newAgent = await createMutation.mutateAsync({
        name: agentFormState.name.trim(),
        avatar_emoji: agentFormState.avatar_emoji,
        avatar_color: agentFormState.avatar_color,
        preferred_sports: agentFormState.preferred_sports,
        archetype: agentFormState.archetype,
        personality_params: agentFormState.personality_params,
        custom_insights: agentFormState.custom_insights,
        auto_generate: agentFormState.auto_generate,
      });

      setCreatedAgentId(newAgent.id);
      nextStep();
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message || 'Failed to create agent. Please try again.'
      );
    }
  }, [agentFormState, createMutation, setCreatedAgentId, nextStep]);

  // Render the appropriate agent builder screen
  const renderScreenContent = () => {
    switch (agentScreenIndex) {
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
      case 5:
        return (
          <Screen6_Review
            formState={agentFormState}
            autoGenerate={agentFormState.auto_generate}
            onAutoGenerateChange={(value) => updateAgentFormState('auto_generate', value)}
            onCreate={handleCreate}
            isCreating={createMutation.isPending}
          />
        );
      default:
        return null;
    }
  };

  const isLastAgentScreen = agentScreenIndex === 5;
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
        {renderScreenContent()}

        {/* Navigation buttons (except for Review screen which has its own Create button) */}
        {!isLastAgentScreen && (
          <View style={styles.navigationButtons}>
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
                  disabled={!canProceed}
                >
                  Next
                </Button>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
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
    paddingBottom: 24,
    flexGrow: 1,
  },
  navigationButtons: {
    marginTop: 24,
    paddingHorizontal: 8,
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
