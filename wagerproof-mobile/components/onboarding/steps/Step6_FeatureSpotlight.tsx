import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { onboardingCta } from '../onboardingStyles';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { NFLGameCard } from '../../NFLGameCard';
import { NFLPrediction } from '@/types/nfl';
import { DemoScanButton } from '../DemoScanButton';
import { DemoScanWaveAnimation } from '../DemoScanWaveAnimation';
import { PulsingBorder } from '../PulsingBorder';
import { DemoGameBottomSheet, DemoGameBottomSheetHandle } from '../DemoGameBottomSheet';

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

// Copy above the cards. Each phase swaps this block.
function PhaseHeader({ phase }: { phase: Phase }) {
  if (phase === 'scanning') return null;

  if (phase === 'highlight-card') {
    return (
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Tap the game card</Text>
        <Text style={styles.subtitle}>See the pro-grade data we surface for every matchup.</Text>
      </View>
    );
  }

  // intro-scan and sheet-demo both show the scan intro. Once the sheet opens,
  // the sheet itself owns the screen, so leaving the header in place under it
  // is fine.
  return (
    <View style={styles.headerBlock}>
      <Text style={styles.title}>Here's how we help you find edges</Text>
      <Text style={styles.subtitle}>Tap here to scan</Text>
    </View>
  );
}

export function FeatureSpotlight() {
  const { nextStep, isTransitioning } = useOnboarding();
  const { width } = useWindowDimensions();
  const cardWidth = (width - 32 - 8) / 2;

  const [phase, setPhase] = useState<Phase>('intro-scan');
  const sheetRef = useRef<DemoGameBottomSheetHandle>(null);
  const hasAdvanced = useRef(false);

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

  const showBottomContinue = phase === 'sheet-demo';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <PhaseHeader phase={phase} />

        {phase === 'intro-scan' && (
          <View style={styles.scanButtonRow}>
            <DemoScanButton onPress={handleScanPress} />
          </View>
        )}

        {phase !== 'intro-scan' && <View style={styles.scanButtonSpacer} />}

        <View style={styles.cardsContainer}>
          {DUMMY_GAMES.map((game, index) => {
            const isHighlighted = phase === 'highlight-card' && index === 0;
            return (
              <PulsingBorder key={game.id} active={isHighlighted} borderRadius={20}>
                <NFLGameCard
                  game={game}
                  onPress={isHighlighted ? () => handleCardPress(game.id) : () => {}}
                  cardWidth={cardWidth}
                  forceDarkMode
                />
              </PulsingBorder>
            );
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
    minHeight: 88,
    justifyContent: 'center',
    marginBottom: 16,
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
    alignItems: 'center',
    marginBottom: 24,
  },
  scanButtonSpacer: {
    // Keeps the cards from jumping when the scan pill disappears.
    height: 44,
    marginBottom: 24,
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
});
