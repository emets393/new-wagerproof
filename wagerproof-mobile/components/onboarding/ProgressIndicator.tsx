import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
}

export function ProgressIndicator({ currentStep, totalSteps, onBack }: ProgressIndicatorProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const progressPercentage = (currentStep / totalSteps) * 100;
  const showBackButton = currentStep > 1 && onBack;
  
  // Animated progress value
  const animatedProgress = useSharedValue(0);
  
  useEffect(() => {
    animatedProgress.value = withTiming(progressPercentage, {
      duration: 400,
    });
  }, [progressPercentage, animatedProgress]);
  
  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${animatedProgress.value}%`,
    };
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.contentRow}>
        {/* Back Button */}
        {showBackButton ? (
          <TouchableOpacity 
            onPress={onBack}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons 
              name="chevron-left" 
              size={28} 
              color="rgba(255, 255, 255, 0.9)" 
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButtonSpacer} />
        )}

        {/* Progress Bar */}
        <View style={styles.trackContainer}>
          <View style={[styles.track, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}>
            <Animated.View
              style={[
                styles.progress,
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                },
                animatedProgressStyle,
              ]}
            />
          </View>
        </View>
        
        {/* Right spacer for symmetry */}
        <View style={styles.backButtonSpacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    flexShrink: 0,
  },
  backButtonSpacer: {
    width: 36,
    flexShrink: 0,
  },
  trackContainer: {
    flex: 1,
    minWidth: 0, // Prevents flex overflow
  },
  track: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    borderRadius: 5,
  },
});

