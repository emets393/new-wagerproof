import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions, ScrollView, StatusBar } from 'react-native';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { OnboardingProvider, useOnboarding } from '../../contexts/OnboardingContext';
import { ProgressIndicator } from '../../components/onboarding/ProgressIndicator';
import { PersonalizationIntro } from '../../components/onboarding/steps/Step1_PersonalizationIntro';
import { SportsSelection } from '../../components/onboarding/steps/Step2_SportsSelection';
import { AgeConfirmation } from '../../components/onboarding/steps/Step3_AgeConfirmation';
import { BettorTypeSelection } from '../../components/onboarding/steps/Step4_BettorType';
import { PrimaryGoalSelection } from '../../components/onboarding/steps/Step5_PrimaryGoal';
import { FeatureSpotlight } from '../../components/onboarding/steps/Step6_FeatureSpotlight';
import { CompetitorComparison } from '../../components/onboarding/steps/Step7_CompetitorComparison';
import { EmailOptIn } from '../../components/onboarding/steps/Step8_EmailOptIn';
import { SocialProof } from '../../components/onboarding/steps/Step9_SocialProof';
import { ValueClaim } from '../../components/onboarding/steps/Step10_ValueClaim';
import { MethodologyClaim1 } from '../../components/onboarding/steps/Step11_Methodology1';
import { MethodologyClaim2 } from '../../components/onboarding/steps/Step12_Methodology2';
import { AcquisitionSource } from '../../components/onboarding/steps/Step13_AcquisitionSource';
import { DataTransparency } from '../../components/onboarding/steps/Step14_DataTransparency';
import { EarlyAccess } from '../../components/onboarding/steps/Step15_EarlyAccess';
import { Paywall } from '../../components/onboarding/steps/Step16_Paywall';

const { width } = Dimensions.get('window');
const TOTAL_STEPS = 16;

const stepComponents = {
  1: PersonalizationIntro,
  2: SportsSelection,
  3: AgeConfirmation,
  4: BettorTypeSelection,
  5: PrimaryGoalSelection,
  6: FeatureSpotlight,
  7: CompetitorComparison,
  8: EmailOptIn,
  9: SocialProof,
  10: ValueClaim,
  11: MethodologyClaim1,
  12: MethodologyClaim2,
  13: AcquisitionSource,
  14: DataTransparency,
  15: EarlyAccess,
  16: Paywall,
};

function OnboardingContent() {
  const { currentStep, direction } = useOnboarding();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  
  // Force dark mode colors for onboarding
  const darkBackgroundColor = '#121212';

  useEffect(() => {
    // Animate on step change
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: direction > 0 ? -50 : 50,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [currentStep]);

  const CurrentStepComponent = stepComponents[currentStep] || PersonalizationIntro;

  return (
    <View style={[styles.container, { backgroundColor: darkBackgroundColor }]}>
      {/* Force dark status bar */}
      <StatusBar barStyle="light-content" backgroundColor={darkBackgroundColor} />
      
      {/* Progress Indicator */}
      <ProgressIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />
      
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <CurrentStepComponent />
        </ScrollView>
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
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
});

