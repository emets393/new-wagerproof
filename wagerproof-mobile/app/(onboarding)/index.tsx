import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, StatusBar, useWindowDimensions } from 'react-native';
import PagerView from 'react-native-pager-view';
import { LinearGradient } from 'expo-linear-gradient';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { useOnboarding } from '../../contexts/OnboardingContext';
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

// ─── Page definitions ───────────────────────────────────────────────────────
// Steps 15-19 are a single OnboardingAgentBuilder that handles 5 internal screens.
// PagerView gives it one page; the builder handles its own internal navigation.

const PAGES = [
  PersonalizationIntro,   // step 1
  TermsAcceptance,        // step 2
  SportsSelection,        // step 3
  AgeConfirmation,        // step 4
  BettorTypeSelection,    // step 5
  AcquisitionSource,      // step 6
  PrimaryGoalSelection,   // step 7
  ValueClaim,             // step 8
  FeatureSpotlight,       // step 9
  DataTransparency,       // step 10
  AgentValue1_247,        // step 11
  AgentValue2_VirtualAssistant, // step 12
  AgentValue3_MultipleStrategies, // step 13
  AgentValue4_Leaderboard, // step 14
  OnboardingAgentBuilder,  // steps 15-19 (handles internally)
] as const;

// Wrap each page in React.memo to prevent re-renders of offscreen pages
const MemoizedPages = PAGES.map((Component, i) => {
  const MemoPage = React.memo(() => <Component />);
  MemoPage.displayName = `OnboardingPage${i}`;
  return MemoPage;
});

// Map context currentStep → PagerView page index (only for steps 1-19)
function stepToPageIndex(step: number): number {
  if (step <= 14) return step - 1;
  return 14; // steps 15-19 → index 14 (builder handles internally)
}

// ─── Main content ───────────────────────────────────────────────────────────

function OnboardingContent() {
  const { currentStep, prevStep } = useOnboarding();
  const pagerRef = useRef<PagerView>(null);
  const lastPageIndex = useRef(0);

  const isCinematicStep = currentStep >= 20;

  // Navigate PagerView when currentStep changes (only for steps 1-19)
  useEffect(() => {
    if (isCinematicStep) return;
    const targetIndex = stepToPageIndex(currentStep);
    if (targetIndex !== lastPageIndex.current) {
      pagerRef.current?.setPage(targetIndex);
      lastPageIndex.current = targetIndex;
    }
  }, [currentStep, isCinematicStep]);

  // Steps 20-21: cinematic screens render full-screen outside PagerView
  if (isCinematicStep) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        {currentStep === 20 ? <AgentGenerationStep /> : <AgentBornStep />}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['transparent', 'rgba(34, 197, 94, 0.14)']}
        start={{ x: 0.5, y: 0.3 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ProgressIndicator
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        onBack={prevStep}
      />

      <PagerView
        ref={pagerRef}
        style={styles.content}
        initialPage={0}
        scrollEnabled={false}
        offscreenPageLimit={1}
      >
        {MemoizedPages.map((MemoPage, index) => (
          <View key={`page-${index}`} style={styles.page} collapsable={false}>
            <MemoPage />
          </View>
        ))}
      </PagerView>
    </View>
  );
}

// ─── Theme & providers ──────────────────────────────────────────────────────

const onboardingDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#22c55e',
    primaryContainer: 'rgba(34, 197, 94, 0.2)',
    onPrimaryContainer: '#86efac',
    background: '#0f1117',
    surface: '#1a1d27',
    onBackground: '#ffffff',
    onSurface: '#ffffff',
    onSurfaceVariant: 'rgba(255, 255, 255, 0.6)',
  },
};

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
        <OnboardingContent />
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
  page: {
    flex: 1,
  },
});
