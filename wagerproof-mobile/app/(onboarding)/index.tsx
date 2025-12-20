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
import { PrimaryGoalSelection } from '../../components/onboarding/steps/Step5_PrimaryGoal';
import { FeatureSpotlight } from '../../components/onboarding/steps/Step6_FeatureSpotlight';
import { CompetitorComparison } from '../../components/onboarding/steps/Step7_CompetitorComparison';
import { EmailOptIn } from '../../components/onboarding/steps/Step8_EmailOptIn';
import { SocialProof } from '../../components/onboarding/steps/Step9_SocialProof';
import { DiscordCommunity } from '../../components/onboarding/steps/Step10_DiscordCommunity';
import { ValueClaim } from '../../components/onboarding/steps/Step10_ValueClaim';
import { MethodologyClaim2 } from '../../components/onboarding/steps/Step12_Methodology2';
import { AcquisitionSource } from '../../components/onboarding/steps/Step13_AcquisitionSource';
import { DataTransparency } from '../../components/onboarding/steps/Step14_DataTransparency';
import { EarlyAccess } from '../../components/onboarding/steps/Step15_EarlyAccess';
import { RevenueCatPaywallStep } from '../../components/onboarding/steps/Step16_RevenueCatPaywall';

const { width } = Dimensions.get('window');
const TOTAL_STEPS = 16;

const stepComponents = {
  1: PersonalizationIntro,
  2: TermsAcceptance,
  3: SportsSelection,
  4: AgeConfirmation,
  5: BettorTypeSelection,
  6: PrimaryGoalSelection,
  7: MethodologyClaim2,
  8: FeatureSpotlight,
  9: CompetitorComparison,
  10: EmailOptIn,
  11: SocialProof,
  12: DiscordCommunity,
  13: ValueClaim,
  14: AcquisitionSource,
  15: DataTransparency,
  // 16: EarlyAccess, // Disabled - not showing early access message
  16: RevenueCatPaywallStep,
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
      // Update the display step (content)
      setDisplayStep(currentStep);
      
      // Reset position for fade in
      translateX.setValue(direction > 0 ? 30 : -30);
      
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
  }, [currentStep, direction, fadeAnim, translateX]);

  const CurrentStepComponent = stepComponents[displayStep] || PersonalizationIntro;

  return (
    <View style={styles.container}>
      {/* Animated Gradient Background */}
      <AnimatedGradientBackground 
        colorScheme={currentGradient}
        duration={8000}
      />
      
      {/* Dark overlay for better text readability */}
      <View style={styles.darkOverlay} />
      
      {/* Force dark status bar */}
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Progress Indicator with Back Button - Only show if not on Paywall */}
      {displayStep !== 16 && (
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
        {/* Steps that handle their own scrolling (for floating buttons) */}
        {displayStep === 16 || displayStep === 7 || displayStep === 9 || displayStep === 12 ? (
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

