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
import { useThemeContext } from '@/contexts/ThemeContext';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

interface GameCardShimmerProps {
  cardWidth?: number;
}

export function GameCardShimmer({ cardWidth }: GameCardShimmerProps = {}) {
  const theme = useTheme();
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

    return {
      transform: [{ translateX }],
    };
  });

  const baseColor = isDark ? '#0d0d0d' : '#e0e0e0';
  const highlightColor = isDark ? '#1a1a1a' : '#f0f0f0';

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#000000' : '#ffffff' }, cardWidth ? { width: cardWidth } : { flex: 1 }]}>
      {/* Gradient border */}
      <View 
        style={[
          styles.gradientBorder, 
          { backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }
        ]} 
      />

      <View style={styles.content}>
        {/* Date and time skeleton */}
        <View style={styles.dateContainer}>
          <Animated.View
            style={[
              styles.dateSkeletonBase,
              { backgroundColor: baseColor },
            ]}
          >
            <AnimatedLinearGradient
              colors={[
                baseColor,
                highlightColor,
                baseColor,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.shimmer, animatedStyle]}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.timeBadgeSkeleton,
              { backgroundColor: baseColor },
            ]}
          >
            <AnimatedLinearGradient
              colors={[
                baseColor,
                highlightColor,
                baseColor,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.shimmer, animatedStyle]}
            />
          </Animated.View>
        </View>

        {/* Teams row skeleton */}
        <View style={styles.teamsRow}>
          {/* Away team */}
          <View style={styles.teamColumn}>
            <Animated.View
              style={[
                styles.teamCircleSkeleton,
                { backgroundColor: baseColor },
              ]}
            >
              <AnimatedLinearGradient
                colors={[
                  baseColor,
                  highlightColor,
                  baseColor,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.shimmer, animatedStyle]}
              />
            </Animated.View>
            <Animated.View
              style={[
                styles.teamCitySkeleton,
                { backgroundColor: baseColor },
              ]}
            >
              <AnimatedLinearGradient
                colors={[
                  baseColor,
                  highlightColor,
                  baseColor,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.shimmer, animatedStyle]}
              />
            </Animated.View>
            <Animated.View
              style={[
                styles.teamNicknameSkeleton,
                { backgroundColor: baseColor },
              ]}
            >
              <AnimatedLinearGradient
                colors={[
                  baseColor,
                  highlightColor,
                  baseColor,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.shimmer, animatedStyle]}
              />
            </Animated.View>
            <View style={styles.teamLinesRow}>
              <Animated.View
                style={[
                  styles.lineTextSkeleton,
                  { backgroundColor: baseColor },
                ]}
              >
                <AnimatedLinearGradient
                  colors={[
                    baseColor,
                    highlightColor,
                    baseColor,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.shimmer, animatedStyle]}
                />
              </Animated.View>
            </View>
          </View>

          {/* Center @ symbol and O/U */}
          <View style={styles.centerColumn}>
            <Animated.View
              style={[
                styles.ouLineSkeleton,
                { backgroundColor: baseColor },
              ]}
            >
              <AnimatedLinearGradient
                colors={[
                  baseColor,
                  highlightColor,
                  baseColor,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.shimmer, animatedStyle]}
              />
            </Animated.View>
          </View>

          {/* Home team */}
          <View style={styles.teamColumn}>
            <Animated.View
              style={[
                styles.teamCircleSkeleton,
                { backgroundColor: baseColor },
              ]}
            >
              <AnimatedLinearGradient
                colors={[
                  baseColor,
                  highlightColor,
                  baseColor,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.shimmer, animatedStyle]}
              />
            </Animated.View>
            <Animated.View
              style={[
                styles.teamCitySkeleton,
                { backgroundColor: baseColor },
              ]}
            >
              <AnimatedLinearGradient
                colors={[
                  baseColor,
                  highlightColor,
                  baseColor,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.shimmer, animatedStyle]}
              />
            </Animated.View>
            <Animated.View
              style={[
                styles.teamNicknameSkeleton,
                { backgroundColor: baseColor },
              ]}
            >
              <AnimatedLinearGradient
                colors={[
                  baseColor,
                  highlightColor,
                  baseColor,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.shimmer, animatedStyle]}
              />
            </Animated.View>
            <View style={styles.teamLinesRow}>
              <Animated.View
                style={[
                  styles.lineTextSkeleton,
                  { backgroundColor: baseColor },
                ]}
              >
                <AnimatedLinearGradient
                  colors={[
                    baseColor,
                    highlightColor,
                    baseColor,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.shimmer, animatedStyle]}
                />
              </Animated.View>
            </View>
          </View>
        </View>

        {/* Prediction pills skeleton */}
        <View style={styles.pillsSection}>
          <View style={styles.pillsHeaderSkeleton}>
            <Animated.View
              style={[
                styles.pillsHeaderTextSkeleton,
                { backgroundColor: baseColor },
              ]}
            >
              <AnimatedLinearGradient
                colors={[
                  baseColor,
                  highlightColor,
                  baseColor,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.shimmer, animatedStyle]}
              />
            </Animated.View>
          </View>
          <View style={styles.pillsColumn}>
            {[0, 1, 2].map((index) => (
              <Animated.View
                key={index}
                style={[
                  styles.pillSkeleton,
                  { backgroundColor: baseColor },
                ]}
              >
                <AnimatedLinearGradient
                  colors={[
                    baseColor,
                    highlightColor,
                    baseColor,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.shimmer, animatedStyle]}
                />
              </Animated.View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 0,
  },
  gradientBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  content: {
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  dateSkeletonBase: {
    height: 12,
    width: 70,
    borderRadius: 6,
    overflow: 'hidden',
  },
  timeBadgeSkeleton: {
    height: 18,
    width: 60,
    borderRadius: 6,
    overflow: 'hidden',
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  teamCircleSkeleton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    marginBottom: 6,
  },
  teamCitySkeleton: {
    height: 11,
    width: 50,
    borderRadius: 4,
    overflow: 'hidden',
  },
  teamNicknameSkeleton: {
    height: 9,
    width: 40,
    borderRadius: 4,
    overflow: 'hidden',
  },
  teamLinesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 3,
  },
  lineTextSkeleton: {
    height: 9,
    width: 35,
    borderRadius: 4,
    overflow: 'hidden',
  },
  centerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  ouLineSkeleton: {
    height: 20,
    width: 60,
    borderRadius: 10,
    overflow: 'hidden',
  },
  pillsSection: {
    marginBottom: 0,
  },
  pillsHeaderSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  pillsHeaderTextSkeleton: {
    height: 10,
    width: 80,
    borderRadius: 5,
    overflow: 'hidden',
  },
  pillsColumn: {
    flexDirection: 'column',
    gap: 8,
  },
  pillSkeleton: {
    height: 40,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
});
