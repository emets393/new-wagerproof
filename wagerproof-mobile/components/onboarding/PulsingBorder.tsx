import React, { useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

// Wraps children with a pulsing green outline to draw the user's eye to a
// specific target during the onboarding tutorial. Green matches the product
// accent (#22c55e) used throughout the app.
interface PulsingBorderProps {
  active: boolean;
  children: React.ReactNode;
  color?: string;
  borderRadius?: number;
  // ms delay before the border starts fading in. Lets callers stagger the
  // highlight behind sibling fade-ins (e.g. wait for a header cross-fade).
  fadeInDelay?: number;
}

export function PulsingBorder({
  active,
  children,
  color = '#22c55e',
  borderRadius = 12,
  fadeInDelay = 0,
}: PulsingBorderProps) {
  const pulse = useSharedValue(0);
  const fadeIn = useSharedValue(0);

  useEffect(() => {
    if (active) {
      fadeIn.value = withDelay(
        fadeInDelay,
        withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) })
      );
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      cancelAnimation(fadeIn);
      cancelAnimation(pulse);
      fadeIn.value = 0;
      pulse.value = 0;
    }
    return () => {
      cancelAnimation(fadeIn);
      cancelAnimation(pulse);
    };
  }, [active, fadeIn, fadeInDelay, pulse]);

  const borderStyle = useAnimatedStyle(() => ({
    // fadeIn gates the whole thing so the border glides in from invisible
    // rather than popping to its mid-pulse opacity.
    opacity: fadeIn.value * (0.35 + pulse.value * 0.65),
    // Shadow is iOS-only; pulsing opacity alone does the visual work on Android.
    ...(Platform.OS === 'ios'
      ? {
          shadowOpacity: fadeIn.value * (0.3 + pulse.value * 0.5),
          shadowRadius: 6 + pulse.value * 10,
        }
      : {}),
  }));

  return (
    <View style={styles.wrapper}>
      {children}
      {active && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.border,
            {
              borderColor: color,
              borderRadius,
              shadowColor: color,
            },
            borderStyle,
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    shadowOffset: { width: 0, height: 0 },
  },
});
