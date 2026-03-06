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

export function ModelAccuracyCardShimmer() {
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

  const renderSection = () => (
    <View style={[styles.section, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
      <View style={styles.sectionRow}>
        {renderShimmerBlock(styles.labelSkeleton)}
        {renderShimmerBlock(styles.valueSkeleton)}
      </View>
      <View style={styles.sectionRow}>
        {renderShimmerBlock(styles.labelSkeleton)}
        {renderShimmerBlock(styles.accuracySkeleton)}
      </View>
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#111111' : '#ffffff' }]}>
      {renderShimmerBlock(styles.gradientStripe)}
      <View style={styles.header}>
        <View style={styles.teamRow}>
          {renderShimmerBlock(styles.avatarSkeleton)}
          {renderShimmerBlock(styles.abbrSkeleton)}
          {renderShimmerBlock(styles.atSkeleton)}
          {renderShimmerBlock(styles.avatarSkeleton)}
          {renderShimmerBlock(styles.abbrSkeleton)}
        </View>
        {renderShimmerBlock(styles.timeSkeleton)}
      </View>
      {renderSection()}
      {renderSection()}
      {renderSection()}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingBottom: 14,
  },
  gradientStripe: {
    height: 4,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarSkeleton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  abbrSkeleton: {
    width: 28,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  atSkeleton: {
    width: 14,
    height: 14,
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 4,
  },
  timeSkeleton: {
    width: 60,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  section: {
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelSkeleton: {
    width: 50,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  valueSkeleton: {
    width: 90,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  accuracySkeleton: {
    width: 80,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
});
