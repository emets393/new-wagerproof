// ThinkingIndicator — Shown while the agent is thinking before any content
// arrives. Displays the user's chosen Lottie thinking sprite with rotating
// verb labels that slide in from bottom / out to top, matching Ellie's
// ThinkingIndicatorView.

import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ShimmerText } from './ShimmerText';
import { useThinkingSprite } from '../../hooks/useThinkingSprite';

// WagerProof-specific thinking verbs — sports betting analysis actions
const THINKING_VERBS = [
  'pulling predictions',
  'checking the odds',
  'scanning matchups',
  'reading the lines',
  'analyzing trends',
  'checking Polymarket',
  'looking at weather',
  'reviewing picks',
  'crunching numbers',
  'comparing models',
  'finding value bets',
  'checking injuries',
  'grading the slate',
  'weighing the edge',
  'cross-referencing',
  'pondering',
];

const VERB_INTERVAL_MS = 3000;

// Lottie asset map — requires static require calls
const SPRITE_ASSETS: Record<string, any> = {
  thinking_petals: require('../../assets/thinking_petals.json'),
  thinking_1: require('../../assets/thinking_1.json'),
  thinking_2: require('../../assets/thinking_2.json'),
  thinking_birb: require('../../assets/thinking_birb.json'),
};

export default function ThinkingIndicator() {
  const [verbIndex, setVerbIndex] = useState(() =>
    Math.floor(Math.random() * THINKING_VERBS.length),
  );
  const spriteName = useThinkingSprite();

  // Rotate verbs every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setVerbIndex((prev) => (prev + 1) % THINKING_VERBS.length);
    }, VERB_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const spriteSource = SPRITE_ASSETS[spriteName] || SPRITE_ASSETS['thinking_petals'];

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      <LottieView
        source={spriteSource}
        autoPlay
        loop
        style={styles.lottie}
      />
      {/* Key forces remount on index change, triggering enter/exit transitions */}
      <Animated.View
        key={verbIndex}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
      >
        <ShimmerText style={styles.verbText}>
          {THINKING_VERBS[verbIndex]}...
        </ShimmerText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  lottie: {
    width: 32,
    height: 32,
  },
  verbText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 15,
    fontWeight: '500',
  },
});
