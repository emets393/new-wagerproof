// ThinkingIndicator — Shown while the agent is thinking before any content
// arrives. Displays a Lottie animation with rotating verb labels, modeled
// after Ellie's ThinkingIndicatorView.

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import LottieView from 'lottie-react-native';

const THINKING_VERBS = [
  'pulling predictions...',
  'checking the odds...',
  'scanning matchups...',
  'reading the lines...',
  'analyzing trends...',
  'checking Polymarket...',
  'looking at weather...',
  'reviewing picks...',
  'crunching numbers...',
  'comparing models...',
  'finding value bets...',
  'checking injuries...',
];

const VERB_INTERVAL_MS = 3000;

export default function ThinkingIndicator() {
  const [verbIndex, setVerbIndex] = useState(() =>
    Math.floor(Math.random() * THINKING_VERBS.length),
  );
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Rotate verbs every 3 seconds with fade transition
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setVerbIndex((prev) => (prev + 1) % THINKING_VERBS.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, VERB_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fadeAnim]);

  // Shimmer animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <LottieView
          source={require('../../assets/RobotAnalyzing.json')}
          autoPlay
          loop
          style={styles.lottie}
        />
        <Animated.View style={{ opacity: fadeAnim }}>
          <Animated.Text style={[styles.verbText, { opacity: shimmerOpacity }]}>
            {THINKING_VERBS[verbIndex]}
          </Animated.Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  lottie: {
    width: 28,
    height: 28,
  },
  verbText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});
