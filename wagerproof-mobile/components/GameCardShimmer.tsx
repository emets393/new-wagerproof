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

export function GameCardShimmer() {
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

  const baseColor = theme.dark ? '#2a2a2a' : '#f0f0f0';
  const highlightColor = theme.dark ? '#3d3d3d' : '#ffffff';

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      {/* Gradient border */}
      <View 
        style={[
          styles.gradientBorder, 
          { backgroundColor: theme.dark ? '#444' : '#ddd' }
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
                styles.teamNameSkeleton,
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
                styles.teamNameSkeleton,
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
          <View style={styles.pillsRow}>
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
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
  },
  gradientBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  dateSkeletonBase: {
    height: 16,
    width: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  timeBadgeSkeleton: {
    height: 24,
    width: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  teamCircleSkeleton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  teamNameSkeleton: {
    height: 14,
    width: 70,
    borderRadius: 6,
    overflow: 'hidden',
  },
  teamLinesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  lineTextSkeleton: {
    height: 12,
    width: 50,
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
    height: 24,
    width: 80,
    borderRadius: 10,
    overflow: 'hidden',
  },
  pillsSection: {
    marginBottom: 12,
  },
  pillsHeaderSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  pillsHeaderTextSkeleton: {
    height: 12,
    width: 120,
    borderRadius: 6,
    overflow: 'hidden',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillSkeleton: {
    height: 28,
    minWidth: 80,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
