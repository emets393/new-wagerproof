import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useTheme, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AndroidBlurView } from '@/components/AndroidBlurView';

import { useThemeContext } from '@/contexts/ThemeContext';
import { useCreateAgent } from '@/hooks/useAgents';
import {
  Sport,
  ArchetypeId,
  PersonalityParams,
  CustomInsights,
  DEFAULT_PERSONALITY_PARAMS,
  DEFAULT_CUSTOM_INSIGHTS,
  CreateAgentFormState,
  INITIAL_FORM_STATE,
} from '@/types/agent';

// Import screen components
import { Screen1_SportArchetype } from '@/components/agents/creation/Screen1_SportArchetype';
import { Screen2_Identity } from '@/components/agents/creation/Screen2_Identity';
import { Screen3_Personality } from '@/components/agents/creation/Screen3_Personality';
import { Screen4_DataAndConditions } from '@/components/agents/creation/Screen4_DataAndConditions';
import { Screen5_CustomInsights } from '@/components/agents/creation/Screen5_CustomInsights';
import { Screen6_Review } from '@/components/agents/creation/Screen6_Review';

const TOTAL_SCREENS = 6;

// Screen titles for header
const SCREEN_TITLES = [
  'Sport & Style',
  'Identity',
  'Personality',
  'Data & Conditions',
  'Custom Insights',
  'Review',
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function CreateAgentScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  // Form state
  const [formState, setFormState] = useState<CreateAgentFormState>(INITIAL_FORM_STATE);
  const [currentScreen, setCurrentScreen] = useState(0);

  // Create mutation
  const createMutation = useCreateAgent();

  // Update form state helper
  const updateFormState = useCallback(
    <K extends keyof CreateAgentFormState>(
      key: K,
      value: CreateAgentFormState[K]
    ) => {
      setFormState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Update personality params helper
  const updatePersonalityParam = useCallback(
    <K extends keyof PersonalityParams>(key: K, value: PersonalityParams[K]) => {
      setFormState((prev) => ({
        ...prev,
        personality_params: {
          ...prev.personality_params,
          [key]: value,
        },
      }));
    },
    []
  );

  // Update custom insights helper
  const updateCustomInsight = useCallback(
    <K extends keyof CustomInsights>(key: K, value: CustomInsights[K]) => {
      setFormState((prev) => ({
        ...prev,
        custom_insights: {
          ...prev.custom_insights,
          [key]: value,
        },
      }));
    },
    []
  );

  // Apply archetype preset
  const applyArchetypePreset = useCallback(
    (
      archetypeId: ArchetypeId | null,
      personalityParams?: Partial<PersonalityParams>,
      customInsights?: CustomInsights
    ) => {
      setFormState((prev) => ({
        ...prev,
        archetype: archetypeId,
        personality_params: archetypeId
          ? { ...DEFAULT_PERSONALITY_PARAMS, ...personalityParams }
          : { ...DEFAULT_PERSONALITY_PARAMS },
        custom_insights: archetypeId && customInsights
          ? { ...customInsights }
          : { ...DEFAULT_CUSTOM_INSIGHTS },
      }));
    },
    []
  );

  // Validation for each screen
  const validateScreen = useCallback(
    (screen: number): boolean => {
      switch (screen) {
        case 0: // Sport & Archetype
          return formState.preferred_sports.length > 0;
        case 1: // Identity
          return (
            formState.name.trim().length > 0 &&
            formState.name.trim().length <= 50 &&
            formState.avatar_emoji.length > 0 &&
            formState.avatar_color.length > 0
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
    [formState]
  );

  // Get validation error message
  const getValidationError = useCallback(
    (screen: number): string | null => {
      switch (screen) {
        case 0:
          if (formState.preferred_sports.length === 0) {
            return 'Please select at least one sport';
          }
          return null;
        case 1:
          if (formState.name.trim().length === 0) {
            return 'Please enter a name for your agent';
          }
          if (formState.name.trim().length > 50) {
            return 'Name must be 50 characters or less';
          }
          if (formState.avatar_emoji.length === 0) {
            return 'Please select an emoji';
          }
          return null;
        default:
          return null;
      }
    },
    [formState]
  );

  // Handle next button
  const handleNext = useCallback(() => {
    if (!validateScreen(currentScreen)) {
      const error = getValidationError(currentScreen);
      if (error) {
        Alert.alert('Required', error);
      }
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentScreen < TOTAL_SCREENS - 1) {
      setCurrentScreen((prev) => prev + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [currentScreen, validateScreen, getValidationError]);

  // Handle back button
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentScreen > 0) {
      setCurrentScreen((prev) => prev - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [currentScreen]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    Alert.alert(
      'Discard Agent?',
      'Are you sure you want to discard this agent? All progress will be lost.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]
    );
  }, [router]);

  // Handle create agent
  const handleCreate = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const newAgent = await createMutation.mutateAsync({
        name: formState.name.trim(),
        avatar_emoji: formState.avatar_emoji,
        avatar_color: formState.avatar_color,
        preferred_sports: formState.preferred_sports,
        archetype: formState.archetype,
        personality_params: formState.personality_params,
        custom_insights: formState.custom_insights,
        auto_generate: formState.auto_generate,
      });

      // Navigate to the new agent's detail page
      router.replace(`/(drawer)/(tabs)/agents/${newAgent.id}` as any);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message || 'Failed to create agent. Please try again.'
      );
    }
  }, [formState, createMutation, router]);

  // Render current screen content
  const renderScreenContent = () => {
    switch (currentScreen) {
      case 0:
        return (
          <Screen1_SportArchetype
            selectedSports={formState.preferred_sports}
            selectedArchetype={formState.archetype}
            onSportsChange={(sports) => updateFormState('preferred_sports', sports)}
            onArchetypeChange={applyArchetypePreset}
          />
        );
      case 1:
        return (
          <Screen2_Identity
            name={formState.name}
            emoji={formState.avatar_emoji}
            color={formState.avatar_color}
            onNameChange={(name) => updateFormState('name', name)}
            onEmojiChange={(emoji) => updateFormState('avatar_emoji', emoji)}
            onColorChange={(color) => updateFormState('avatar_color', color)}
          />
        );
      case 2:
        return (
          <Screen3_Personality
            params={formState.personality_params}
            onParamChange={updatePersonalityParam}
          />
        );
      case 3:
        return (
          <Screen4_DataAndConditions
            params={formState.personality_params}
            selectedSports={formState.preferred_sports}
            onParamChange={updatePersonalityParam}
          />
        );
      case 4:
        return (
          <Screen5_CustomInsights
            insights={formState.custom_insights}
            onInsightChange={updateCustomInsight}
          />
        );
      case 5:
        return (
          <Screen6_Review
            formState={formState}
            autoGenerate={formState.auto_generate}
            onAutoGenerateChange={(value) => updateFormState('auto_generate', value)}
            onCreate={handleCreate}
            isCreating={createMutation.isPending}
          />
        );
      default:
        return null;
    }
  };

  const isFirstScreen = currentScreen === 0;
  const isLastScreen = currentScreen === TOTAL_SCREENS - 1;
  const canProceed = validateScreen(currentScreen);

  const HEADER_HEIGHT = insets.top + 56;
  const FOOTER_HEIGHT = 72 + insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
        {/* Frosted Glass Header */}
        <View style={styles.fixedHeaderContainer}>
          <AndroidBlurView
            intensity={80}
            tint={isDark ? 'dark' : 'light'}
            style={[styles.fixedHeader, { paddingTop: insets.top }]}
          >
            <View style={styles.headerTop}>
              <TouchableOpacity onPress={handleCancel} style={styles.headerCloseButton}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurface} />
              </TouchableOpacity>

              <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
                {SCREEN_TITLES[currentScreen]}
              </Text>

              <Text style={[styles.headerStep, { color: theme.colors.onSurfaceVariant }]}>
                {currentScreen + 1}/{TOTAL_SCREENS}
              </Text>
            </View>

            {/* Progress Indicator */}
            <View style={styles.progressContainer}>
              {Array.from({ length: TOTAL_SCREENS }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor:
                        index <= currentScreen
                          ? '#00E676'
                          : isDark
                          ? 'rgba(255, 255, 255, 0.15)'
                          : 'rgba(0, 0, 0, 0.08)',
                    },
                    index === currentScreen && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>
          </AndroidBlurView>
        </View>

        {/* Screen Content */}
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: HEADER_HEIGHT + 40,
                paddingBottom: FOOTER_HEIGHT + 24,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {renderScreenContent()}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Frosted Glass Footer */}
        {!isLastScreen && (
          <View style={styles.fixedFooterContainer}>
            <AndroidBlurView
              intensity={80}
              tint={isDark ? 'dark' : 'light'}
              style={[styles.fixedFooter, { paddingBottom: insets.bottom + 16 }]}
            >
              <View style={styles.navigationButtons}>
                <Button
                  mode="outlined"
                  onPress={handleBack}
                  disabled={isFirstScreen}
                  style={[
                    styles.navButton,
                    isFirstScreen && styles.navButtonHidden,
                  ]}
                  labelStyle={{ color: theme.colors.onSurface }}
                >
                  Back
                </Button>

                <Button
                  mode="contained"
                  onPress={handleNext}
                  disabled={!canProceed}
                  style={[styles.navButton, styles.navButtonNext]}
                  buttonColor="#00E676"
                  textColor="#000000"
                >
                  Next
                </Button>
              </View>
            </AndroidBlurView>
          </View>
        )}
      </View>
    </>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  fixedHeader: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
  },
  headerCloseButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  headerStep: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 12,
    gap: 6,
  },
  progressDot: {
    height: 3,
    flex: 1,
    borderRadius: 2,
    maxWidth: 48,
  },
  progressDotActive: {
    height: 3,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  fixedFooterContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  fixedFooter: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  navButton: {
    flex: 1,
    borderRadius: 12,
  },
  navButtonHidden: {
    opacity: 0,
  },
  navButtonNext: {
    flex: 2,
  },
});
