import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useThemeContext } from '@/contexts/ThemeContext';

interface ThinkingAnimationProps {
  stage?: string;
}

const DEFAULT_STAGES = [
  'Analyzing today\'s slate...',
  'Reviewing model predictions...',
  'Applying your preferences...',
  'Making selections...',
];

function AnimatedDot({ delay }: { delay: number }) {
  const theme = useTheme();
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.ease }),
          withTiming(0.6, { duration: 400, easing: Easing.ease })
        ),
        -1,
        true
      )
    );

    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.ease }),
          withTiming(0.3, { duration: 400, easing: Easing.ease })
        ),
        -1,
        true
      )
    );

    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [delay, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: theme.colors.primary },
        animatedStyle,
      ]}
    />
  );
}

function BrainIcon() {
  const theme = useTheme();
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 200, easing: Easing.ease }),
        withTiming(5, { duration: 400, easing: Easing.ease }),
        withTiming(0, { duration: 200, easing: Easing.ease })
      ),
      -1,
      true
    );

    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 500, easing: Easing.ease }),
        withTiming(1, { duration: 500, easing: Easing.ease })
      ),
      -1,
      true
    );

    return () => {
      cancelAnimation(rotation);
      cancelAnimation(scale);
    };
  }, [rotation, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.brainContainer, animatedStyle]}>
      <Text style={styles.brainEmoji}>🧠</Text>
    </Animated.View>
  );
}

export function ThinkingAnimation({ stage }: ThinkingAnimationProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const textOpacity = useSharedValue(1);

  // Cycle through default stages if no specific stage is provided
  useEffect(() => {
    if (stage) return;

    const interval = setInterval(() => {
      textOpacity.value = withSequence(
        withTiming(0, { duration: 200 }),
        withTiming(1, { duration: 200 })
      );

      setCurrentStageIndex((prev) => (prev + 1) % DEFAULT_STAGES.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [stage, textOpacity]);

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const displayText = stage || DEFAULT_STAGES[currentStageIndex];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(0, 0, 0, 0.03)',
          borderColor: isDark
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.08)',
        },
      ]}
    >
      <BrainIcon />

      <View style={styles.dotsContainer}>
        <AnimatedDot delay={0} />
        <AnimatedDot delay={150} />
        <AnimatedDot delay={300} />
      </View>

      <Animated.Text
        style={[
          styles.stageText,
          { color: theme.colors.onSurfaceVariant },
          animatedTextStyle,
        ]}
      >
        {displayText}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 16,
  },
  brainContainer: {
    marginBottom: 16,
  },
  brainEmoji: {
    fontSize: 48,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stageText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
});
