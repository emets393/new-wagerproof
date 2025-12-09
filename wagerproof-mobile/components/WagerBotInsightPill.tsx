/**
 * WagerBotInsightPill
 *
 * A pill-shaped button that appears in bottom sheet headers.
 * When tapped, it immediately triggers the floating WagerBot bubble
 * which animates smoothly from the pill's position.
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';
import { NFLPrediction } from '@/types/nfl';
import { CFBPrediction } from '@/types/cfb';
import { NBAGame } from '@/types/nba';
import { NCAABGame } from '@/types/ncaab';

// WagerProof green
const WAGERPROOF_GREEN = '#00E676';

// Pill dimensions
const PILL_HEIGHT = 32;
const PILL_WIDTH = 140;

type Sport = 'nfl' | 'cfb' | 'nba' | 'ncaab';
type GameData = NFLPrediction | CFBPrediction | NBAGame | NCAABGame;

interface WagerBotInsightPillProps {
  game: GameData;
  sport: Sport;
  style?: object;
}

export function WagerBotInsightPill({ game, sport, style }: WagerBotInsightPillProps) {
  const {
    isDetached,
    onGameSheetOpen,
    detachBubbleFromPill,
  } = useWagerBotSuggestion();

  const pillRef = useRef<View>(null);

  const handlePress = useCallback(() => {
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Measure pill position on screen
    pillRef.current?.measureInWindow((x, y) => {
      // Set game context first
      onGameSheetOpen(game, sport);

      // Trigger floating bubble at pill position with pill dimensions
      // The bubble appears instantly at pill size (no fade needed - bubble replaces pill visually)
      detachBubbleFromPill(x, y, PILL_WIDTH, PILL_HEIGHT);
    });
  }, [game, sport, onGameSheetOpen, detachBubbleFromPill]);

  // Don't show if already in detached/floating mode
  if (isDetached) {
    return null;
  }

  return (
    <View
      ref={pillRef}
      style={[styles.container, style]}
    >
      <TouchableOpacity
        style={styles.pill}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="robot"
            size={16}
            color={WAGERPROOF_GREEN}
          />
        </View>
        <Text style={styles.text}>
          Tap for insights
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 100,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  iconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
