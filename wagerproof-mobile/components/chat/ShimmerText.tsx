// ShimmerText — Text with a pulsing opacity shimmer effect, matching
// Ellie's .shimmering() modifier. Loops between 0.5 and 1.0 opacity.

import React, { useEffect } from 'react';
import { TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface ShimmerTextProps {
  children: React.ReactNode;
  style?: TextStyle;
  duration?: number;
}

export function ShimmerText({ children, style, duration = 1500 }: ShimmerTextProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[style, animatedStyle]}>
      {children}
    </Animated.Text>
  );
}
