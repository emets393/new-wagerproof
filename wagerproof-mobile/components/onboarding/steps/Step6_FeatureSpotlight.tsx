import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { onboardingCta } from '../onboardingStyles';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { NFLGameCard } from '../../NFLGameCard';
import { NFLPrediction } from '@/types/nfl';
import { DemoScanButton } from '../DemoScanButton';
import { DemoScanWaveAnimation } from '../DemoScanWaveAnimation';
import { DemoGameBottomSheet, DemoGameBottomSheetHandle } from '../DemoGameBottomSheet';
import { GlowingCardWrapper } from '../../agents/GlowingCardWrapper';

// Tutorial phases walk users through the two headline interactions — the
// Dynamic-Island "Scan this page" bubble and the per-game pro-data bottom
// sheet — before they ever see them in the live app.
type Phase = 'intro-scan' | 'scanning' | 'highlight-card' | 'sheet-demo';

const DUMMY_GAMES: NFLPrediction[] = [
  {
    id: 'onboarding-1',
    away_team: 'Kansas City',
    home_team: 'Buffalo',
    home_ml: 135,
    away_ml: -155,
    home_spread: 2.5,
    away_spread: -2.5,
    over_line: 47.5,
    game_date: '2025-01-26',
    game_time: '18:30:00',
    training_key: 'demo',
    unique_id: 'demo-1',
    home_away_ml_prob: 0.42,
    home_away_spread_cover_prob: 0.72,
    ou_result_prob: 0.65,
    run_id: null,
    temperature: null,
    precipitation: null,
    wind_speed: null,
    icon: null,
    spread_splits_label: null,
    total_splits_label: null,
    ml_splits_label: null,
    home_ml_handle: null,
    away_ml_handle: null,
    home_ml_bets: null,
    away_ml_bets: null,
    home_spread_handle: null,
    away_spread_handle: null,
    home_spread_bets: null,
    away_spread_bets: null,
    over_handle: null,
    under_handle: null,
    over_bets: null,
    under_bets: null,
  },
  {
    id: 'onboarding-2',
    away_team: 'San Francisco',
    home_team: 'Dallas',
    home_ml: 120,
    away_ml: -140,
    home_spread: 2.5,
    away_spread: -2.5,
    over_line: 49.5,
    game_date: '2025-01-26',
    game_time: '16:00:00',
    training_key: 'demo',
    unique_id: 'demo-2',
    home_away_ml_prob: 0.38,
    home_away_spread_cover_prob: 0.58,
    ou_result_prob: 0.82,
    run_id: null,
    temperature: null,
    precipitation: null,
    wind_speed: null,
    icon: null,
    spread_splits_label: null,
    total_splits_label: null,
    ml_splits_label: null,
    home_ml_handle: null,
    away_ml_handle: null,
    home_ml_bets: null,
    away_ml_bets: null,
    home_spread_handle: null,
    away_spread_handle: null,
    home_spread_bets: null,
    away_spread_bets: null,
    over_handle: null,
    under_handle: null,
    over_bets: null,
    under_bets: null,
  },
];

// Copy above the cards. Cross-fades between intro and post-scan content so
// the transition feels continuous rather than swapping text mid-wave.
// Intro stays visible through `scanning` so the wave plays over familiar UI.
function PhaseHeader({ phase }: { phase: Phase }) {
  const showIntro = phase === 'intro-scan' || phase === 'scanning';
  const showHighlight = phase === 'highlight-card' || phase === 'sheet-demo';

  return (
    <View style={styles.headerBlock}>
      {showIntro && (
        <Animated.View
          key="intro"
          entering={FadeIn.duration(350)}
          exiting={FadeOut.duration(350)}
          style={styles.headerOverlay}
        >
          <Text style={styles.title}>Scan any page to highlight edges</Text>
        </Animated.View>
      )}
      {showHighlight && (
        // Delay the enter so it lands just after the intro fades out —
        // feels like a handoff instead of a simultaneous dissolve.
        <Animated.View
          key="highlight"
          entering={FadeIn.duration(350).delay(250)}
          exiting={FadeOut.duration(350)}
          style={styles.headerOverlay}
        >
          <Text style={styles.title}>Tap the game card</Text>
          <Text style={styles.subtitle}>See the pro-grade data we surface for every matchup.</Text>
        </Animated.View>
      )}
    </View>
  );
}

// FeatureSpotlight sits at index 8 of the PagerView in (onboarding)/index.tsx,
// which is step 9 in the user-facing counter. PagerView keeps off-screen pages
// mounted, so we can't rely on unmount for reset — we watch currentStep and
// reset when the user navigates away so the tutorial starts fresh on return.
const FEATURE_SPOTLIGHT_STEP = 9;

