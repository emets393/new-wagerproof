import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useThemeContext } from '@/contexts/ThemeContext';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/**
 * Shimmer placeholder that matches the BettingTrendsMatchupCard layout.
 * Shows skeleton shapes for: gradient stripe, two team avatars + abbreviations,
 * center "@" + time badge, and a chevron area.
 */
export function BettingTrendsMatchupCardShimmer() {
  const { isDark } = useThemeContext();
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
    return { transform: [{ translateX }] };
  });

  const baseColor = isDark ? '#0d0d0d' : '#e0e0e0';
  const highlightColor = isDark ? '#1a1a1a' : '#f0f0f0';

  const renderShimmerBlock = (style: object) => (
    <Animated.View style={[style, { backgroundColor: baseColor }]}>
      <AnimatedLinearGradient
        colors={[baseColor, highlightColor, baseColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.shimmer, animatedStyle]}
      />
    </Animated.View>
  );

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#111111' : '#ffffff' }]}>
      {/* Gradient stripe skeleton */}
      {renderShimmerBlock(styles.gradientStripe)}

      <View style={styles.content}>
        {/* Away Team skeleton */}
        <View style={styles.teamSection}>
          {renderShimmerBlock(styles.avatarSkeleton)}
          {renderShimmerBlock(styles.abbrSkeleton)}
        </View>

        {/* Center section skeleton */}
        <View style={styles.centerSection}>
          {renderShimmerBlock(styles.atSkeleton)}
          {renderShimmerBlock(styles.timeBadgeSkeleton)}
        </View>

        {/* Home Team skeleton */}
        <View style={styles.teamSection}>
          {renderShimmerBlock(styles.avatarSkeleton)}
          {renderShimmerBlock(styles.abbrSkeleton)}
        </View>

        {/* Chevron skeleton */}
        {renderShimmerBlock(styles.chevronSkeleton)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  gradientStripe: {
    height: 4,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  avatarSkeleton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  abbrSkeleton: {
    width: 32,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 8,
  },
  atSkeleton: {
    width: 20,
    height: 18,
    borderRadius: 4,
    overflow: 'hidden',
  },
  timeBadgeSkeleton: {
    width: 70,
    height: 22,
    borderRadius: 8,
    overflow: 'hidden',
  },
  chevronSkeleton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    marginLeft: 4,
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
});
