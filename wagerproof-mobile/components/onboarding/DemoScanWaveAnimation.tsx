import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
  withDelay,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Ellipse } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

// Mirrors the fluid green wave in components/WagerBotSuggestionBubble.tsx so the
// onboarding demo shows users the exact animation they'll see in the real app.
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const WAGERPROOF_GREEN = '#00E676';
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// Wave finishes its expansion well before this — 1400 ms lets the trails fade
// off-screen before we advance phases.
const WAVE_DURATION_MS = 1400;

interface DemoScanWaveAnimationProps {
  active: boolean;
  onComplete: () => void;
}

export function DemoScanWaveAnimation({ active, onComplete }: DemoScanWaveAnimationProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      progress.value = 0;
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    progress.value = 0;
    progress.value = withDelay(
      50,
      withSpring(1, { damping: 15, stiffness: 25, mass: 1 })
    );

    const timer = setTimeout(onComplete, WAVE_DURATION_MS);

    return () => clearTimeout(timer);
  }, [active, onComplete, progress]);

  const maxRadius = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) * 1.5;

  const mainProps = useAnimatedProps(() => {
    const r = interpolate(progress.value, [0, 1], [0, maxRadius]);
    return { rx: r, ry: r };
  });
  const trail1Props = useAnimatedProps(() => {
    const p = Math.max(0, progress.value - 0.08);
    const r = interpolate(p, [0, 1], [0, maxRadius]);
    return { rx: r, ry: r };
  });
  const trail2Props = useAnimatedProps(() => {
    const p = Math.max(0, progress.value - 0.16);
    const r = interpolate(p, [0, 1], [0, maxRadius]);
    return { rx: r, ry: r };
  });
  const trail3Props = useAnimatedProps(() => {
    const p = Math.max(0, progress.value - 0.24);
    const r = interpolate(p, [0, 1], [0, maxRadius]);
    return { rx: r, ry: r };
  });

  if (!active) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
        <AnimatedEllipse
          cx={SCREEN_WIDTH / 2}
          cy={0}
          animatedProps={trail3Props}
          fill="none"
          stroke={WAGERPROOF_GREEN}
          strokeWidth={25}
          opacity={0.15}
        />
        <AnimatedEllipse
          cx={SCREEN_WIDTH / 2}
          cy={0}
          animatedProps={trail2Props}
          fill="none"
          stroke={WAGERPROOF_GREEN}
          strokeWidth={18}
          opacity={0.25}
        />
        <AnimatedEllipse
          cx={SCREEN_WIDTH / 2}
          cy={0}
          animatedProps={trail1Props}
          fill="none"
          stroke={WAGERPROOF_GREEN}
          strokeWidth={10}
          opacity={0.4}
        />
        <AnimatedEllipse
          cx={SCREEN_WIDTH / 2}
          cy={0}
          animatedProps={mainProps}
          fill="none"
          stroke={WAGERPROOF_GREEN}
          strokeWidth={4}
          opacity={1}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
  },
});
