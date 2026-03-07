import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Animated, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { OnboardingProvider, useOnboarding } from '../../contexts/OnboardingContext';
import { ThemeContext } from '../../contexts/ThemeContext';
import { darkTheme } from '@/constants/theme';
import { ProgressIndicator } from '../../components/onboarding/ProgressIndicator';
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

const TOTAL_STEPS = 21;

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
  20: AgentGenerationStep,
  21: AgentBornStep,
};

function OnboardingContent() {
  const { currentStep, direction, prevStep } = useOnboarding();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const [displayStep, setDisplayStep] = useState(currentStep);
  const isFirstMount = useRef(true);

  useEffect(() => {
    // Skip animation on first mount
    if (isFirstMount.current) {
      isFirstMount.current = false;
      setDisplayStep(currentStep);
      return;
    }

    // If the component is the same (e.g. agent builder internal navigation),
    // skip parent animation — the component handles its own transitions
    const prevComponent = stepComponents[displayStep];
    const nextComponent = stepComponents[currentStep];
    if (prevComponent === nextComponent) {
      setDisplayStep(currentStep);
      return;
    }

    // Fade out current content (reduced from 200ms for snappier feel)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: direction > 0 ? -20 : 20,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // IMPORTANT: Set initial position for new content BEFORE updating displayStep
      // This prevents the flicker where new content briefly appears at wrong position
      fadeAnim.setValue(0);
      translateX.setValue(direction > 0 ? 20 : -20);

      // Now update the display step (content) - component will mount already hidden
      setDisplayStep(currentStep);

      // Use requestAnimationFrame to ensure the new component has mounted
      // before starting the fade-in animation
      requestAnimationFrame(() => {
        // Fade in new content (reduced from 300ms for snappier feel)
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      });
    });
  }, [currentStep, direction, fadeAnim, translateX]);

  const CurrentStepComponent = stepComponents[displayStep] || PersonalizationIntro;
  const isCinematicStep = displayStep === 20 || displayStep === 21;

  return (
    <View style={styles.container}>
      {/* Subtle green glow background */}
      {!isCinematicStep && (
        <LinearGradient
          colors={['transparent', 'rgba(34, 197, 94, 0.14)']}
          start={{ x: 0.5, y: 0.3 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Force dark status bar */}
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Progress Indicator with Back Button */}
      {!isCinematicStep && (
        <ProgressIndicator
          currentStep={currentStep}
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
        <CurrentStepComponent />
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
    primaryContainer: 'rgba(34, 197, 94, 0.2)',
    onPrimaryContainer: '#86efac',
    background: '#0f1117',
    surface: '#1a1d27',
    onBackground: '#ffffff',
    onSurface: '#ffffff',
    onSurfaceVariant: 'rgba(255, 255, 255, 0.6)',
  },
};

// Force isDark=true so all child components using useThemeContext() render dark
const noopSetTheme = async () => {};
const noopToggle = async () => {};

export default function OnboardingPage() {
  const forcedDarkContext = useMemo(() => ({
    theme: darkTheme,
    themeMode: 'dark' as const,
    isDark: true,
    setThemeMode: noopSetTheme,
    toggleTheme: noopToggle,
  }), []);

  return (
    <ThemeContext.Provider value={forcedDarkContext}>
      <PaperProvider theme={onboardingDarkTheme}>
        <OnboardingProvider>
          <OnboardingContent />
        </OnboardingProvider>
      </PaperProvider>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  content: {
    flex: 1,
  },
});
