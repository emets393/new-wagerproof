import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  interpolate,
  Extrapolate 
} from 'react-native-reanimated';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export function AlertCardShimmer() {
  const theme = useTheme();
  const shimmerAnim = useSharedValue(0);

  useEffect(() => {
    shimmerAnim.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      true
    );
  }, [shimmerAnim]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerAnim.value,
      [0, 1],
      [-400, 400],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ translateX }],
    };
  });

  const baseColor = theme.dark ? '#0d0d0d' : '#f0f0f0';
  const highlightColor = theme.dark ? '#1a1a1a' : '#ffffff';

  return (
    <View style={[styles.card, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.dark ? '#000000' : '#ffffff' }]}>
      <View style={styles.content}>
        {/* Header Pills Skeleton */}
        <View style={styles.headerRow}>
          {[1, 2, 3].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.pillSkeleton,
                { backgroundColor: baseColor, width: i === 1 ? 50 : i === 2 ? 70 : 40 },
              ]}
            >
              <AnimatedLinearGradient
                colors={[baseColor, highlightColor, baseColor]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.shimmer, animatedStyle]}
              />
            </Animated.View>
          ))}
        </View>

        {/* Matchup Text Skeleton */}
        <Animated.View
          style={[
            styles.textSkeleton,
            { backgroundColor: baseColor, width: '70%', height: 20, marginBottom: 8 },
          ]}
        >
          <AnimatedLinearGradient
            colors={[baseColor, highlightColor, baseColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.shimmer, animatedStyle]}
          />
        </Animated.View>

        {/* Description Text Skeleton */}
        <Animated.View
          style={[
            styles.textSkeleton,
            { backgroundColor: baseColor, width: '90%', height: 14 },
          ]}
        >
          <AnimatedLinearGradient
            colors={[baseColor, highlightColor, baseColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.shimmer, animatedStyle]}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 12,
  },
  content: {
    gap: 8,
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  pillSkeleton: {
    height: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  textSkeleton: {
    borderRadius: 4,
    overflow: 'hidden',
  },
});

