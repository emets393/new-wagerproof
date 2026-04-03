import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeContext } from '@/contexts/ThemeContext';

const CARD_SIZE = 160;
const SUBTEXT_HEIGHT = 10;
const VALUE_HEIGHT = 8;

interface OutlierCardShimmerProps {
  /** Stagger delay in ms — pass index * 150 for cascading effect */
  delay?: number;
}

/**
 * Animated shimmer placeholder matching OutlierMatchupCard dimensions.
 * Uses a pulsing opacity animation with optional stagger delay for cascading.
 */
export function OutlierCardShimmer({ delay = 0 }: OutlierCardShimmerProps) {
  const { isDark } = useThemeContext();
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );

    // Stagger start
    const timeout = setTimeout(() => animation.start(), delay);
    return () => {
      clearTimeout(timeout);
      animation.stop();
    };
  }, [pulse, delay]);

  const baseBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const shimmerLight = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const barBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.card, { opacity: pulse }]}>
        <LinearGradient
          colors={[baseBg, shimmerLight, baseBg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Faux VS circle */}
          <View style={styles.vsPlaceholder}>
            <View style={[styles.vsCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }]} />
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Faux subtext lines */}
      <Animated.View style={[styles.subtextBar, { backgroundColor: barBg, opacity: pulse }]} />
      <Animated.View style={[styles.valueBar, { backgroundColor: barBg, opacity: pulse }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: CARD_SIZE,
    marginRight: 12,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    position: 'relative',
  },
  vsPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  subtextBar: {
    height: SUBTEXT_HEIGHT,
    width: 100,
    borderRadius: 5,
    marginTop: 10,
  },
  valueBar: {
    height: VALUE_HEIGHT,
    width: 60,
    borderRadius: 4,
    marginTop: 6,
  },
});