export function FeatureSpotlight() {
  const { nextStep, isTransitioning, currentStep } = useOnboarding();
  const { width } = useWindowDimensions();
  const cardWidth = (width - 32 - 8) / 2;

  const [phase, setPhase] = useState<Phase>('intro-scan');
  const sheetRef = useRef<DemoGameBottomSheetHandle>(null);
  const hasAdvanced = useRef(false);
  const wasActive = useRef(false);

  const handleScanPress = useCallback(() => {
    if (phase !== 'intro-scan') return;
    setPhase('scanning');
  }, [phase]);

  const handleWaveComplete = useCallback(() => {
    // Guard against the timer firing after unmount during step transitions.
    setPhase((current) => (current === 'scanning' ? 'highlight-card' : current));
  }, []);

  const handleCardPress = useCallback((gameId: string) => {
    // Only the first highlighted card advances the tutorial.
    if (phase !== 'highlight-card' || gameId !== DUMMY_GAMES[0].id) return;
    setPhase('sheet-demo');
    // Slight delay lets the state render before snapping the sheet open so
    // the backdrop fade-in matches the animation on real game cards.
    requestAnimationFrame(() => sheetRef.current?.open());
  }, [phase]);

  const advanceOnboarding = useCallback(() => {
    if (hasAdvanced.current) return;
    hasAdvanced.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    sheetRef.current?.close();
    nextStep();
  }, [nextStep]);

  // Safety net: if the user dismisses the sheet without tapping Continue,
  // the bottom CTA stays visible so they still have a path forward.
  const handleSheetClose = useCallback(() => {
    // Intentional no-op: we do not reset the phase. The fixed-bottom
    // Continue button remains available in sheet-demo.
  }, []);

  useEffect(() => {
    return () => {
      hasAdvanced.current = false;
    };
  }, []);

  // Reset-on-leave: when the user navigates away (forward or back), wipe
  // tutorial state so the next time this page is shown it replays from the
  // start. PagerView keeps the page mounted, so we watch currentStep.
  useEffect(() => {
    const isActive = currentStep === FEATURE_SPOTLIGHT_STEP;
    if (wasActive.current && !isActive) {
      setPhase('intro-scan');
      hasAdvanced.current = false;
      sheetRef.current?.close();
    }
    wasActive.current = isActive;
  }, [currentStep]);

  const showBottomContinue = phase === 'sheet-demo';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <PhaseHeader phase={phase} />

        {/* Fixed-height row so the button's fade-out doesn't collapse the
            layout — the cards below stay anchored in place. */}
        <View style={styles.scanButtonRow}>
          {(phase === 'intro-scan' || phase === 'scanning') && (
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(350)}
            >
              {/* GlowingCardWrapper mirrors the animated halo used on the
                  leaderboard avatar cards — it's our established "look here"
                  affordance, so we reuse it instead of a pointing cue. */}
              <GlowingCardWrapper color="#22c55e" borderRadius={20}>
                <DemoScanButton
                  onPress={handleScanPress}
                  disabled={phase !== 'intro-scan'}
                />
              </GlowingCardWrapper>
            </Animated.View>
          )}
        </View>

        <View style={styles.cardsContainer}>
          {DUMMY_GAMES.map((game, index) => {
            // Stays highlighted through sheet-demo so the glow doesn't flash
            // off the instant the user taps and the sheet begins opening.
            const isHighlighted =
              (phase === 'highlight-card' || phase === 'sheet-demo') && index === 0;
            const card = (
              <NFLGameCard
                game={game}
                onPress={isHighlighted ? () => handleCardPress(game.id) : () => {}}
                cardWidth={cardWidth}
                forceDarkMode
              />
            );

            if (isHighlighted) {
              // Same animated halo treatment used on leaderboard avatars —
              // reuses the established "look here" affordance.
              return (
                <GlowingCardWrapper key={game.id} color="#22c55e" borderRadius={20}>
                  {card}
                </GlowingCardWrapper>
              );
            }
            return <View key={game.id}>{card}</View>;
          })}
        </View>
      </ScrollView>

      <DemoScanWaveAnimation active={phase === 'scanning'} onComplete={handleWaveComplete} />

      <DemoGameBottomSheet
        ref={sheetRef}
        onContinue={advanceOnboarding}
        onClose={handleSheetClose}
      />

      {showBottomContinue && (
        <View style={onboardingCta.fixedBottom}>
          <Button
            onPress={advanceOnboarding}
            fullWidth
            variant="glass"
            forceDarkMode
            style={onboardingCta.button}
            loading={isTransitioning}
          >
            Continue
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 120,
  },
  headerBlock: {
    // Minimum reserves layout space for whichever overlay is active so
    // neither phase's content causes a jump when they cross-fade.
    minHeight: 88,
    marginBottom: 16,
    position: 'relative',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  scanButtonRow: {
    // Fixed height (matching the pill) so the cards below stay anchored
    // while the button fades in/out across phases.
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
});
