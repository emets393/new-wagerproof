import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions, ScrollView, StatusBar } from 'react-native';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { OnboardingProvider, useOnboarding } from '../../contexts/OnboardingContext';
import { ProgressIndicator } from '../../components/onboarding/ProgressIndicator';
import { AnimatedGradientBackground } from '../../components/onboarding/AnimatedGradientBackground';
import { stepGradients, StepNumber } from '../../components/onboarding/onboardingGradients';
import { PersonalizationIntro } from '../../components/onboarding/steps/Step1_PersonalizationIntro';
import { TermsAcceptance } from '../../components/onboarding/steps/Step1b_TermsAcceptance';
import { SportsSelection } from '../../components/onboarding/steps/Step2_SportsSelection';
import { AgeConfirmation } from '../../components/onboarding/steps/Step3_AgeConfirmation';
import { BettorTypeSelection } from '../../components/onboarding/steps/Step4_BettorType';
import { AcquisitionSource } from '../../components/onboarding/steps/Step13_AcquisitionSource';
import { PrimaryGoalSelection } from '../../components/onboarding/steps/Step5_PrimaryGoal';
import { ValueClaim } from '../../components/onboarding/steps/Step10_ValueClaim';
import { FeatureSpotlight } from '../../components/onboarding/steps/Step6_FeatureSpotlight';
import { AgentValue1_247 } from '../../components/onboarding/steps/AgentValue1_247';
import { AgentValue2_VirtualAssistant } from '../../components/onboarding/steps/AgentValue2_VirtualAssistant';
import { AgentValue3_MultipleStrategies } from '../../components/onboarding/steps/AgentValue3_MultipleStrategies';
import { AgentValue4_Leaderboard } from '../../components/onboarding/steps/AgentValue4_Leaderboard';
import { AgentGenerationStep } from '../../components/onboarding/steps/StepAgentGeneration';
import { AgentBornStep } from '../../components/onboarding/steps/StepAgentBorn';
import { OnboardingAgentBuilder } from '../../components/onboarding/steps/OnboardingAgentBuilder';
import { DataTransparency } from '../../components/onboarding/steps/Step14_DataTransparency';

const { width } = Dimensions.get('window');
const TOTAL_STEPS = 22;

const stepComponents: Record<number, React.ComponentType> = {
  1: PersonalizationIntro,
  2: TermsAcceptance,
  3: SportsSelection,
  4: AgeConfirmation,
  5: BettorTypeSelection,
  6: AcquisitionSource,
  7: PrimaryGoalSelection,
  8: ValueClaim,
  9: FeatureSpotlight,
  10: DataTransparency,
  11: AgentValue1_247,
  12: AgentValue2_VirtualAssistant,
  13: AgentValue3_MultipleStrategies,
  14: AgentValue4_Leaderboard,
  15: OnboardingAgentBuilder,
  16: OnboardingAgentBuilder,
  17: OnboardingAgentBuilder,
  18: OnboardingAgentBuilder,
  19: OnboardingAgentBuilder,
  20: OnboardingAgentBuilder,
  21: AgentGenerationStep,
  22: AgentBornStep,
};

function OnboardingContent() {
  const { currentStep, direction, prevStep } = useOnboarding();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const [displayStep, setDisplayStep] = useState(currentStep);
  const [gradientStep, setGradientStep] = useState(currentStep);
  const isFirstMount = useRef(true);

  // Get gradient for current step - updates immediately for smooth transition
  const currentGradient = stepGradients[gradientStep as StepNumber] || stepGradients[1];

  useEffect(() => {
    // Skip animation on first mount
    if (isFirstMount.current) {
      isFirstMount.current = false;
      setDisplayStep(currentStep);
      setGradientStep(currentStep);
      return;
    }

    // Start gradient transition immediately
    setGradientStep(currentStep);

    // Fade out current content
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: direction > 0 ? -30 : 30,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // IMPORTANT: Set initial position for new content BEFORE updating displayStep
      // This prevents the flicker where new content briefly appears at wrong position
      fadeAnim.setValue(0);
      translateX.setValue(direction > 0 ? 30 : -30);

      // Now update the display step (content) - component will mount already hidden
      setDisplayStep(currentStep);

      // Use requestAnimationFrame to ensure the new component has mounted
      // before starting the fade-in animation
      requestAnimationFrame(() => {
        // Fade in new content
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    });
  }, [currentStep, direction, fadeAnim, translateX]);

  const CurrentStepComponent = stepComponents[displayStep] || PersonalizationIntro;
  const isCinematicStep = displayStep === 21 || displayStep === 22;

  // Steps that handle their own scrolling:
  // 9 = FeatureSpotlight, 15-20 = Agent Builder screens, 21-22 = cinematic screens
  const selfScrollingStep =
    displayStep === 9 ||
    (displayStep >= 15 && displayStep <= 22);

  return (
    <View style={styles.container}>
      {/* Animated Gradient Background */}
      {!isCinematicStep && (
        <AnimatedGradientBackground
          colorScheme={currentGradient}
          duration={8000}
        />
      )}

      {/* Dark overlay for better text readability */}
      {!isCinematicStep && <View style={styles.darkOverlay} />}

      {/* Force dark status bar */}
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Progress Indicator with Back Button */}
      {!isCinematicStep && (
        <ProgressIndicator
          currentStep={gradientStep}
          totalSteps={TOTAL_STEPS}
          onBack={prevStep}
        />
      )}

      {/* Step Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateX }],
          },
        ]}
      >
        {selfScrollingStep ? (
          <CurrentStepComponent />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <CurrentStepComponent />
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

// Custom dark theme for onboarding with brand colors
const onboardingDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#22c55e', // Green primary color
    background: '#121212',
    surface: '#1e1e1e',
    onBackground: '#ffffff',
    onSurface: '#ffffff',
  },
};

export default function OnboardingPage() {
  return (
    <PaperProvider theme={onboardingDarkTheme}>
      <OnboardingProvider>
        <OnboardingContent />
      </OnboardingProvider>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Fallback color
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dark overlay for better text readability
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
});
