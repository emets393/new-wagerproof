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

export function LiveScoreCardShimmer() {
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
        {/* Top Row: Teams/Scores */}
        <View style={styles.mainRow}>
          {/* Teams Container */}
          <View style={styles.teamsContainer}>
            <Animated.View
              style={[
                styles.teamAbbrSkeleton,
                { backgroundColor: baseColor },
              ]}
            >
              <AnimatedLinearGradient
                colors={[baseColor, highlightColor, baseColor]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.shimmer, animatedStyle]}
              />
            </Animated.View>
            
            <Animated.View
              style={[
                styles.scoreSkeleton,
                { backgroundColor: baseColor },
              ]}
            >
              <AnimatedLinearGradient
                colors={[baseColor, highlightColor, baseColor]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.shimmer, animatedStyle]}
              />
            </Animated.View>
            
            <View style={styles.divider} />
            
            <Animated.View
              style={[
                styles.scoreSkeleton,
                { backgroundColor: baseColor },
              ]}
            >
              <AnimatedLinearGradient
                colors={[baseColor, highlightColor, baseColor]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.shimmer, animatedStyle]}
              />
            </Animated.View>
            
            <Animated.View
              style={[
                styles.teamAbbrSkeleton,
                { backgroundColor: baseColor },
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

          {/* Status Container */}
          <View style={styles.statusContainer}>
            <Animated.View
              style={[
                styles.statusSkeleton,
                { backgroundColor: baseColor },
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

        {/* Bottom Row: Predictions */}
        <View style={styles.predictionsRow}>
           <Animated.View
              style={[
                styles.predictionSkeleton,
                { backgroundColor: baseColor },
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    overflow: 'hidden',
    minHeight: 50,
  },
  content: {
    gap: 4,
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teamAbbrSkeleton: {
    height: 14,
    width: 30,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreSkeleton: {
    height: 14,
    width: 20,
    borderRadius: 4,
    overflow: 'hidden',
  },
  divider: {
    width: 4,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusSkeleton: {
    height: 12,
    width: 40,
    borderRadius: 4,
    overflow: 'hidden',
  },
  predictionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  predictionSkeleton: {
    height: 10,
    width: 60,
    borderRadius: 4,
    overflow: 'hidden',
  },
});

