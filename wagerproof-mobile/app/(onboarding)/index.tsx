import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, StatusBar, FlatList, useWindowDimensions } from 'react-native';
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
// We give it one page in the FlatList so FlatList doesn't scroll during builder navigation.
interface Page {
  key: string;
  Component: React.ComponentType;
}

// FlatList only handles steps 1-19. Steps 20-21 are cinematic (full-screen
// with their own Lottie animations) and render outside the FlatList.
const PAGES: Page[] = [
  { key: 's1', Component: PersonalizationIntro },
  { key: 's2', Component: TermsAcceptance },
  { key: 's3', Component: SportsSelection },
  { key: 's4', Component: AgeConfirmation },
  { key: 's5', Component: BettorTypeSelection },
  { key: 's6', Component: AcquisitionSource },
  { key: 's7', Component: PrimaryGoalSelection },
  { key: 's8', Component: ValueClaim },
  { key: 's9', Component: FeatureSpotlight },
  { key: 's10', Component: DataTransparency },
  { key: 's11', Component: AgentValue1_247 },
  { key: 's12', Component: AgentValue2_VirtualAssistant },
  { key: 's13', Component: AgentValue3_MultipleStrategies },
  { key: 's14', Component: AgentValue4_Leaderboard },
  { key: 's15', Component: OnboardingAgentBuilder },  // handles steps 15-19 internally
];

// Map context currentStep → FlatList page index (only for steps 1-19)
function stepToPageIndex(step: number): number {
  if (step <= 14) return step - 1;
  return 14; // steps 15-19 → index 14 (builder handles internally)
}

// ─── Main content ───────────────────────────────────────────────────────────

function OnboardingContent() {
  const { currentStep, prevStep } = useOnboarding();
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList>(null);
  const lastPageIndex = useRef(0);

  const isCinematicStep = currentStep >= 20;

  // Scroll FlatList whenever currentStep changes (only for steps 1-19)
  useEffect(() => {
    if (isCinematicStep) return;
    const targetIndex = stepToPageIndex(currentStep);
    if (targetIndex !== lastPageIndex.current) {
      flatListRef.current?.scrollToIndex({ index: targetIndex, animated: true });
      lastPageIndex.current = targetIndex;
    }
  }, [currentStep, isCinematicStep]);

  const renderItem = useCallback(({ item }: { item: Page }) => {
    const { Component } = item;
    return (
      <View style={{ width, flex: 1 }}>
        <Component />
      </View>
    );
  }, [width]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: width,
    offset: width * index,
    index,
  }), [width]);

  const keyExtractor = useCallback((item: Page) => item.key, []);

  // Steps 20-21: cinematic screens render full-screen outside the FlatList
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

      <FlatList
        ref={flatListRef}
        data={PAGES}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={0}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews={false}
        style={styles.content}
      />
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
});
